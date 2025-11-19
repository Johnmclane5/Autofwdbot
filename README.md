# Telegram Bot Cloudflare Worker

This Cloudflare worker forwards messages from a Telegram bot to a specific chat and allows you to reply to the original sender.

## Deployment

There are two ways to deploy this worker: using the Wrangler CLI or the Cloudflare dashboard.

### Using the Wrangler CLI (Recommended for Developers)

1.  **Clone the repository.**
2.  **Install the Wrangler CLI:**
    ```bash
    npm install -g @cloudflare/wrangler
    ```
3.  **Configure `wrangler.toml`:**
    -   Copy `wrangler.toml.example` to `wrangler.toml`.
4.  **Add Your Secrets:**
    -   `TELEGRAM_BOT_TOKEN`: Your Telegram bot token.
    -   `DESTINATION_CHAT_ID`: The ID of the chat where messages should be forwarded.
    ```bash
    wrangler secret put TELEGRAM_BOT_TOKEN
    wrangler secret put DESTINATION_CHAT_ID
    ```
5.  **Deploy the Worker:**
    ```bash
    wrangler deploy
    ```

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
5.  **Add Your Secrets:**
    -   Go to your worker's **Settings > Variables** tab.
    -   Under "Environment Variables," add two variables:
        -   `TELEGRAM_BOT_TOKEN`: Your Telegram bot token.
        -   `DESTINATION_CHAT_ID`: The ID of the chat where messages will be forwarded.
    -   Click the "Encrypt" button for both variables to keep them secure. Save your changes.


## Setting Up the Telegram Webhook

After deploying, you will have a URL for your worker (e.g., `https://telegram-bot-worker.your-subdomain.workers.dev`). You need to tell Telegram to send updates to this URL.

1.  Construct the following URL, replacing the placeholders:
    `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>`
2.  Paste this URL into your browser and press Enter. You should see a success message from Telegram.


## How It Works

-   When a user sends a message to the bot, it's forwarded to the `DESTINATION_CHAT_ID`.
-   A hidden identifier is added to the forwarded message to link it to the original user.
-   When you reply to a forwarded message, the bot sends your reply to the original user.
