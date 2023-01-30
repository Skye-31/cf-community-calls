import { Routes, RouteBases, ButtonStyle, ComponentType } from "discord-api-types/v10";

async function deleteMessage(channelId: string, messageId: string, token: string) {
	return await fetch(`${RouteBases.api}${Routes.channelMessage(channelId, messageId)}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bot ${token}`,
		},
	});
}

async function sendModalMessage(channelId: string, token: string) {
	return await fetch(`${RouteBases.api}${Routes.channelMessages(channelId)}`, {
		method: "POST",
		headers: {
			Authorization: `Bot ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content: "Submit Questions Here:",
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
		}),
	});
}

export { deleteMessage, sendModalMessage };
