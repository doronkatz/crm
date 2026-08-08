import { describe, expect, it } from "bun:test";
import { fastmailCredentials } from "../src/index";

process.env.API_URL = "https://crm.example.test";

describe("fastmailCredentials", () => {
	describe("FASTMARK_CLIENT_ID", () => {
		it("present → configured when all three vars are set", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("absent → undefined", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			delete process.env.FASTMARK_CLIENT_SECRET;
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(fastmailCredentials()).toBeUndefined();
		});

		it("whitespace trimmed → treated as present", () => {
			process.env.FASTMARK_CLIENT_ID = "  test-client-id  ";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});
	});

	describe("FASTMARK_CLIENT_SECRET", () => {
		it("present → configured when all three vars are set", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("absent → undefined", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			delete process.env.FASTMARK_CLIENT_SECRET;
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(fastmailCredentials()).toBeUndefined();
		});

		it("whitespace trimmed → treated as present", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "  test-client-secret  ";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});
	});

	describe("FASTMARK_REDIRECT_URI", () => {
		it("valid URL → configured when all three vars are set", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("absent → undefined", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			delete process.env.FASTMARK_CLIENT_SECRET;
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(fastmailCredentials()).toBeUndefined();
		});
	});

	describe("configuration states", () => {
		it("all three absent → undefined", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			delete process.env.FASTMARK_CLIENT_SECRET;
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(fastmailCredentials()).toBeUndefined();
		});

		it("all three present → returns credentials object", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("only FASTMARK_CLIENT_ID → throws (partial config)", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			delete process.env.FASTMARK_CLIENT_SECRET;
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});

		it("only FASTMARK_CLIENT_SECRET → throws (partial config)", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});

		it("only FASTMARK_REDIRECT_URI → throws (partial config)", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			delete process.env.FASTMARK_CLIENT_SECRET;
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});

		it("CLIENT_ID and CLIENT_SECRET only → throws (missing redirect)", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			delete process.env.FASTMARK_REDIRECT_URI;
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});

		it("CLIENT_ID and REDIRECT_URI only → throws (missing secret)", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			delete process.env.FASTMARK_CLIENT_SECRET;
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});

		it("CLIENT_SECRET and REDIRECT_URI only → throws (missing ID)", () => {
			delete process.env.FASTMARK_CLIENT_ID;
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(() => fastmailCredentials()).toThrow(
				"FASTMARK_CLIENT_ID, FASTMARK_CLIENT_SECRET, and FASTMARK_REDIRECT_URI must be set together.",
			);
		});
	});

	describe("whitespace trimming", () => {
		it("CLIENT_ID with surrounding whitespace is trimmed", () => {
			process.env.FASTMARK_CLIENT_ID = "  trimmed-client-id  ";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "trimmed-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("CLIENT_SECRET with surrounding whitespace is trimmed", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "  trimmed-client-secret  ";
			process.env.FASTMARK_REDIRECT_URI =
				"http://localhost:3000/api/auth/callback/fastmail";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "trimmed-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});

		it("REDIRECT_URI with surrounding whitespace is trimmed", () => {
			process.env.FASTMARK_CLIENT_ID = "test-client-id";
			process.env.FASTMARK_CLIENT_SECRET = "test-client-secret";
			process.env.FASTMARK_REDIRECT_URI =
				"  http://localhost:3000/api/auth/callback/fastmail  ";
			expect(fastmailCredentials()).toEqual({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				redirectUri:
					"http://localhost:3000/api/auth/callback/fastmail",
			});
		});
	});
});
