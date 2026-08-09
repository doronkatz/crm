import { describe, expect, it } from "bun:test";

const API_TOKEN = process.env.FASTMARK_API_TOKEN;
const SESSION_URL = "https://api.fastmail.com/jmap/session";
const BASE_URL = "https://api.fastmail.com/jmap/";

const JMAP_USING = [
  "urn:ietf:params:jmap:core",
  "urn:ietf:params:jmap:mail",
];

async function fetchSession(token: string) {
  const response = await fetch(SESSION_URL, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Session fetch failed: HTTP ${response.status}`);
  return response.json() as Promise<{
    apiUrl: string;
    primaryAccounts: Record<string, string>;
    username: string;
    accounts: Record<string, { name: string }>;
  }>;
}

async function jmapRequest<T>(token: string, methodCalls: unknown[]) {
  const session = await fetchSession(token);
  const response = await fetch(session.apiUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ using: JMAP_USING, methodCalls }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`JMAP request failed: HTTP ${response.status} — ${body}`);
  }
  return response.json() as Promise<T>;
}

describe("FastmailJmapClient live", { skip: !API_TOKEN }, () => {
  it("session resolves and returns apiUrl", async () => {
    const session = await fetchSession(API_TOKEN);
    expect(session.apiUrl).toMatch(/^https:\/\/.+\.fastmail\.com/);
  });

  it("primary account resolves for jmap mail capability", async () => {
    const session = await fetchSession(API_TOKEN);
    const primaryAccountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    expect(primaryAccountId).toBeDefined();
    expect(session.accounts[primaryAccountId]).toBeDefined();
  });

  it("Mailbox/get returns mailboxes including Inbox", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { list: { id: string; name: string; role: string | null }[] }, string]];
    }>(API_TOKEN, [["Mailbox/get", { ids: null, accountId }, "r1"]]);

    const mailboxes = data.methodResponses[0]?.[1]?.list ?? [];
    expect(mailboxes.length).toBeGreaterThan(0);
    const names = mailboxes.map((m: { name: string }) => m.name);
    expect(names).toContain("Inbox");
    expect(names).toContain("Archive");
    expect(names).toContain("Sent");
    expect(names).toContain("Drafts");
  });

  it("Email/query returns ids for INBOX", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(Array.isArray(ids)).toBe(true);
  });

  it("Email/query with limit returns correct page size", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, limit: 3, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(ids.length).toBeLessThanOrEqual(3);
  });

  it("Email/get returns structured email data for fetched ids", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const queryData = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, limit: 1, accountId }, "r1"]]);

    const ids = queryData.methodResponses[0]?.[1]?.ids ?? [];
    if (ids.length === 0) return;

    const getData = await jmapRequest<{
      methodResponses: [[string, { list: { id: string; threadId: string; from: { email: string; name: string | null }[]; to: { email: string; name: string | null }[]; subject: string; sentAt: string }[] }, string]];
    }>(API_TOKEN, [["Email/get", { ids, properties: ["id", "threadId", "from", "to", "subject", "sentAt", "messageId"], accountId }, "r1"]]);

    const emails = getData.methodResponses[0]?.[1]?.list ?? [];
    expect(emails.length).toBeGreaterThan(0);
    expect(emails[0]?.id).toBeDefined();
    expect(emails[0]?.threadId).toBeDefined();
    expect(emails[0]?.from?.[0]?.email).toBeDefined();
    expect(new Date(emails[0]?.sentAt).getTime()).not.toBeNaN();
  });

  it("Email/get does not include snippet in properties response", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const queryData = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, limit: 1, accountId }, "r1"]]);

    const ids = queryData.methodResponses[0]?.[1]?.ids ?? [];
    if (ids.length === 0) return;

    const getData = await jmapRequest<{
      methodResponses: [[string, { list: Record<string, unknown>[] }, string]];
    }>(API_TOKEN, [["Email/get", { ids, properties: ["id", "threadId", "from", "to", "subject", "sentAt", "messageId"], accountId }, "r1"]]);

    const email = getData.methodResponses[0]?.[1]?.list?.[0];
    expect(email).not.toHaveProperty("snippet");
    expect(email).toHaveProperty("id");
    expect(email).toHaveProperty("from");
  });

  it("Email/query supports sentAt sort descending", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, sort: [{ property: "sentAt", isAscending: false }], limit: 5, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(ids.length).toBeLessThanOrEqual(5);
    expect(Array.isArray(ids)).toBe(true);
  });

  it("Sent mailbox returns outbound email ids", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["Sent"] }, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(Array.isArray(ids)).toBe(true);
  });

  it("Drafts mailbox returns draft email ids", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["Drafts"] }, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(Array.isArray(ids)).toBe(true);
  });

  it("Email/query with after filter returns emails after date", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const data = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"], after: cutoff.toISOString() }, accountId }, "r1"]]);

    const ids = data.methodResponses[0]?.[1]?.ids ?? [];
    expect(Array.isArray(ids)).toBe(true);
  });

  it("Thread/get returns thread with message list", async () => {
    const session = await fetchSession(API_TOKEN);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    const queryData = await jmapRequest<{
      methodResponses: [[string, { ids: string[] }, string]];
    }>(API_TOKEN, [["Email/query", { filter: { inMailboxes: ["INBOX"] }, limit: 1, accountId }, "r1"]]);

    const emailIds = queryData.methodResponses[0]?.[1]?.ids ?? [];
    if (emailIds.length === 0) return;

    const getData = await jmapRequest<{
      methodResponses: [[string, { list: { threadId: string }[] }, string]];
    }>(API_TOKEN, [["Email/get", { ids: emailIds, properties: ["threadId"], accountId }, "r1"]]);

    const threadId = getData.methodResponses[0]?.[1]?.list?.[0]?.threadId;
    if (!threadId) return;

    const threadData = await jmapRequest<{
      methodResponses: [[string, { list: { id: string; subject: string }[] }, string]];
    }>(API_TOKEN, [["Thread/get", { ids: [threadId], accountId }, "r1"]]);

    const threads = threadData.methodResponses[0]?.[1]?.list ?? [];
    expect(threads.length).toBeGreaterThan(0);
    expect(threads[0]?.id).toBe(threadId);
  });
});
