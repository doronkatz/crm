import { Injectable, Logger } from "@nestjs/common";
import { MailboxResult } from "../../mailbox/mailbox-api.client";

const SESSION_URL = "https://api.fastmail.com/jmap/session";
const BASE_URL = "https://api.fastmail.com/jmap/";

export interface CrmEmail {
  id: string;
  threadId: string;
  mailboxId: string;
  direction: "inbound" | "outbound";
  fromEmail: string;
  fromName: string | null;
  recipients: { email: string; name: string | null; kind: string }[];
  subject: string;
  body: string | null;
  snippet: string | null;
  sentAt: Date;
  messageId: string | null;
}

interface JmapSession {
  coreAccounts: { apiUrl: string; accountId: string }[];
  primaryAccounts: Record<string, { accountId: string }>;
}

interface JmapEmail {
  id: string;
  threadId: string;
  mailboxId: string;
  from: { name: string | null; email: string }[];
  to: { name: string | null; email: string }[];
  cc: { name: string | null; email: string }[];
  bcc: { name: string | null; email: string }[];
  subject: string;
  body: { value: string; type: string } | null;
  preview: string | null;
  sentAt: string;
  messageId: string | null;
}

interface JmapQueryResponse {
  methodResponses: [
    [string, Record<string, unknown>, string]
  ][];
}

interface JmapEmailGetResponse {
  methodResponses: [
    [string, { list: JmapEmail[]; notFound: string[] }, string]
  ][];
}

@Injectable()
export class FastmailJmapClient {
  private readonly logger = new Logger(FastmailJmapClient.name);

