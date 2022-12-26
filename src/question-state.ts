export type QuestionState = {
	Title: string;
	CmdName: string;
	Color: number;
};

export const Unanswered: QuestionState = {
	Title: "**❓ New Question**",
	CmdName: "Mark Unanswered",
	Color: 0x67efeb,
};

export const Answered: QuestionState = {
	Title: "**✅ Answered Question**",
	CmdName: "Mark Answered",
	Color: 0x80ef67,
};

export const NeedsMoreInfo: QuestionState = {
	Title: "**❗ Needs More Info**",
	CmdName: "Mark Needs More Info",
	Color: 0xefad67,
};

export const Duplicate: QuestionState = {
	Title: "**🔁 Duplicate Question**",
	CmdName: "Mark Duplicate",
	Color: 0xef6767,
};

export const FollowUp: QuestionState = {
	Title: "**🔁 Question Requires Follow Up**",
	CmdName: "Mark as Will Follow Up",
	Color: 0xb667ef,
};

export function GetQuestionStateFromCommandName(commandName: string): QuestionState {
	return (
		{
			"Mark Answered": Answered,
			"Mark Unanswered": Unanswered,
			"Mark Needs More Info": NeedsMoreInfo,
			"Mark Duplicate": Duplicate,
			"Mark as Will Follow Up": FollowUp,
		}[commandName] || Unanswered
	);
}
