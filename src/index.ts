import {
	InteractionType,
	InteractionResponseType,
	ApplicationCommandType,
	RouteBases,
	Routes,
	ComponentType,
	ButtonStyle,
	TextInputStyle,
} from "discord-api-types/v10";
import { createCommands } from "./commands";
import { GetQuestionStateFromCommandName, Unanswered } from "./question-state";
import { getState, setState } from "./state";
import { verify } from "./verifyInteraction";
import type {
	APIInteraction,
	APIInteractionResponse,
	APIApplicationCommandInteractionDataBooleanOption,
	APIApplicationCommandInteractionDataChannelOption,
	APIMessage,
	RESTPostAPIWebhookWithTokenJSONBody,
	APIUser,
} from "discord-api-types/v10";

export interface Env {
	DISCORD_APPLICATION_ID: string;
	DISCORD_PUBLIC_KEY: string;
	DISCORD_BOT_TOKEN: string;
	DISCORD_QUESTIONS_WEBHOOK: string;

	Settings: KVNamespace;
}

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

		switch (interaction.type) {
			case InteractionType.Ping:
				return respondToInteraction({ type: InteractionResponseType.Pong });
			case InteractionType.ApplicationCommand:
				switch (interaction.data.type) {
					case ApplicationCommandType.ChatInput:
						switch (interaction.data.name) {
							case "questions": {
								const open = !!(
									interaction.data.options?.find((x) => x.name === "open") as
										| APIApplicationCommandInteractionDataBooleanOption
										| undefined
								)?.value;

								const state = await getState(env.Settings);
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
									const announcement = (
										interaction.data.options?.find((x) => x.name === "announcement-channel") as
											| APIApplicationCommandInteractionDataChannelOption
											| undefined
									)?.value;
									if (!announcement) {
										return respondToInteraction({
											type: InteractionResponseType.ChannelMessageWithSource,
											data: { content: "Please provide an announcement channel", flags: 64 },
										});
									}
									const message = await fetch(
										`${RouteBases.api}${Routes.channelMessages(announcement)}`,
										{
											headers: {
												Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
												"Content-Type": "application/json",
											},
											method: "POST",
											body: JSON.stringify({
												content: "Questions are now open! Ask away!",
												components: [
													{
														type: ComponentType.ActionRow,
														components: [
															{
																type: ComponentType.Button,
																label: "Ask a question",
																style: ButtonStyle.Primary,
																custom_id: "ask-question",
																emoji: {
																	name: "❓",
																},
															},
														],
													},
												],
											} as APIMessage),
										}
									);
									if (!message.ok) {
										return respondToInteraction({
											type: InteractionResponseType.ChannelMessageWithSource,
											data: {
												content: `Failed to send announcement, received: ${message.status} ${message.statusText}`,
												flags: 64,
											},
										});
									}
									state.announcement = {
										channelId: announcement,
										messageId: (await message.json<APIMessage>()).id,
									};
								} else {
									if (state.announcement) {
										await fetch(
											`${RouteBases.api}${Routes.channelMessages(state.announcement.channelId)}/${
												state.announcement.messageId
											}`,
											{
												headers: {
													Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
													"Content-Type": "application/json",
												},
												method: "DELETE",
											}
										);
									}
									state.announcement = undefined;
								}

								state.open = open;
								ctx.waitUntil(setState(env.Settings, state));

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
					case ApplicationCommandType.Message: {
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
						ctx.waitUntil(
							fetch(
								`${RouteBases.api}${Routes.webhookMessage(
									interaction.application_id,
									interaction.token,
									"@original"
								)}`,
								{
									method: "DELETE",
								}
							).then(() => void 0)
						);
						return respondToInteraction({
							type: InteractionResponseType.ChannelMessageWithSource,
							data: { content: "Done", flags: 64 },
						});
					}
					default: {
						return respondToInteraction({
							type: InteractionResponseType.ChannelMessageWithSource,
							data: { content: "Unknown command type", flags: 64 },
						});
					}
				}
			case InteractionType.MessageComponent:
				if (
					interaction.data.component_type === ComponentType.Button &&
					interaction.data.custom_id === "ask-question"
				) {
					// return a modal with a text input
					return respondToInteraction({
						type: InteractionResponseType.Modal,
						data: {
							title: "Ask a question",
							custom_id: "ask-question-modal",
							components: [
								{
									type: ComponentType.ActionRow,
									components: [
										{
											type: ComponentType.TextInput,
											style: TextInputStyle.Paragraph,
											custom_id: "ask-question-input",
											label: "Question",
											placeholder: "What is your question?",
											min_length: 20,
											max_length: 1800,
										},
									],
								},
							],
						},
					});
				}
				return respondToInteraction({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: { content: "Unknown component interaction", flags: 64 },
				});
			case InteractionType.ModalSubmit:
				if (interaction.data.custom_id === "ask-question-modal") {
					const question = interaction.data.components[0].components[0].value;
					const state = await getState(env.Settings);
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
							username: `${interaction.member?.user.username}#${interaction.member?.user.discriminator}`,
							avatar_url: GetUserAvatar(interaction.member?.user as APIUser),
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
					return respondToInteraction({
						type: InteractionResponseType.ChannelMessageWithSource,
						data: {
							content: `Question sent\n\n🔗 [Link](https://discord.com/channels/${interaction.guild_id}/${message.channel_id}/${message.id})`,
							flags: 64,
						},
					});
				}
				return respondToInteraction({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: { content: "Unknown modal interaction", flags: 64 },
				});
			default:
				return respondToInteraction({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: { content: "Unknown interaction type", flags: 64 },
				});
		}
	},
};

function respondToInteraction(body: APIInteractionResponse) {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
}

function GetUserAvatar(user: APIUser) {
	if (!user.avatar) {
		return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
	}
	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

function GetIDFromWebhook(webhook: string) {
	const match = webhook.match(/[0-9]{17,19}/);
	if (!match) {
		throw new Error("Invalid webhook URL");
	}
	return match[0];
}
