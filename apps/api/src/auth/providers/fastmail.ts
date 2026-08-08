import { GOOGLE_PROVIDER_ID, MICROSOFT_PROVIDER_ID } from "@crm/auth";

export const FASTMAIL_PROVIDER_ID = "fastmail";

export const FASTMARK_SCOPES = ["email"] as const;

export const FASTMARK_PROVIDER_IDS = [
	GOOGLE_PROVIDER_ID,
	MICROSOFT_PROVIDER_ID,
	FASTMAIL_PROVIDER_ID,
] as const;

export type FastmailProviderId = (typeof FASTMARK_PROVIDER_IDS)[number];
