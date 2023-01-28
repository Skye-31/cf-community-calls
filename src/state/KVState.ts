export type KVState = {
	open: boolean;
	announcement?: {
		messageId: string;
		channelId: string;
	};
};

const DefaultKVState = { open: false };

export async function getKVState(kv: KVNamespace): Promise<KVState> {
	return (await kv.get("state", "json")) ?? DefaultKVState;
}

export async function setKVState(kv: KVNamespace, state: KVState): Promise<void> {
	await kv.put("state", JSON.stringify(state));
}
