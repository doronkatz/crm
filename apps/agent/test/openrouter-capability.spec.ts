import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	CONTEXT_DEV,
	capabilitiesFrom,
	enabled,
} from "../agent/lib/capabilities";

const KEYS = [
	"OPENROUTER_API_KEY",
	"OPENROUTER_BASE_URL",
	"OPENROUTER_MODEL_NAME",
] as const;

const saved: Record<string, string | undefined> = {} as Record<
	(string | typeof KEYS[number]),
	string | undefined
>;

beforeEach(() => {
	for (const key of KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
});

describe("OpenRouter capability", () => {
	it("is absent when OPENROUTER_API_KEY is not set", async () => {
		delete process.env.OPENROUTER_API_KEY;
		const caps = capabilitiesFrom(null);
		const openrouter = caps.find((c) => c.id === "OPENROUTER_API_KEY");
		expect(openrouter?.enabled).toBe(false);
		expect(await enabled("OPENROUTER_API_KEY")).toBe(false);
	});

	it("is present when OPENROUTER_API_KEY is set", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-test-key";
		const caps = capabilitiesFrom(null);
		const openrouter = caps.find((c) => c.id === "OPENROUTER_API_KEY");
		expect(openrouter?.enabled).toBe(true);
		expect(await enabled("OPENROUTER_API_KEY")).toBe(true);
	});

	it("treats blank and whitespace-only OPENROUTER_API_KEY as absent", async () => {
		process.env.OPENROUTER_API_KEY = "   \t";
		expect(await enabled("OPENROUTER_API_KEY")).toBe(false);
		process.env.OPENROUTER_API_KEY = "";
		expect(await enabled("OPENROUTER_API_KEY")).toBe(false);
	});
});

describe("OpenRouter model name", () => {
	it("defaults to openai/gpt-4o-mini when OPENROUTER_MODEL_NAME is not set", () => {
		delete process.env.OPENROUTER_MODEL_NAME;
		process.env.OPENROUTER_API_KEY = "sk-or-v2";
		expect(process.env.OPENROUTER_MODEL_NAME).toBeUndefined();
	});

	it("reflects a custom model when OPENROUTER_MODEL_NAME is set", () => {
		process.env.OPENROUTER_MODEL_NAME = "anthropic/claude-3-haiku";
		expect(process.env.OPENROUTER_MODEL_NAME).toBe("anthropic/claude-3-haiku");
	});
});

describe("Context.dev backward compatibility", () => {
	it("Context.dev is still available as a setting when OpenRouter is not configured", () => {
		delete process.env.OPENROUTER_API_KEY;
		const caps = capabilitiesFrom(null);
		const contextDev = caps.find((c) => c.id === CONTEXT_DEV);
		expect(contextDev?.enabled).toBe(false);
		expect(contextDev?.from).toBe("Settings → General");
	});

	it("Context.dev is on when a key is stored, independent of OpenRouter", () => {
		process.env.OPENROUTER_API_KEY = "sk-or-v2";
		const caps = capabilitiesFrom("ctx-stored-key");
		const contextDev = caps.find((c) => c.id === CONTEXT_DEV);
		expect(contextDev?.enabled).toBe(true);
		expect(contextDev?.from).toBe("Settings → General");
	});
});
