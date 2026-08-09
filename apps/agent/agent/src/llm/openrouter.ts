import {
	getOpenRouterConfig,
	isOpenRouterConfigured,
} from "@crm/env/openrouter";

export interface OpenRouterMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface OpenRouterChatCompletionChoice {
	index: number;
	message: { role: string; content: string };
	finish_reason: string;
}

export interface OpenRouterChatCompletion {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: OpenRouterChatCompletionChoice[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface OpenRouterChatCompletionParams {
	model?: string;
	messages: OpenRouterMessage[];
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function createOpenRouterChatCompletion(
	params: OpenRouterChatCompletionParams,
	options: { timeoutMs?: number } = {},
): Promise<OpenRouterChatCompletion | null> {
	if (!isOpenRouterConfigured()) {
		return null;
	}

	const config = getOpenRouterConfig();
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) return null;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const body: Record<string, unknown> = {
		model: params.model ?? config.modelName,
		messages: params.messages,
	};

	if (params.temperature !== undefined) {
		body.temperature = params.temperature;
	}
	if (params.max_tokens !== undefined) {
		body.max_tokens = params.max_tokens;
	}
	if (params.stream !== undefined) {
		body.stream = params.stream;
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!response.ok) {
		throw new Error(
			`OpenRouter API error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json() as Promise<OpenRouterChatCompletion>;
}
