# Telegram Bot Cloudflare Worker

This Cloudflare worker forwards messages from a Telegram bot to a specific chat and allows you to reply to the original sender.

## Setup

1.  **Clone the repository.**
2.  **Install the Wrangler CLI:**
    ```bash
    npm install -g @cloudflare/wrangler
    ```
3.  **Configure `wrangler.toml`:**
    -   Copy `wrangler.toml.example` to `wrangler.toml`.
    -   You do not need to add any secrets to this file, as they are managed through Cloudflare secrets.
4.  **Add your secrets to Cloudflare:**
    -   `TELEGRAM_BOT_TOKEN`: Your Telegram bot token.
    -   `DESTINATION_CHAT_ID`: The ID of the chat where messages should be forwarded.
    ```bash
    wrangler secret put TELEGRAM_BOT_TOKEN
    wrangler secret put DESTINATION_CHAT_ID
    ```
5.  **Deploy the worker:**
    ```bash
    wrangler deploy
    ```
6.  **Set up the Telegram webhook:**
    -   After deploying, you'll get a URL for your worker. Set it as your bot's webhook using the following URL, replacing `<YOUR_WORKER_URL>` and `<YOUR_BOT_TOKEN>`:
        ```
        https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
        ```

## How It Works

-   When a user sends a message to the bot, it's forwarded to the `DESTINATION_CHAT_ID`.
-   A hidden identifier is added to the forwarded message to link it to the original user.
-   When you reply to a forwarded message, the bot sends your reply to the original user.
