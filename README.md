# Telegram Bot Cloudflare Worker

This Cloudflare worker forwards messages from a Telegram bot to a specific chat and allows you to reply to the original sender.

## Deployment

### Using the Cloudflare Dashboard

1.  **Log in to Cloudflare:** Go to your Cloudflare dashboard.
2.  **Navigate to Workers & Pages:** In the sidebar, select "Workers & Pages."
3.  **Create a Worker:**
    -   Click "Create Application," then "Create Worker."
    -   Give your worker a name (e.g., `telegram-bot-worker`) and click "Deploy."
4.  **Add the Code:**
    -   Click "Quick Edit."
    -   Copy the full content of the `index.js` file from this repository.
    -   Paste it into the editor, replacing the default code.
    -   Click "Save and Deploy."
5.  **Create a KV Namespace:**
    -   In the sidebar, navigate to **Workers & Pages > KV**.
    -   Click "Create a namespace" and give it a name, for example, `TELEGRAM_KV`.
6.  **Add Your Secrets and Bind the KV Namespace:**
    -   Go to your worker's **Settings > Variables** tab.
    -   Under "Environment Variables," add two variables:
        -   `TELEGRAM_BOT_TOKEN`: Your Telegram bot token.
        -   `ADMIN_CHAT_ID`: The ID of the chat for the bot administrator.
    -   Click the "Encrypt" button for both variables to keep them secure.
    -   Under "KV Namespace Bindings," click "Add binding."
    -   Set the "Variable name" to `TELEGRAM_KV` and select the KV namespace you created. Save your changes.
7.  **Set Up a Cron Trigger:**
    -   Go to your worker's **Settings > Triggers** tab.
    -   Under "Cron Triggers," click "Add Cron Trigger."
    -   Enter `* * * * *` to run the worker every minute. Save your changes.


## Setting Up the Telegram Webhook

After deploying, you will have a URL for your worker (e.g., `https://telegram-bot-worker.your-subdomain.workers.dev`). You need to tell Telegram to send updates to this URL.

1.  Construct the following URL, replacing the placeholders:
    `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>`
2.  Paste this URL into your browser and press Enter. You should see a success message from Telegram.

## Configuration

### Setting the Destination Chat

To set the destination chat where messages will be forwarded, the admin must send the following command to the bot:

`/set <chat_id>`

Replace `<chat_id>` with the target chat ID. This command can only be sent from the `ADMIN_CHAT_ID`.

## How It Works

-   When a user sends a message to the bot, a minimal version of it is added to a queue in a Cloudflare KV namespace.
-   A Cron Trigger runs the worker every minute to process the queue, sending messages to the destination chat with a 3-second delay between each message.
-   All messages are forwarded using Telegram's `copyMessage` API call.
-   For text messages, a hidden identifier is added to the caption to enable replies.
-   For all other messages (e.g., images, documents), the caption is omitted to preserve the original caption and its formatting. This means that **reply functionality is not available for non-text messages**.
-   The "From: @username" prefix is no longer added to text messages.
-   When you reply to a forwarded message, the bot sends your reply to the original user.
