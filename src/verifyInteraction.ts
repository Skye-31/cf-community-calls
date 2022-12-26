import type { APIInteraction } from "discord-api-types/v10";

function hex2bin(hex: string): Uint8Array {
	const bin = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i++) {
		bin[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bin;
}

function getPublicKey(key: string) {
	return crypto.subtle.importKey(
		"raw",
		hex2bin(key),
		{ name: "NODE-ED25519", namedCurve: "NODE-ED25519" },
		true,
		["verify"]
	);
}

export async function verify(ed25519: string, timestamp: string, publicKey: string, body: string) {
	const signature = hex2bin(ed25519);
	const verified = await crypto.subtle.verify(
		"NODE-ED25519",
		await getPublicKey(publicKey),
		signature,
		new TextEncoder().encode(timestamp + body)
	);
	if (!verified) throw new Error("Invalid signature");
	return JSON.parse(body) as APIInteraction;
}
