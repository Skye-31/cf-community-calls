import { InteractionResponseType } from "discord-api-types/v10";
import { sendModalMessage, deleteMessage } from "../../messages";
import { getState, setState } from "../../state";
import respondToInteraction from "../../utils/respond";
import type {
	APIApplicationCommandInteractionDataBooleanOption,
	APIChatInputApplicationCommandInteraction,
	APIMessage,
} from "discord-api-types/v10";

export default async function (
	interaction: APIChatInputApplicationCommandInteraction,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	switch (interaction.data.name) {
		case "questions": {
			const open = (
				interaction.data.options?.[0] as APIApplicationCommandInteractionDataBooleanOption
			).value;

			const state = await getState(env.StateManager);
			if (state.open === open) {
				return respondToInteraction({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: {
						content: `Questions are already ${open ? "open" : "closed"}`,
						flags: 64,
					},
				});
			}
			if (open) {
				const message = await sendModalMessage(env.DISCORD_QUESTION_CHANNEL, env.DISCORD_BOT_TOKEN);
				if (!message.ok) {
					return respondToInteraction({
						type: InteractionResponseType.ChannelMessageWithSource,
						data: {
							content: `Failed to send announcement, received: ${message.status} ${message.statusText}`,
							flags: 64,
						},
					});
				}
				state.questionChannelMessageId = (await message.json<APIMessage>()).id;
			} else if (state.questionChannelMessageId) {
				await deleteMessage(
					env.DISCORD_QUESTION_CHANNEL,
					state.questionChannelMessageId,
					env.DISCORD_BOT_TOKEN
				);
				state.questionChannelMessageId = undefined;
			}

			state.open = open;
			ctx.waitUntil(setState(env.StateManager, state));

			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: { content: `Questions are ${open ? "open" : "closed"}`, flags: 64 },
			});
		}
		default:
			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: { content: "Unknown command name", flags: 64 },
			});
	}
}
