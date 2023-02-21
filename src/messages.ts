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
			content:
				"Submit Questions for the Community Call Here\n- General questions should not be sent in this channel, and should instead go in the dedicated channels for this",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.Button,
							label: "Send a Community Call Question",
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
