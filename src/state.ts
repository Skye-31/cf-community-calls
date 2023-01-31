export interface State {
	open: boolean;
	questionChannelMessageId?: string;
}

class StateManager {
	private readonly durableState: DurableObjectState;
	private state?: State;
	constructor(durableState: DurableObjectState) {
		this.durableState = durableState;
	}
	async fetch(req: Request) {
		switch (req.method) {
			case "GET":
				if (!this.state) {
					this.state = await this.durableState.storage.get("state");
				}
				if (!this.state) {
					this.state = { open: false };
					await this.durableState.storage.put("state", this.state);
				}
				return new Response(JSON.stringify(this.state));
			case "PUT":
				await this.durableState.blockConcurrencyWhile(async () => {
					this.state = await req.json<State>();
					await this.durableState.storage.put("state", this.state);
				});
				return new Response(null, { status: 204 });
			default:
				return new Response(null, { status: 405 });
		}
	}
}

async function getState(ChannelDO: DurableObjectNamespace): Promise<State> {
	const doResponse = await ChannelDO.get(ChannelDO.idFromName("DOState")).fetch(
		"https://do.state",
		{
			method: "GET",
		}
	);
	return await doResponse.json<State>();
}

async function setState(ChannelDO: DurableObjectNamespace, state: State) {
	await ChannelDO.get(ChannelDO.idFromName("DOState")).fetch("https://do.state", {
		method: "PUT",
		body: JSON.stringify(state),
	});
}

export { StateManager, getState, setState };
