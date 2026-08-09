import { db } from "@crm/db";
import { readAgentModel } from "@crm/db/settings";
import { getOpenRouterConfig, isOpenRouterConfigured } from "@crm/env/openrouter";

export interface ModelSelection {
	model: string;
	modelContextWindowTokens: number;
}

export async function selectedModel(): Promise<ModelSelection | null> {
	if (isOpenRouterConfigured()) {
		const config = getOpenRouterConfig();
		return {
			model: config.modelName,
			modelContextWindowTokens: 128_000,
		};
	}

	try {
		const setting = await readAgentModel(db);

		if (setting.isDefault) return null;

		return {
			model: setting.id,
			modelContextWindowTokens: setting.contextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}
