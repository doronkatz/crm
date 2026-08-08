import { describe, expect, it } from "bun:test";
import { parseEnv } from "../src/index";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");

function parseFastmail(source: string): Record<string, string> {
	return parseEnv(source);
}

describe("FASTMARK_CLIENT_ID", () => {
	it("present → parsed correctly", () => {
		const result = parseFastmail("FASTMARK_CLIENT_ID=test-client-id");
		expect(result.FASTMARK_CLIENT_ID).toBe("test-client-id");
	});

	it("absent → not in parsed output", () => {
		const result = parseFastmail("OTHER=value");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_ID");
	});

	it("surrounding whitespace trimmed", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_ID=  trimmed-client-id  ",
		);
		expect(result.FASTMARK_CLIENT_ID).toBe("trimmed-client-id");
	});

	it("tab whitespace trimmed", () => {
		const result = parseFastmail("FASTMARK_CLIENT_ID=\t\ttabbed-id\t");
		expect(result.FASTMARK_CLIENT_ID).toBe("tabbed-id");
	});
});

describe("FASTMARK_CLIENT_SECRET", () => {
	it("present → parsed correctly", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_SECRET=test-client-secret",
		);
		expect(result.FASTMARK_CLIENT_SECRET).toBe("test-client-secret");
	});

	it("absent → not in parsed output", () => {
		const result = parseFastmail("OTHER=value");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_SECRET");
	});

	it("surrounding whitespace trimmed", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_SECRET=  trimmed-secret  ",
		);
		expect(result.FASTMARK_CLIENT_SECRET).toBe("trimmed-secret");
	});

	it("tab whitespace trimmed", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_SECRET=\t\ttabbed-secret\t",
		);
		expect(result.FASTMARK_CLIENT_SECRET).toBe("tabbed-secret");
	});
});

describe("FASTMARK_REDIRECT_URI", () => {
	it("valid URL → parsed correctly", () => {
		const result = parseFastmail(
			"FASTMARK_REDIRECT_URI=http://localhost:3000/api/auth/callback/fastmail",
		);
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"http://localhost:3000/api/auth/callback/fastmail",
		);
	});

	it("https URL → parsed correctly", () => {
		const result = parseFastmail(
			"FASTMARK_REDIRECT_URI=https://app.example.com/api/auth/callback/fastmail",
		);
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"https://app.example.com/api/auth/callback/fastmail",
		);
	});

	it("absent → not in parsed output", () => {
		const result = parseFastmail("OTHER=value");
		expect(result).not.toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("surrounding whitespace trimmed", () => {
		const result = parseFastmail(
			"FASTMARK_REDIRECT_URI=  http://localhost:3000/api/auth/callback/fastmail  ",
		);
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"http://localhost:3000/api/auth/callback/fastmail",
		);
	});
});

describe("all three absent → not configured", () => {
	it("no Fastmail vars present → none in parsed output", () => {
		const result = parseFastmail("DATABASE_URL=postgresql://localhost/crm");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).not.toHaveProperty("FASTMARK_REDIRECT_URI");
	});
});

describe("all three present → configured", () => {
	it("all three vars present → all parsed correctly", () => {
		const source = [
			"FASTMARK_CLIENT_ID=test-client-id",
			"FASTMARK_CLIENT_SECRET=test-client-secret",
			"FASTMARK_REDIRECT_URI=http://localhost:3000/api/auth/callback/fastmail",
		].join("\n");
		const result = parseFastmail(source);
		expect(result.FASTMARK_CLIENT_ID).toBe("test-client-id");
		expect(result.FASTMARK_CLIENT_SECRET).toBe("test-client-secret");
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"http://localhost:3000/api/auth/callback/fastmail",
		);
	});
});

describe("partial config (1 or 2 vars only) → not fully configured", () => {
	it("only FASTMARK_CLIENT_ID → only ID present", () => {
		const result = parseFastmail("FASTMARK_CLIENT_ID=test-client-id");
		expect(result).toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).not.toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("only FASTMARK_CLIENT_SECRET → only secret present", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_SECRET=test-client-secret",
		);
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).not.toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("only FASTMARK_REDIRECT_URI → only URI present", () => {
		const result = parseFastmail(
			"FASTMARK_REDIRECT_URI=http://localhost:3000/api/auth/callback/fastmail",
		);
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("CLIENT_ID and CLIENT_SECRET only → missing redirect URI", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_ID=test-client-id\nFASTMARK_CLIENT_SECRET=test-client-secret",
		);
		expect(result).toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).not.toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("CLIENT_ID and REDIRECT_URI only → missing secret", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_ID=test-client-id\nFASTMARK_REDIRECT_URI=http://localhost:3000/api/auth/callback/fastmail",
		);
		expect(result).toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).toHaveProperty("FASTMARK_REDIRECT_URI");
	});

	it("CLIENT_SECRET and REDIRECT_URI only → missing ID", () => {
		const result = parseFastmail(
			"FASTMARK_CLIENT_SECRET=test-client-secret\nFASTMARK_REDIRECT_URI=http://localhost:3000/api/auth/callback/fastmail",
		);
		expect(result).not.toHaveProperty("FASTMARK_CLIENT_ID");
		expect(result).toHaveProperty("FASTMARK_CLIENT_SECRET");
		expect(result).toHaveProperty("FASTMARK_REDIRECT_URI");
	});
});

describe("whitespace trimming across all three", () => {
	it("all three vars with surrounding whitespace → all trimmed", () => {
		const source = [
			"FASTMARK_CLIENT_ID=  client-id-with-space  ",
			"FASTMARK_CLIENT_SECRET=  secret-with-space  ",
			"FASTMARK_REDIRECT_URI=  http://localhost:3000/api/auth/callback/fastmail  ",
		].join("\n");
		const result = parseFastmail(source);
		expect(result.FASTMARK_CLIENT_ID).toBe("client-id-with-space");
		expect(result.FASTMARK_CLIENT_SECRET).toBe("secret-with-space");
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"http://localhost:3000/api/auth/callback/fastmail",
		);
	});

	it("quoted values inside whitespace → quotes stripped", () => {
		const result = parseFastmail(
			'FASTMARK_CLIENT_ID=  "quoted-id"  \nFASTMARK_CLIENT_SECRET=  \'quoted-secret\'  \nFASTMARK_REDIRECT_URI=  "http://localhost:3000/api/auth/callback/fastmail"  ',
		);
		expect(result.FASTMARK_CLIENT_ID).toBe("quoted-id");
		expect(result.FASTMARK_CLIENT_SECRET).toBe("quoted-secret");
		expect(result.FASTMARK_REDIRECT_URI).toBe(
			"http://localhost:3000/api/auth/callback/fastmail",
		);
	});
});

describe(".env.example Fastmail vars", () => {
	const example = readFileSync(join(repoRoot, ".env.example"), "utf8");

	it("FASTMARK_CLIENT_ID documented", () => {
		expect(example).toContain("FASTMARK_CLIENT_ID=");
	});

	it("FASTMARK_CLIENT_SECRET documented", () => {
		expect(example).toContain("FASTMARK_CLIENT_SECRET=");
	});

	it("FASTMARK_REDIRECT_URI documented", () => {
		expect(example).toContain("FASTMARK_REDIRECT_URI=");
	});
});
