import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import nock from "nock";
import {
	createOpenRouterChatCompletion,
	type OpenRouterMessage,
} from "../agent/src/llm/openrouter";

const BASE_URL = "https://openrouter.ai/api/v1";
const CHAT_COMPLETIONS_PATH = "/chat/completions";

const savedEnv = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
	delete process.env.OPENROUTER_API_KEY;
	delete process.env.OPENROUTER_BASE_URL;
	delete process.env.OPENROUTER_MODEL_NAME;
});

afterEach(() => {
	process.env.OPENROUTER_API_KEY = savedEnv;
	nock.cleanAll();
});

describe("createOpenRouterChatCompletion", () => {
	it("returns null when OPENROUTER_API_KEY is not set", async () => {
		const result = await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "hello" }],
		});
		expect(result).toBeNull();
	});

	it("returns null when OPENROUTER_API_KEY is blank", async () => {
		process.env.OPENROUTER_API_KEY = "   ";
		const result = await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "hello" }],
		});
		expect(result).toBeNull();
	});

	it("calls OpenRouter with correct URL and headers", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";
		process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
		process.env.OPENROUTER_MODEL_NAME = "openai/gpt-4o-mini";

		const scope = nock(BASE_URL)
			.post(CHAT_COMPLETIONS_PATH)
			.reply(200, {
				id: "chatcmpl-test",
				object: "chat.completion",
				created: 1234567890,
				model: "openai/gpt-4o-mini",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "Hello!" },
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				},
			});

		const messages: OpenRouterMessage[] = [
			{ role: "user", content: "Hello" },
		];
		const result = await createOpenRouterChatCompletion({ messages });

		expect(result).not.toBeNull();
		expect(result!.model).toBe("openai/gpt-4o-mini");
		expect(result!.choices[0].message.content).toBe("Hello!");
		expect(scope.isDone()).toBe(true);
	});

	it("uses default model when OPENROUTER_MODEL_NAME is not set", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";
		delete process.env.OPENROUTER_MODEL_NAME;

		let receivedBody: unknown;
		const scope = nock(BASE_URL)
			.post(CHAT_COMPLETIONS_PATH, (body) => {
				receivedBody = body;
				return true;
			})
			.reply(200, {
				id: "chatcmpl-default",
				object: "chat.completion",
				created: 1234567890,
				model: "openai/gpt-4o-mini",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "Response" },
						finish_reason: "stop",
					},
				],
			});

		await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "Hi" }],
		});

		expect(receivedBody).toHaveProperty("model", "openai/gpt-4o-mini");
		expect(scope.isDone()).toBe(true);
	});

	it("uses custom model when OPENROUTER_MODEL_NAME is set", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";
		process.env.OPENROUTER_MODEL_NAME = "anthropic/claude-3-haiku";

		let receivedBody: unknown;
		const scope = nock(BASE_URL)
			.post(CHAT_COMPLETIONS_PATH, (body) => {
				receivedBody = body;
				return true;
			})
			.reply(200, {
				id: "chatcmpl-custom",
				object: "chat.completion",
				created: 1234567890,
				model: "anthropic/claude-3-haiku",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "Custom model response" },
						finish_reason: "stop",
					},
				],
			});

		await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "Hi" }],
		});

		expect(receivedBody).toHaveProperty("model", "anthropic/claude-3-haiku");
		expect(scope.isDone()).toBe(true);
	});

	it("passes temperature and max_tokens to OpenRouter", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";

		let receivedBody: unknown;
		const scope = nock(BASE_URL)
			.post(CHAT_COMPLETIONS_PATH, (body) => {
				receivedBody = body;
				return true;
			})
			.reply(200, {
				id: "chatcmpl-opts",
				object: "chat.completion",
				created: 1234567890,
				model: "openai/gpt-4o-mini",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "Done" },
						finish_reason: "stop",
					},
				],
			});

		await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "Hello" }],
			temperature: 0.7,
			max_tokens: 256,
		});

		expect(receivedBody).toHaveProperty("temperature", 0.7);
		expect(receivedBody).toHaveProperty("max_tokens", 256);
		expect(scope.isDone()).toBe(true);
	});

	it("throws on non-ok response", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";

		nock(BASE_URL).post(CHAT_COMPLETIONS_PATH).reply(401, {
			error: { message: "Invalid API key" },
		});

		await expect(
			createOpenRouterChatCompletion({
				messages: [{ role: "user", content: "Hello" }],
			}),
		).rejects.toThrow(/OpenRouter API error: 401/);
	});

	it("returns usage information from response", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";

		nock(BASE_URL).post(CHAT_COMPLETIONS_PATH).reply(200, {
			id: "chatcmpl-usage",
			object: "chat.completion",
			created: 1234567890,
			model: "openai/gpt-4o-mini",
			choices: [
				{
					index: 0,
					message: { role: "assistant", content: "Hi there" },
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: 8,
				completion_tokens: 3,
				total_tokens: 11,
			},
		});

		const result = await createOpenRouterChatCompletion({
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(result).not.toBeNull();
		expect(result!.usage).toEqual({
			prompt_tokens: 8,
			completion_tokens: 3,
			total_tokens: 11,
		});
	});
});

describe("selectedModel with OpenRouter", () => {
	it("returns OpenRouter model and context window when configured", async () => {
		process.env.OPENROUTER_API_KEY = "sk-or-testkey";
		process.env.OPENROUTER_MODEL_NAME = "openai/gpt-4o-mini";

		const { selectedModel } = await import("../agent/lib/model");
		const result = await selectedModel();

		expect(result).toEqual({
			model: "openai/gpt-4o-mini",
			modelContextWindowTokens: 128_000,
		});
	});

	it("returns null from DB when OpenRouter is not configured", async () => {
		delete process.env.OPENROUTER_API_KEY;

		const { selectedModel } = await import("../agent/lib/model");
		const result = await selectedModel();

		expect(result).toBeNull();
	});
});
