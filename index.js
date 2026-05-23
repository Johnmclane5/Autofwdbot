// index.js

// Environment variables are automatically available in the global scope:
// TELEGRAM_BOT_TOKEN
// DESTINATION_CHAT_ID

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const { request } = event;
  const url = new URL(request.url);

  // Serve TON Connect Manifest
  if (request.method === 'GET' && url.pathname === '/tonconnect-manifest.json') {
    return new Response(JSON.stringify({
      url: url.origin,
      name: "TON Donation Bot",
      iconUrl: "https://ton.org/static/mytonwallet.png"
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Serve Donation Mini App
  if (request.method === 'GET' && url.pathname === '/donate-app') {
    const walletAddress = typeof TON_WALLET_ADDRESS !== 'undefined' ? TON_WALLET_ADDRESS : 'YOUR_TON_WALLET_ADDRESS';
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Donate TON</title>
    <script src="https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f0f2f5; color: #333; }
        .container { text-align: center; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); width: 90%; max-width: 400px; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 24px; }
        #ton-connect-button { display: flex; justify-content: center; margin-bottom: 20px; }
        input#amount { padding: 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 8px; width: 100%; box-sizing: border-box; margin-bottom: 16px; display: none; }
        button#send-transaction { width: 100%; padding: 14px; font-size: 16px; font-weight: bold; background-color: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer; display: none; }
        button#send-transaction:active { background-color: #0077b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Support us with TON</h1>
        <p>Connect your wallet to send a donation.</p>
        <div id="ton-connect-button"></div>
        <input type="number" id="amount" placeholder="Amount in TON" step="0.1" min="0.1">
        <button id="send-transaction">Send Donation</button>
    </div>

    <script>
        const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: '${url.origin}/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-button'
        });

        const walletAddress = '${walletAddress}';

        tonConnectUI.onStatusChange(wallet => {
            const amountInput = document.getElementById('amount');
            const sendBtn = document.getElementById('send-transaction');
            if (wallet) {
                amountInput.style.display = 'block';
                sendBtn.style.display = 'block';
            } else {
                amountInput.style.display = 'none';
                sendBtn.style.display = 'none';
            }
        });

        document.getElementById('send-transaction').onclick = async () => {
            const amount = document.getElementById('amount').value;
            if (!amount || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 60,
                messages: [
                    {
                        address: walletAddress,
                        amount: (parseFloat(amount) * 1000000000).toString(),
                    }
                ]
            };

            try {
                await tonConnectUI.sendTransaction(transaction);
                alert('Donation request sent to your wallet!');
            } catch (e) {
                console.error(e);
                alert('Failed to send transaction: ' + (e.message || 'Unknown error'));
            }
        };
    </script>
</body>
</html>
    `;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (request.method === 'POST') {
    const payload = await request.json();
    if (payload.message) {
      event.waitUntil(handleMessage(payload.message, url.origin));
    }
  }
  return new Response('OK', { status: 200 });
}

async function handleMessage(message, botUrl) {
  const chatId = message.chat.id;
  const messageId = message.message_id;

  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  // Handle the /start command
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

  // Handle the /donate command
  if (message.text && message.text === '/donate') {
    const walletAddress = typeof TON_WALLET_ADDRESS !== 'undefined' ? TON_WALLET_ADDRESS : 'YOUR_TON_WALLET_ADDRESS';
    const donationText = `Support the project! 💎\n\nYou can donate TON to the following address:\n\n<code>${walletAddress}</code>\n\nClick the buttons below to open your preferred wallet:`;

    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: donationText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💎 Donate via Mini App', web_app: { url: `${botUrl}/donate-app` } },
            ],
            [
              { text: 'Open in Wallet (ton://)', url: `ton://transfer/${walletAddress}` },
            ],
            [
              { text: 'Tonkeeper', url: `https://app.tonkeeper.com/transfer/${walletAddress}` },
              { text: 'Tonhub', url: `https://tonhub.com/transfer/${walletAddress}` },
            ],
          ],
        },
      }),
    });

    // Notify admin
    const fromUser = message.from;
    const senderInfo = fromUser.username
      ? `@${fromUser.username}`
      : `${fromUser.first_name} ${fromUser.last_name || ''}`.trim();

    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: DESTINATION_CHAT_ID,
        text: `🔔 Donation Interest: ${senderInfo} (ID: ${chatId}) just used the /donate command.`,
      }),
    });
    return;
  }

  // If the message is a reply in the destination chat, handle it as a reply.
  if (
    chatId.toString() === DESTINATION_CHAT_ID.toString() &&
    message.reply_to_message
  ) {
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
    return;
  }

  // Prevent the bot from forwarding messages from the destination chat.
  if (chatId.toString() === DESTINATION_CHAT_ID.toString()) {
    return;
  }

  const identifier = `\u200b${JSON.stringify({
    chat_id: chatId,
    message_id: messageId,
  })}`;

  try {
    if (message.text) {
      const fromUser = message.from;
      const senderInfo = fromUser.username
        ? `@${fromUser.username}`
        : `${fromUser.first_name} ${fromUser.last_name || ''}`.trim();

      const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DESTINATION_CHAT_ID,
          text: `From: ${senderInfo}\n\n${message.text}\n${identifier}`,
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }
    } else {
      const response = await fetch(`${TELEGRAM_API_URL}/copyMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DESTINATION_CHAT_ID,
          from_chat_id: chatId,
          message_id: messageId,
          caption: message.caption
            ? `${message.caption}\n${identifier}`
            : identifier,
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }
    }
  } catch (error) {
    console.error(error);
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Sorry, your message could not be forwarded. Please try again later.',
        reply_to_message_id: messageId,
      }),
    });
  }
}
