interface Env {
	DISCORD_APPLICATION_ID: string;
	DISCORD_PUBLIC_KEY: string;
	DISCORD_BOT_TOKEN: string;
	DISCORD_QUESTIONS_WEBHOOK: string;
	DISCORD_QUESTION_CHANNEL: string;
	StateManager: DurableObjectNamespace;
}
