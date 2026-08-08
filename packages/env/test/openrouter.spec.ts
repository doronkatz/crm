import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	DEFAULT_OPENROUTER_BASE_URL,
	DEFAULT_OPENROUTER_MODEL_NAME,
	getOpenRouterConfig,
	isOpenRouterConfigured,
} from "../src/openrouter";

const SAVED: Record<string, string | undefined> = {
	OPENROUTER_API_KEY: undefined,
	OPENROUTER_BASE_URL: undefined,
	OPENROUTER_MODEL_NAME: undefined,
};

beforeEach(() => {
	for (const key of Object.keys(SAVED) as (keyof typeof SAVED)[]) {
		SAVED[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of Object.keys(SAVED) as (keyof typeof SAVED)[]) {
		if (SAVED[key] === undefined) delete process.env[key];
		else process.env[key] = SAVED[key];
	}
});

describe("isOpenRouterConfigured", () => {
	it("returns false when OPENROUTER_API_KEY is absent", () => {
		delete process.env.OPENROUTER_API_KEY;
		expect(isOpenRouterConfigured()).toBe(false);
	});

	it("returns true when OPENROUTER_API_KEY is present", () => {
		process.env.OPENROUTER_API_KEY = "sk-or-test-key";
		expect(isOpenRouterConfigured()).toBe(true);
	});

	it("returns false when OPENROUTER_API_KEY is only whitespace", () => {
		process.env.OPENROUTER_API_KEY = "   \t\n";
		expect(isOpenRouterConfigured()).toBe(false);
	});

	it("trims whitespace around the API key", () => {
		process.env.OPENROUTER_API_KEY = "  sk-or-test-key  ";
		expect(isOpenRouterConfigured()).toBe(true);
	});

	it("returns false when OPENROUTER_API_KEY is an empty string", () => {
		process.env.OPENROUTER_API_KEY = "";
		expect(isOpenRouterConfigured()).toBe(false);
	});

	it("returns false when all OpenRouter env vars are absent", () => {
		delete process.env.OPENROUTER_API_KEY;
		delete process.env.OPENROUTER_BASE_URL;
		delete process.env.OPENROUTER_MODEL_NAME;
		expect(isOpenRouterConfigured()).toBe(false);
	});
});

describe("getOpenRouterConfig", () => {
	it("returns the default base URL when OPENROUTER_BASE_URL is absent", () => {
		delete process.env.OPENROUTER_BASE_URL;
		expect(getOpenRouterConfig().baseUrl).toBe(DEFAULT_OPENROUTER_BASE_URL);
	});

	it("returns a custom base URL when OPENROUTER_BASE_URL is set", () => {
		process.env.OPENROUTER_BASE_URL = "https://custom.openrouter.ai/api/v1";
		expect(getOpenRouterConfig().baseUrl).toBe(
			"https://custom.openrouter.ai/api/v1",
		);
	});

	it("returns the default model name when OPENROUTER_MODEL_NAME is absent", () => {
		delete process.env.OPENROUTER_MODEL_NAME;
		expect(getOpenRouterConfig().modelName).toBe(DEFAULT_OPENROUTER_MODEL_NAME);
	});

	it("returns a custom model name when OPENROUTER_MODEL_NAME is set", () => {
		process.env.OPENROUTER_MODEL_NAME = "anthropic/claude-3-haiku";
		expect(getOpenRouterConfig().modelName).toBe("anthropic/claude-3-haiku");
	});

	it("treats partial config (API key only) as configured via isOpenRouterConfigured", () => {
		process.env.OPENROUTER_API_KEY = "sk-or-test";
		delete process.env.OPENROUTER_BASE_URL;
		delete process.env.OPENROUTER_MODEL_NAME;
		expect(isOpenRouterConfigured()).toBe(true);
		expect(getOpenRouterConfig().baseUrl).toBe(DEFAULT_OPENROUTER_BASE_URL);
		expect(getOpenRouterConfig().modelName).toBe(
			DEFAULT_OPENROUTER_MODEL_NAME,
		);
	});

	it("uses defaults for baseUrl and modelName even when only API key is present", () => {
		process.env.OPENROUTER_API_KEY = "sk-or-v2";
		const config = getOpenRouterConfig();
		expect(config.baseUrl).toBe("https://openrouter.ai/api/v1");
		expect(config.modelName).toBe("openai/gpt-4o-mini");
	});
});
