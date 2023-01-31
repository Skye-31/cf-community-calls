import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	PermissionFlagsBits,
	RouteBases,
	Routes,
} from "discord-api-types/v10";
import { Unanswered, Answered, NeedsMoreInfo, Duplicate, FollowUp } from "./question-state";
import type { APIApplicationCommand } from "discord-api-types/v10";

type ApplicationCommandCreate = Omit<APIApplicationCommand, "id" | "application_id" | "version">;

const ManageMessages = PermissionFlagsBits.ManageMessages.toString();

const commands: ApplicationCommandCreate[] = [
	{
		name: "questions",
		description: "Manage whether the Questions channel is open or closed",
		type: ApplicationCommandType.ChatInput,
		options: [
			{
				name: "open",
				description: "Open the Questions channel",
				type: ApplicationCommandOptionType.Boolean,
				required: true,
			},
		],
		default_member_permissions: ManageMessages,
		dm_permission: false,
	},
	{
		name: Answered.CmdName,
		description: "", // message commands don't have descriptions
		type: ApplicationCommandType.Message,
		default_member_permissions: ManageMessages,
	},
	{
		name: Unanswered.CmdName,
		description: "", // message commands don't have descriptions
		type: ApplicationCommandType.Message,
		default_member_permissions: ManageMessages,
	},
	{
		name: NeedsMoreInfo.CmdName,
		description: "", // message commands don't have descriptions
		type: ApplicationCommandType.Message,
		default_member_permissions: ManageMessages,
	},
	{
		name: Duplicate.CmdName,
		description: "", // message commands don't have descriptions
		type: ApplicationCommandType.Message,
		default_member_permissions: ManageMessages,
	},
	{
		name: FollowUp.CmdName,
		description: "", // message commands don't have descriptions
		type: ApplicationCommandType.Message,
		default_member_permissions: ManageMessages,
	},
];

export async function createCommands(applicationID: string, token: string) {
	const response = await fetch(`${RouteBases.api}${Routes.applicationCommands(applicationID)}`, {
		method: "PUT",
		headers: {
			Authorization: `Bot ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(commands),
	});
	const text = await response.text();
	if (response.status !== 200) {
		console.error(text);
		throw new Error(`Failed to create commands: ${text}`);
	}
}
