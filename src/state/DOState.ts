class DOState {
	private readonly state: DurableObjectState;
	private messageId?: string;
	constructor(state: DurableObjectState) {
		this.state = state;
	}
	async fetch(req: Request) {
		switch (req.method) {
			case "GET":
				if (!this.messageId) {
					this.messageId = await this.state.storage.get("messageId");
				}
				if (this.messageId) {
					return new Response(this.messageId);
				}
				return new Response(null, { status: 404 });
			case "PUT":
				this.messageId = await req.text();
				await this.state.storage.put("messageId", this.messageId);
				return new Response(null, { status: 204 });
			case "DELETE":
				this.messageId = undefined;
				await this.state.storage.delete("messageId");
				return new Response(null, { status: 204 });
		}
	}
}

async function getDOState(ChannelDO: DurableObjectNamespace): Promise<string | undefined> {
	return (
		(await (
			await ChannelDO.get(ChannelDO.idFromName("DOState")).fetch("https://do.state", {
				method: "GET",
			})
		).text()) ?? undefined
	);
}

async function setDOState(ChannelDO: DurableObjectNamespace, messageId: string) {
	await ChannelDO.get(ChannelDO.idFromName("DOState")).fetch("https://do.state", {
		method: "PUT",
		body: messageId,
	});
}

async function deleteDOState(ChannelDO: DurableObjectNamespace) {
	await ChannelDO.get(ChannelDO.idFromName("DOState")).fetch("https://do.state", {
		method: "DELETE",
	});
}

export { DOState, getDOState, setDOState, deleteDOState };
