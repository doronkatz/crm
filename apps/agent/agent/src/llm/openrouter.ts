import { isOpenRouterConfigured, getOpenRouterConfig } from "@crm/env/openrouter";

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

export async function createOpenRouterChatCompletion(
	params: OpenRouterChatCompletionParams,
): Promise<OpenRouterChatCompletion | null> {
	if (!isOpenRouterConfigured()) {
		return null;
	}

	const config = getOpenRouterConfig();
	const apiKey = process.env.OPENROUTER_API_KEY!;

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

	const response = await fetch(
		`${config.baseUrl}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`OpenRouter API error: ${response.status} ${response.statusText} — ${text}`,
		);
	}

	return response.json() as Promise<OpenRouterChatCompletion>;
}
