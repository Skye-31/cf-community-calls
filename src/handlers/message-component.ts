import { ComponentType, InteractionResponseType, TextInputStyle } from "discord-api-types/v10";
import respondToInteraction from "../utils/respond";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";

export default function (interaction: APIMessageComponentInteraction): Response {
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
								custom_id: "thread-name-input",
								label: "Thread name",
								placeholder: "What should I name your discussion thread?",
								min_length: 5,
								max_length: 20,
								required: false,
							},
						],
					},
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
}
