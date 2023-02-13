import { ApplicationCommandType, InteractionResponseType } from "discord-api-types/v10";
import respondToInteraction from "../../utils/respond";
import chatInput from "./chat-input";
import message from "./message";
import type {
	APIApplicationCommandInteraction,
	APIChatInputApplicationCommandInteraction,
	APIMessageApplicationCommandInteraction,
} from "discord-api-types/v10";

export default async function (
	interaction: APIApplicationCommandInteraction,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	switch (interaction.data.type) {
		case ApplicationCommandType.ChatInput:
			return chatInput(interaction as APIChatInputApplicationCommandInteraction, env, ctx);
		case ApplicationCommandType.Message: {
			return message(interaction as APIMessageApplicationCommandInteraction, env, ctx);
		}
		default: {
			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: { content: "Unknown command type", flags: 64 },
			});
		}
	}
}
