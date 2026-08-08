export const OPENROUTER_API_KEY = "OPENROUTER_API_KEY";
export const OPENROUTER_BASE_URL = "OPENROUTER_BASE_URL";
export const OPENROUTER_MODEL_NAME = "OPENROUTER_MODEL_NAME";

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL_NAME = "openai/gpt-4o-mini";

export interface OpenRouterConfig {
	baseUrl: string;
	modelName: string;
}

export function isOpenRouterConfigured(): boolean {
	const key = process.env[OPENROUTER_API_KEY];
	return Boolean(key?.trim());
}

export function getOpenRouterConfig(): OpenRouterConfig {
	const baseUrl = process.env[OPENROUTER_BASE_URL]?.trim();
	const modelName = process.env[OPENROUTER_MODEL_NAME]?.trim();
	return {
		baseUrl: baseUrl || DEFAULT_OPENROUTER_BASE_URL,
		modelName: modelName || DEFAULT_OPENROUTER_MODEL_NAME,
	};
}
