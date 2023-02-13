import type { APIInteractionResponse } from "discord-api-types/v10";

export default function (body: APIInteractionResponse) {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
}
