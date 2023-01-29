import {
	InteractionType,
	InteractionResponseType,
	ApplicationCommandType,
	RouteBases,
	Routes,
	ComponentType,
	TextInputStyle,
} from "discord-api-types/v10";
import { createCommands } from "./commands";
import { sendModalMessage, deleteMessage } from "./messages";
import { GetQuestionStateFromCommandName, NeedsMoreInfo, Unanswered } from "./question-state";
import { getKVState, setKVState, DOState, getDOState, setDOState, deleteDOState } from "./state";
import { verify } from "./verifyInteraction";
import type {
	APIInteraction,
	APIInteractionResponse,
	APIApplicationCommandInteractionDataBooleanOption,
	APIApplicationCommandInteractionDataChannelOption,
	APIInteractionGuildMember,
	APIMessage,
	RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";

export interface Env {
	DISCORD_APPLICATION_ID: string;
	DISCORD_PUBLIC_KEY: string;
	DISCORD_BOT_TOKEN: string;
	DISCORD_QUESTIONS_WEBHOOK: string;
	DISCORD_QUESTION_CHANNEL: string;
	ChannelDO: DurableObjectNamespace;
	Settings: KVNamespace;
}

export { DOState };

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
		} catch { }

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
				switch (interaction.data.type) {
					case ApplicationCommandType.ChatInput:
						switch (interaction.data.name) {
							case "questions": {
								const open = !!(
									interaction.data.options?.find((x) => x.name === "open") as
									| APIApplicationCommandInteractionDataBooleanOption
									| undefined
								)?.value;

								const state = await getKVState(env.Settings);
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
									const [message, qMessage] = await Promise.all([sendModalMessage(announcement, env.DISCORD_BOT_TOKEN), sendModalMessage(
										env.DISCORD_QUESTION_CHANNEL,
										env.DISCORD_BOT_TOKEN
									)]);
									if (!message.ok) {
										return respondToInteraction({
											type: InteractionResponseType.ChannelMessageWithSource,
											data: {
												content: `Failed to send announcement, received: ${message.status} ${message.statusText}`,
												flags: 64,
											},
										});
									}
									if (qMessage.ok) {
										await setDOState(env.ChannelDO, (await qMessage.json<APIMessage>()).id);
									} else {
										console.error(`Failed to send in question channel, received: ${qMessage.status} ${qMessage.statusText}`);
									}
									state.announcement = {
										channelId: announcement,
										messageId: (await message.json<APIMessage>()).id,
									};
								} else {
									if (state.announcement) {
										await deleteMessage(
											state.announcement.channelId,
											state.announcement.messageId,
											env.DISCORD_BOT_TOKEN
										);
									}
									state.announcement = undefined;
									const questionId = await getDOState(env.ChannelDO);
									if (questionId) {
										await deleteMessage(
											env.DISCORD_QUESTION_CHANNEL,
											questionId,
											env.DISCORD_BOT_TOKEN
										);
										ctx.waitUntil(deleteDOState(env.ChannelDO));
									}
								}

								state.open = open;
								ctx.waitUntil(setKVState(env.Settings, state));

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
						if (answerState.CmdName === NeedsMoreInfo.CmdName) {
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
						ctx.waitUntil(
							// We have to temporarily add `.then() => {})` to make the promise return void due to workers types being broken
							Promise.all(promises).then(() => { })
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
								{
									type: ComponentType.ActionRow,
									components: [
										{
											type: ComponentType.TextInput,
											style: TextInputStyle.Paragraph,
											custom_id: "thread-name-input",
											label: "Thread name",
											placeholder: "What should I name your discussion thread?",
											min_length: 5,
											max_length: 20,
											required: false,
										},
									],
								}
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
					const components = interaction.data.components[0];
					const { question, threadName } = components.components.reduce((a, b) => {
						if (b.custom_id === "ask-question-input") {
							a.question = b.value;
						}
						if (b.custom_id === "thread-name-input") {
							a.threadName = b.value;
						}
						return a;
					}, {} as { question: string, threadName: string });
					const state = await getKVState(env.Settings);
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
							username: interaction.member?.nick ?? `${interaction.member?.user.username}#${interaction.member?.user.discriminator}`,
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
					const [thread, lastModalMessage] = await Promise.all([
						// Create a thread from this message, asking the user for more information
						fetch(`${RouteBases.api}${Routes.threads(message.channel_id, message.id)}`, {
							headers: {
								Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							method: "POST",
							body: JSON.stringify({
								name: threadName ?? question.substring(0, 17) + "...",
							}),
						}),
						getDOState(env.ChannelDO)
					]);
					const promises = [];
					if (thread.ok) {
						promises.push(fetch(`${RouteBases.api}${Routes.channelMessages(message.id)}`, {
							headers: {
								Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							method: "POST",
							body: JSON.stringify({
								content: `Question posted by: <@${interaction.member?.user.id}>`,
							}),
						}));
					}
					if (lastModalMessage) {
						promises.push(deleteMessage(
							env.DISCORD_QUESTION_CHANNEL,
							lastModalMessage,
							env.DISCORD_BOT_TOKEN
						));
					}
					await Promise.all(promises);
					const modalMessage = await sendModalMessage(
						env.DISCORD_QUESTION_CHANNEL,
						env.DISCORD_BOT_TOKEN
					);
					if (modalMessage.ok) {
						await setDOState(env.ChannelDO, (await modalMessage.json<APIMessage>()).id);
					}
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

function GetIDFromWebhook(webhook: string) {
	const match = webhook.match(/[0-9]{17,19}/);
	if (!match) {
		throw new Error("Invalid webhook URL");
	}
	return match[0];
}
