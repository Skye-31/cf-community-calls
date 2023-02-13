import { InteractionResponseType, RouteBases, Routes } from "discord-api-types/v10";
import { deleteMessage, sendModalMessage } from "../messages";
import { Unanswered } from "../question-state";
import { getState, setState } from "../state";
import respondToInteraction from "../utils/respond";
import type {
	APIMessage,
	APIModalSubmitGuildInteraction,
	RESTPostAPIWebhookWithTokenJSONBody,
	APIInteractionGuildMember,
} from "discord-api-types/v10";

export default async function (
	interaction: APIModalSubmitGuildInteraction,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	if (interaction.data.custom_id === "ask-question-modal") {
		const components = interaction.data.components;
		const { question, threadName } = components.reduce((a, b) => {
			const subComponent = b.components[0];
			if (subComponent.custom_id === "ask-question-input") {
				a.question = subComponent.value;
			}
			if (subComponent.custom_id === "thread-name-input") {
				a.threadName = subComponent.value;
			}
			return a;
		}, {} as { question: string; threadName: string });
		const state = await getState(env.StateManager);
		if (!state.open) {
			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: { content: "Questions are closed", flags: 64 },
			});
		}
		const res = await fetch(env.DISCORD_QUESTIONS_WEBHOOK + "?wait=true", {
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify({
				embeds: [
					{
						title: Unanswered.Title,
						description: question,
						color: Unanswered.Color,
					},
				],
				username:
					interaction.member?.nick ??
					`${interaction.member?.user.username}#${interaction.member.user.discriminator}`,
				avatar_url: GetMemberAvatar(interaction.member, interaction.guild_id),
			} as RESTPostAPIWebhookWithTokenJSONBody),
		});
		if (res.status !== 200) {
			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: `Failed to send question: ${res.status} ${res.statusText}`,
					flags: 64,
				},
			});
		}
		const message = await res.json<APIMessage>();
		// Create a thread from this message, asking the user for more information
		const thread = await fetch(
			`${RouteBases.api}${Routes.threads(message.channel_id, message.id)}`,
			{
				headers: {
					Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
					"Content-Type": "application/json",
				},
				method: "POST",
				body: JSON.stringify({
					name: threadName || question.substring(0, 17) + "...",
				}),
			}
		);
		const promises = [];
		if (thread.ok) {
			promises.push(
				fetch(`${RouteBases.api}${Routes.threadMembers(message.id, interaction.member.user.id)}`, {
					headers: {
						Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					method: "PUT",
				})
			);
		}
		if (state.questionChannelMessageId) {
			promises.push(
				deleteMessage(
					env.DISCORD_QUESTION_CHANNEL,
					state.questionChannelMessageId,
					env.DISCORD_BOT_TOKEN
				)
			);
			state.questionChannelMessageId = undefined;
		}
		ctx.waitUntil(Promise.all(promises));
		const modalMessage = await sendModalMessage(
			env.DISCORD_QUESTION_CHANNEL,
			env.DISCORD_BOT_TOKEN
		);
		if (modalMessage.ok) {
			state.questionChannelMessageId = (await modalMessage.json<APIMessage>()).id;
		}
		ctx.waitUntil(setState(env.StateManager, state));
		return respondToInteraction({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `Question sent`,
				flags: 64,
			},
		});
	}
	return respondToInteraction({
		type: InteractionResponseType.ChannelMessageWithSource,
		data: { content: "Unknown modal interaction", flags: 64 },
	});
}

function GetMemberAvatar(member: APIInteractionGuildMember, guildId: string): string {
	const user = member.user;
	if (member.avatar) {
		return `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.png`;
	} else if (member.user.avatar) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
	} else {
		return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
	}
}
