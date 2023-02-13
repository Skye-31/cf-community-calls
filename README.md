# Community Call Bot

This is a Discord bot built on Cloudflare Workers with the purpose of managing Question Threads for community calls.

## How it works

The bot is triggered by a slash command `/questions` which takes a required `open` argument. The bot will then post a message in the questions channel, inviting users to submit questions via a button. When people submit a question, it gets posted to a separate questions channel via webhook, and the status of the question is clearly indicated (Answered, Unanswered, Duplicate, etc).

The status of these questions can be managed through Context Menus (right click on a question) and the bot will update the status of the question in the questions channel. For this case, anybody with Manage Messages permission can update the status of a question.

To close the questions thread, the bot can be triggered again with `/questions open:false` which will prevent new submissions.

## Running the bot

To run the bot, you need to have a Discord bot token and a Cloudflare account. You can get a Discord bot token by creating a new application in the [Discord Developer Portal](https://discord.com/developers/applications). You can get a Cloudflare account by signing up for a free account [here](https://dash.cloudflare.com/sign-up).

You should edit wrangler.toml with the following values:

- `account_id`: Your Cloudflare account ID (found in the UUID in the top right of the Cloudflare dashboard)
- `DISCORD_APPLICATION_ID`: The ID of your Discord application (found in the General Information tab of your Discord application)
- `DISCORD_PUBLIC_KEY`: The public key of your Discord application (found slightly lower than the above ID)
- `DISCORD_QUESTION_CHANNEL`: The channel to send the questions button to

You can then run `wrangler publish` to deploy the bot to Cloudflare Workers. You can then add the bot to your Discord server by going to the OAuth2 tab of your Discord application and copying the URL under "Scopes" and "Bot Permissions" into your browser. You can then select the server you want to add the bot to.

Finally, you must set two secrets for your worker.

- `DISCORD_BOT_TOKEN` - The bot token of your Discord application. This can be found in the Bot tab of your Discord application.
- `DISCORD_QUESTIONS_WEBHOOK` - The webhook URL of the channel you want to post questions to. You can create a webhook by right clicking on a channel and selecting Settings -> Integrations -> Webhooks -> New Webhook.
  Each of these can be set via `wrangler secret put <name>`, or in the Cloudflare Dashboard.

For local development, you can put these secrets in a `.dev.vars` file in the root of the project, with the same syntax as a `.env` file. You can then run `wrangler dev` to run the bot locally.