  private async getApiUrl(accessToken: string): Promise<string> {
    const response = await fetch(SESSION_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JMAP session: HTTP ${response.status}`);
    }

    const session = (await response.json()) as JmapSession;
    const account = session.coreAccounts[0];

    if (!account?.apiUrl) {
      throw new Error("JMAP session missing apiUrl");
    }

    return account.apiUrl;
  }

  private async jmapRequest<T>(
    accessToken: string,
    methodCalls: unknown[],
  ): Promise<MailboxResult<T>> {
    try {
      const apiUrl = await this.getApiUrl(accessToken);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ methodCalls }),
      });

      if (response.status === 401) {
        return { outcome: "unauthorized", reason: "Invalid or expired token" };
      }

      if (response.status === 429) {
        return {
          outcome: "rate-limited",
          reason: "Rate limited",
          retryAfterMs: 60_000,
        };
      }

      if (!response.ok) {
        return {
          outcome: "failed",
          reason: `HTTP ${response.status}`,
          retryable: response.status >= 500,
        };
      }

      const data = (await response.json()) as JmapQueryResponse | JmapEmailGetResponse;
      const firstResponse = data.methodResponses?.[0];

      if (!firstResponse) {
        return { outcome: "failed", reason: "Empty JMAP response", retryable: false };
      }

      const [, responseData] = firstResponse;

      if ("error" in responseData) {
        return {
          outcome: "failed",
          reason: (responseData as { error: string }).error,
          retryable: false,
        };
      }

      return { outcome: "ok", data: data as T };
    } catch (error) {
      return {
        outcome: "failed",
        reason: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }

  private mapJmapEmails(emails: JmapEmail[]): CrmEmail[] {
    return emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      mailboxId: email.mailboxId,
      direction: "inbound" as const,
      fromEmail: email.from?.[0]?.email ?? "",
      fromName: email.from?.[0]?.name ?? null,
      recipients: [
        ...(email.to ?? []).map((r) => ({ email: r.email, name: r.name, kind: "to" as const })),
        ...(email.cc ?? []).map((r) => ({ email: r.email, name: r.name, kind: "cc" as const })),
        ...(email.bcc ?? []).map((r) => ({ email: r.email, name: r.name, kind: "bcc" as const })),
      ],
      subject: email.subject ?? "",
      body: email.body?.value ?? null,
      snippet: email.preview ?? null,
      sentAt: new Date(email.sentAt),
      messageId: email.messageId,
    }));
  }

  async fetchInbox(
    accessToken: string,
    options: { limit?: number; after?: Date } = {},
  ): Promise<MailboxResult<CrmEmail[]>> {
    const filter = {
      inMailboxes: ["INBOX"],
      ...(options.after ? { after: options.after.toISOString() } : {}),
    };

    const result = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/query",
        {
          filter,
          sort: [{ property: "sentAt", isAscending: false }],
          limit: options.limit ?? 100,
          accountId: "primary",
        },
        "r1",
      ],
      [
        "Email/get",
        {
          ids: [],
          properties: [
            "id",
            "threadId",
            "mailboxId",
            "from",
            "to",
            "cc",
            "bcc",
            "subject",
            "body",
            "preview",
            "sentAt",
            "messageId",
          ],
          accountId: "primary",
        },
        "r2",
      ],
    ]);

    if (result.outcome !== "ok") return result;

    const queryResult = result.data.methodResponses[0]?.[1] as { ids?: string[] };
    const ids = queryResult?.ids ?? [];

    if (ids.length === 0) return { outcome: "ok", data: [] };

    const getResult = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/get",
        {
          ids,
          properties: [
            "id",
            "threadId",
            "mailboxId",
            "from",
            "to",
            "cc",
            "bcc",
            "subject",
            "body",
            "preview",
            "sentAt",
            "messageId",
          ],
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (getResult.outcome !== "ok") return getResult;

    const emails = getResult.data.methodResponses[0]?.[1]?.list ?? [];
    return { outcome: "ok", data: this.mapJmapEmails(emails) };
  }

  async fetchSent(
    accessToken: string,
    options: { limit?: number; after?: Date } = {},
  ): Promise<MailboxResult<CrmEmail[]>> {
    const filter = {
      inMailboxes: ["Sent"],
      ...(options.after ? { after: options.after.toISOString() } : {}),
    };

    const result = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/query",
        {
          filter,
          sort: [{ property: "sentAt", isAscending: false }],
          limit: options.limit ?? 100,
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (result.outcome !== "ok") return result;

    const ids = (result.data.methodResponses[0]?.[1] as { ids?: string[] })?.ids ?? [];

    if (ids.length === 0) return { outcome: "ok", data: [] };

    const getResult = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/get",
        {
          ids,
          properties: [
            "id",
            "threadId",
            "mailboxId",
            "from",
            "to",
            "cc",
            "bcc",
            "subject",
            "body",
            "preview",
            "sentAt",
            "messageId",
          ],
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (getResult.outcome !== "ok") return getResult;

    const emails = getResult.data.methodResponses[0]?.[1]?.list ?? [];
    return {
      outcome: "ok",
      data: this.mapJmapEmails(emails).map((e) => ({ ...e, direction: "outbound" as const })),
    };
  }

  async fetchDrafts(
    accessToken: string,
    options: { limit?: number } = {},
  ): Promise<MailboxResult<CrmEmail[]>> {
    const result = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/query",
        {
          filter: { inMailboxes: ["Drafts"] },
          sort: [{ property: "sentAt", isAscending: false }],
          limit: options.limit ?? 50,
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (result.outcome !== "ok") return result;

    const ids = (result.data.methodResponses[0]?.[1] as { ids?: string[] })?.ids ?? [];

    if (ids.length === 0) return { outcome: "ok", data: [] };

    const getResult = await this.jmapRequest<JmapEmailGetResponse>(accessToken, [
      [
        "Email/get",
        {
          ids,
          properties: [
            "id",
            "threadId",
            "mailboxId",
            "from",
            "to",
            "cc",
            "bcc",
            "subject",
            "body",
            "preview",
            "sentAt",
            "messageId",
          ],
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (getResult.outcome !== "ok") return getResult;

    const emails = getResult.data.methodResponses[0]?.[1]?.list ?? [];
    return { outcome: "ok", data: this.mapJmapEmails(emails) };
  }

  async sendEmail(accessToken: string, params: {
    from: { email: string; name?: string };
    to: { email: string; name?: string }[];
    cc?: { email: string; name?: string }[];
    subject: string;
    body: string;
  }): Promise<MailboxResult<{ messageId: string }>> {
    const envelope = {
      mailFrom: { email: params.from.email, name: params.from.name },
      rcptTo: [
        ...params.to.map((r) => ({ email: r.email, name: r.name })),
        ...(params.cc ?? []).map((r) => ({ email: r.email, name: r.name })),
      ],
    };

    const email = {
      from: [{ email: params.from.email, name: params.from.name }],
      to: params.to.map((r) => ({ email: r.email, name: r.name })),
      ...(params.cc ? { cc: params.cc.map((r) => ({ email: r.email, name: r.name })) } : {}),
      subject: params.subject,
      body: [{ type: "text/plain", value: params.body }],
    };

    const result = await this.jmapRequest<{
      methodResponses: [[string, { created?: { ["*"]: { id: string } } }, string]][];
    }>(accessToken, [
      [
        "EmailSubmission/set",
        {
          create: {
            "new-email": {
              email,
              envelope,
            },
          },
          accountId: "primary",
        },
        "r1",
      ],
    ]);

    if (result.outcome !== "ok") return result;

    const submission = result.data.methodResponses[0]?.[1]?.created;
    const created = submission?.["*"];

    if (!created) {
      return { outcome: "failed", reason: "Email submission failed", retryable: false };
    }

    return { outcome: "ok", data: { messageId: created.id } };
  }
}
