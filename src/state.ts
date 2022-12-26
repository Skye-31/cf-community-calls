export type State = {
	open: boolean;
	announcement?: {
		messageId: string;
		channelId: string;
	};
};

const DefaultState = { open: false };

export async function getState(kv: KVNamespace): Promise<State> {
	return (await kv.get("state", "json")) ?? DefaultState;
}

export async function setState(kv: KVNamespace, state: State): Promise<void> {
	await kv.put("state", JSON.stringify(state));
}
