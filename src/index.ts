import { InteractionType, InteractionResponseType } from "discord-api-types/v10";
import { createCommands } from "./commands";
import applicationCommand from "./handlers/application-commands";
import messageComponent from "./handlers/message-component";
import modalSubmit from "./handlers/modal-submit";
import { StateManager } from "./state";
import respondToInteraction from "./utils/respond";
import { verify } from "./verifyInteraction";
import type { APIInteraction, APIModalSubmitGuildInteraction } from "discord-api-types/v10";

export { StateManager };

export default <ExportedHandler<Env>>{
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const url = new URL(request.url);
			if (url.pathname === "/set-commands") {
				if (request.method === "POST") {
					return await createCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_BOT_TOKEN)
						.then(() => new Response("Commands created", { status: 200 }))
						.catch((err) => new Response((err as Error).message, { status: 500 }));
				}
			}
		} catch {}

		const unverifiedResponse = new Response("Missing signature", {
			status: 401,
		});

		const signatureTimestamp = request.headers.get("X-Signature-Timestamp");
		const signature = request.headers.get("X-Signature-Ed25519");
		if (request.method !== "POST" || !signature || !signatureTimestamp) return unverifiedResponse;

		const body = await request.text();
		let interaction: APIInteraction;
		try {
			interaction = await verify(signature, signatureTimestamp, env.DISCORD_PUBLIC_KEY, body);
		} catch (err) {
			return new Response((err as Error).message, { status: 401 });
		}

		if (interaction.type === InteractionType.Ping) {
			return respondToInteraction({ type: InteractionResponseType.Pong });
		}
		if (!interaction.guild_id || !interaction.member) {
			return respondToInteraction({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: { content: "Unexpected DM interaction", flags: 64 },
			});
		}

		switch (interaction.type) {
			case InteractionType.ApplicationCommand:
				return applicationCommand(interaction, env, ctx);
			case InteractionType.MessageComponent:
				return messageComponent(interaction);
			case InteractionType.ModalSubmit:
				return modalSubmit(interaction as APIModalSubmitGuildInteraction, env, ctx);
			default:
				return respondToInteraction({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: { content: "Unknown interaction type", flags: 64 },
				});
		}
	},
};
