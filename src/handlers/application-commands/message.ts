import { InteractionResponseType, RouteBases, Routes } from "discord-api-types/v10";
import { GetQuestionStateFromCommandName, NeedsMoreInfo } from "../../question-state";
import respondToInteraction from "../../utils/respond";
import type { APIMessageApplicationCommandInteraction } from "discord-api-types/v10";

export default async function (
	interaction: APIMessageApplicationCommandInteraction,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	const { resolved, target_id } = interaction.data;
	const message = resolved?.messages?.[target_id];
	if (message.webhook_id !== GetIDFromWebhook(env.DISCORD_QUESTIONS_WEBHOOK)) {
		return respondToInteraction({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: { content: "Message is not from Community Call Bot", flags: 64 },
		});
	}
	const answerState = GetQuestionStateFromCommandName(interaction.data.name);
	const res = await fetch(`${env.DISCORD_QUESTIONS_WEBHOOK}/messages/${message.id}`, {
		headers: {
			"Content-Type": "application/json",
		},
		method: "PATCH",
		body: JSON.stringify({
			embeds: [
				{
					title: answerState.Title,
					description: message.embeds[0].description,
					color: answerState.Color,
				},
			],
		}),
	});
	if (!res.ok) {
		return respondToInteraction({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `Failed to mark question as answered, received: ${res.status} ${res.statusText}`,
				flags: 64,
			},
		});
	}
	const promises: Promise<unknown>[] = [
		fetch(
			`${RouteBases.api}${Routes.webhookMessage(
				interaction.application_id,
				interaction.token,
				"@original"
			)}`,
			{
				method: "DELETE",
			}
		),
	];
	if (
		answerState.CmdName === NeedsMoreInfo.CmdName &&
		answerState.Title !== message.embeds[0].title &&
		message.thread
	) {
		promises.push(
			// Send a message to the thread asking for more information
			// In this case, the original message ID is the thread ID
			fetch(`${RouteBases.api}${Routes.channelMessages(message.id)}`, {
				headers: {
					Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
					"Content-Type": "application/json",
				},
				method: "POST",
				body: JSON.stringify({
					content: "Please provide more information about your question here.",
				}),
			})
		);
	}
	ctx.waitUntil(Promise.all(promises));
	return respondToInteraction({
		type: InteractionResponseType.ChannelMessageWithSource,
		data: { content: "Done", flags: 64 },
	});
}

function GetIDFromWebhook(webhook: string) {
	const match = webhook.match(/[0-9]{17,19}/);
	if (!match) {
		throw new Error("Invalid webhook URL");
	}
	return match[0];
}
