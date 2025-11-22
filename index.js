// index.js

// Environment variables are automatically available in the global scope:
// TELEGRAM_BOT_TOKEN
// ADMIN_CHAT_ID
// TELEGRAM_KV

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

addEventListener('scheduled', event => {
  event.waitUntil(handleScheduled(event));
});

async function handleRequest(event) {
  const { request } = event;
  if (request.method === 'POST') {
    const payload = await request.json();
    if (payload.message) {
      event.waitUntil(handleMessage(payload.message));
    }
  }
  return new Response('OK', { status: 200 });
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const messageId = message.message_id;

  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  // Handle the /start command immediately
  if (message.text && message.text === '/start') {
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Welcome! You can send me any message, and I will forward it to the support team. They will reply to you through this chat.',
      }),
    });
    return;
  }

  // Handle the /set command
  if (message.text && message.text.startsWith('/set')) {
    if (chatId.toString() !== ADMIN_CHAT_ID.toString()) {
      return; // Ignore if not from admin
    }

    const parts = message.text.split(' ');
    if (parts.length === 2) {
      const newDestination = parts[1];
      await TELEGRAM_KV.put('DESTINATION_CHAT_ID', newDestination);
      await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Destination chat ID set to ${newDestination}`,
        }),
      });
    } else {
      await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Usage: /set <chat_id>',
        }),
      });
    }
    return;
  }

  const DESTINATION_CHAT_ID = await TELEGRAM_KV.get('DESTINATION_CHAT_ID');

  // If the message is a reply in the destination chat, handle it as a reply immediately
  if (
    DESTINATION_CHAT_ID &&
    chatId.toString() === DESTINATION_CHAT_ID.toString() &&
    message.reply_to_message
  ) {
    await handleReplyMessage(message, TELEGRAM_BOT_TOKEN);
    return;
  }

  // Prevent the bot from forwarding messages from the destination chat.
  if (DESTINATION_CHAT_ID && chatId.toString() === DESTINATION_CHAT_ID.toString()) {
    return;
  }

  // For all other messages, add them to the queue with minimal data
  const timestamp = new Date().toISOString();
  const key = `message_${timestamp}_${messageId}`;
  await TELEGRAM_KV.put(key, JSON.stringify({
    from_chat_id: chatId,
    message_id: messageId,
    is_text: !!message.text
  }));
}

async function handleScheduled(event) {
  const DESTINATION_CHAT_ID = await TELEGRAM_KV.get('DESTINATION_CHAT_ID');
  if (!DESTINATION_CHAT_ID) {
    return; // No destination set
  }

  const { keys } = await TELEGRAM_KV.list({ prefix: 'message_' });

  // Sort keys chronologically
  keys.sort((a, b) => a.name.localeCompare(b.name));

  const batch = keys.slice(0, 20);

  for (const key of batch) {
    const message = await TELEGRAM_KV.get(key.name, { type: 'json' });
    if (message) {
      await processAndForwardMessage(message, TELEGRAM_BOT_TOKEN, DESTINATION_CHAT_ID);
      await TELEGRAM_KV.delete(key.name);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
    }
  }
}

async function handleReplyMessage(message, TELEGRAM_BOT_TOKEN) {
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    const repliedTo = message.reply_to_message;
    const text = repliedTo.text || repliedTo.caption || '';
    const match = text.match(/\u200b(.+)/);

    if (match) {
      try {
        const { chat_id: originalChatId, message_id: originalMessageId } =
          JSON.parse(match[1]);

        const response = await fetch(`${TELEGRAM_API_URL}/copyMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: originalChatId,
            from_chat_id: chatId,
            message_id: messageId,
            reply_to_message_id: originalMessageId,
          }),
        });

        const result = await response.json();
        if (!result.ok) {
          throw new Error(`Telegram API error: ${result.description}`);
        }
      } catch (error) {
        console.error('Failed to parse identifier or send reply:', error);
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Failed to send reply. Please try again later.',
            reply_to_message_id: messageId,
          }),
        });
      }
    }
}

async function processAndForwardMessage(queuedMessage, TELEGRAM_BOT_TOKEN, DESTINATION_CHAT_ID) {
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  const processedKey = `processed_${queuedMessage.from_chat_id}_${queuedMessage.message_id}`;

  const alreadyProcessed = await TELEGRAM_KV.get(processedKey);
  if (alreadyProcessed) {
    console.log(`Skipping already processed message: ${processedKey}`);
    return;
  }

  const identifier = `\u200b${JSON.stringify({
    chat_id: queuedMessage.from_chat_id,
    message_id: queuedMessage.message_id,
  })}`;

  const body = {
      chat_id: DESTINATION_CHAT_ID,
      from_chat_id: queuedMessage.from_chat_id,
      message_id: queuedMessage.message_id,
  };

  // For text messages, we add the identifier as a caption to enable replies.
  // For all other messages, we omit the caption entirely to preserve the original.
  if (queuedMessage.is_text) {
      body.caption = identifier;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/copyMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }
      await TELEGRAM_KV.put(processedKey, 'true', { expirationTtl: 86400 });
  } catch (error) {
    console.error(error);
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: queuedMessage.from_chat_id,
        text: 'Sorry, your message could not be forwarded. Please try again later.',
        reply_to_message_id: queuedMessage.message_id,
      }),
    });
  }
}
