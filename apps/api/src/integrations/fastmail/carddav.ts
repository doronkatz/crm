import { Injectable, Logger } from "@nestjs/common";
import { MailboxResult } from "../../mailbox/mailbox-api.client";

const CARDDAV_BASE = "https://carddav.fastmail.com/dav/";
const WELL_KNOWN = "https://carddav.fastmail.com/.well-known/carddav/";

export interface CrmContact {
  uid: string;
  fullName: string;
  firstName: string;
  lastName: string;
  emails: { email: string; type?: string }[];
  phones: { phone: string; type?: string }[];
  addresses: { street: string; city: string; region: string; postcode: string; country: string; type?: string }[];
}

interface VCardParseResult {
  fn?: string;
  n?: { familyName: string; givenName: string };
  email?: { value: string; type?: string }[];
  tel?: { value: string; type?: string }[];
  adr?: { street: string; city: string; region: string; postcode: string; country: string; type?: string }[];
}

@Injectable()
export class FastmailCarddavClient {
  private readonly logger = new Logger(FastmailCarddavClient.name);

  private buildAuthHeader(accessToken: string): string {
    const credentials = `oauth2:${accessToken}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  private async request<T>(
    method: string,
    url: string,
    accessToken: string,
    options: {
      body?: string;
      headers?: Record<string, string>;
      expectedStatus?: number[];
    } = {},
  ): Promise<MailboxResult<T>> {
    const {
      body,
      headers = {},
      expectedStatus = [200, 201, 204],
    } = options;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          authorization: this.buildAuthHeader(accessToken),
          "content-type": "text/vcard; charset=utf-8",
          ...headers,
        },
        body,
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

      if (!expectedStatus.includes(response.status)) {
        const text = await response.text().catch(() => "");
        return {
          outcome: "failed",
          reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          retryable: response.status >= 500,
        };
      }

      if (response.status === 204) {
        return { outcome: "ok", data: undefined as T };
      }

      const data = await response.text();
      return { outcome: "ok", data: data as unknown as T };
    } catch (error) {
      return {
        outcome: "failed",
        reason: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }

  private async discoverAddressBookHome(accessToken: string): Promise<MailboxResult<string>> {
    const result = await this.request<string>("GET", WELL_KNOWN, accessToken, {
      headers: { "content-type": "application/xml" },
    });

    if (result.outcome !== "ok") return result;

    const principalMatch = result.data.match(/<d:principal-URL>([^<]+)<\/d:principal-URL>/i);
    if (!principalMatch) {
      return { outcome: "failed", reason: "No principal URL in CardDAV response", retryable: false };
    }

    const principalUrl = principalMatch[1];
    const addressBookHomeResult = await this.request<string>("PROPFIND", principalUrl, accessToken, {
      headers: {
        "content-type": "application/xml",
        Depth: "1",
      },
    });

    if (addressBookHomeResult.outcome !== "ok") return addressBookHomeResult;

    const setMatch = addressBookHomeResult.data.match(/<carddav:addressbook-home-set>[^<]*<d:href>([^<]+)<\/d:href>/i);
    if (!setMatch) {
      return { outcome: "failed", reason: "No addressbook-home-set in CardDAV response", retryable: false };
    }

    const homeSet = setMatch[1];
    const base = CARDDAV_BASE.endsWith("/") ? CARDDAV_BASE : `${CARDDAV_BASE}/`;
    const addressBookHome = homeSet.startsWith("http") ? homeSet : `${base.replace(/\/dav\/.*/, "")}${homeSet}`;

    return { outcome: "ok", data: addressBookHome };
  }

  private async listAddressBooks(accessToken: string): Promise<MailboxResult<string[]>> {
    const homeResult = await this.discoverAddressBookHome(accessToken);
    if (homeResult.outcome !== "ok") return homeResult;

    const result = await this.request<string>("PROPFIND", homeResult.data, accessToken, {
      headers: {
        "content-type": "application/xml",
        Depth: "1",
      },
    });

    if (result.outcome !== "ok") return result;

    const hrefMatches = result.data.matchAll(/<d:href>([^<]+)<\/d:href>/gi);
    const addresses: string[] = [];
    const base = CARDDAV_BASE.endsWith("/") ? CARDDAV_BASE : `${CARDDAV_BASE}/`;

    for (const match of hrefMatches) {
      const href = match[1];
      if (href.includes("/addressbook/") || href.match(/\/\d+\/$/)) {
        const url = href.startsWith("http") ? href : `${base.replace(/\/dav\/.*/, "")}${href}`;
        addresses.push(url);
      }
    }

    if (addresses.length === 0) {
      return { outcome: "ok", data: [homeResult.data] };
    }

    return { outcome: "ok", data: addresses };
  }

  private parseVCard(vcard: string): VCardParseResult {
    const lines = vcard.split(/\r?\n/);
    const result: VCardParseResult = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const keyPart = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1).trim();

      const parts = keyPart.split(";");
      const prop = parts[0].toUpperCase();

      switch (prop) {
        case "FN":
          result.fn = value;
          break;
        case "N":
          if (value) {
            const components = value.split(";").map((s) => s.trim());
            result.n = {
              familyName: components[0] || "",
              givenName: components[1] || "",
            };
          }
          break;
        case "EMAIL":
          if (!result.email) result.email = [];
          result.email.push({ value, type: parts.find((p) => p.startsWith("TYPE="))?.replace("TYPE=", "") });
          break;
        case "TEL":
          if (!result.phones) result.phones = [];
          result.phones.push({ value, type: parts.find((p) => p.startsWith("TYPE="))?.replace("TYPE=", "") });
          break;
        case "ADR":
          if (!result.addresses) result.addresses = [];
          const adrComponents = value.split(";").map((s) => s.trim());
          result.addresses.push({
            street: adrComponents[2] || "",
            city: adrComponents[3] || "",
            region: adrComponents[4] || "",
            postcode: adrComponents[5] || "",
            country: adrComponents[6] || "",
            type: parts.find((p) => p.startsWith("TYPE="))?.replace("TYPE=", ""),
          });
          break;
      }
    }

    return result;
  }

  private mapVCardToCrmContact(vcard: string, uid: string): CrmContact {
    const parsed = this.parseVCard(vcard);
    const fullName = parsed.fn || "";
    const nameParts = fullName.split(" ");
    const firstName = parsed.n?.givenName || nameParts[0] || "";
    const lastName = parsed.n?.familyName || nameParts.slice(1).join(" ") || "";

    return {
      uid,
      fullName,
      firstName,
      lastName,
      emails: (parsed.email || []).map((e) => ({ email: e.value, type: e.type })),
      phones: (parsed.tel || []).map((t) => ({ phone: t.value, type: t.type })),
      addresses: parsed.addresses || [],
    };
  }

  private buildVCard(contact: Partial<CrmContact>, existingUid?: string): string {
    const uid = existingUid || contact.uid || crypto.randomUUID();
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `UID:${uid}`];

    if (contact.fullName) lines.push(`FN:${contact.fullName}`);
    if (contact.firstName || contact.lastName) {
      lines.push(`N:${contact.lastName || ""};${contact.firstName || ""};;;`);
    }

    for (const email of contact.emails || []) {
      const type = email.type ? `;TYPE=${email.type}` : "";
      lines.push(`EMAIL${type}:${email.email}`);
    }

    for (const phone of contact.phones || []) {
      const type = phone.type ? `;TYPE=${phone.type}` : "";
      lines.push(`TEL${type}:${phone.phone}`);
    }

    for (const addr of contact.addresses || []) {
      const type = addr.type ? `;TYPE=${addr.type}` : "";
      lines.push(
        `ADR${type}:;;${addr.street || ""};${addr.city || ""};${addr.region || ""};${addr.postcode || ""};${addr.country || ""}`,
      );
    }

    lines.push("END:VCARD");
    return lines.join("\r\n");
  }

  async fetchContacts(accessToken: string): Promise<MailboxResult<CrmContact[]>> {
    const addressBooksResult = await this.listAddressBooks(accessToken);
    if (addressBooksResult.outcome !== "ok") return addressBooksResult;

    const allContacts: CrmContact[] = [];

    for (const addressBook of addressBooksResult.data) {
      const result = await this.request<string>("PROPFIND", addressBook, accessToken, {
        headers: {
          "content-type": "application/xml",
          Depth: "1",
        },
      });

      if (result.outcome !== "ok") continue;

      const hrefMatches = result.data.matchAll(/<d:href>([^<]+)<\/d:href>/gi);
      const vcardUrls: { href: string; url: string }[] = [];
      const base = CARDDAV_BASE.endsWith("/") ? CARDDAV_BASE : `${CARDDAV_BASE}/`;

      for (const match of hrefMatches) {
        const href = match[1];
        if (href.endsWith(".vcf")) {
          const url = href.startsWith("http") ? href : `${base.replace(/\/dav\/.*/, "")}${href}`;
          vcardUrls.push({ href, url });
        }
      }

      for (const { url } of vcardUrls) {
        const uid = url.split("/").pop()?.replace(".vcf", "") || "";
        const vcardResult = await this.request<string>("GET", url, accessToken);
        if (vcardResult.outcome === "ok" && vcardResult.data) {
          allContacts.push(this.mapVCardToCrmContact(vcardResult.data, uid));
        }
      }
    }

    return { outcome: "ok", data: allContacts };
  }

  async createContact(
    accessToken: string,
    contact: Omit<CrmContact, "uid">,
  ): Promise<MailboxResult<{ uid: string }>> {
    const addressBooksResult = await this.listAddressBooks(accessToken);
    if (addressBooksResult.outcome !== "ok") return addressBooksResult;

    const addressBook = addressBooksResult.data[0];
    const uid = crypto.randomUUID();
    const vcard = this.buildVCard({ ...contact, uid });

    const result = await this.request(
      "PUT",
      `${addressBook.replace(/\/$/, "")}/${uid}.vcf`,
      accessToken,
      {
        body: vcard,
        expectedStatus: [201],
      },
    );

    if (result.outcome !== "ok") return result;
    return { outcome: "ok", data: { uid } };
  }

  async updateContact(
    accessToken: string,
    uid: string,
    contact: Partial<CrmContact>,
  ): Promise<MailboxResult<void>> {
    const addressBooksResult = await this.listAddressBooks(accessToken);
    if (addressBooksResult.outcome !== "ok") return addressBooksResult;

    const addressBook = addressBooksResult.data[0];
    const vcardResult = await this.request<string>(
      "GET",
      `${addressBook.replace(/\/$/, "")}/${uid}.vcf`,
      accessToken,
    );

    if (vcardResult.outcome !== "ok") return vcardResult;

    const existing = this.mapVCardToCrmContact(vcardResult.data, uid);
    const merged = { ...existing, ...contact, uid };
    const vcard = this.buildVCard(merged, uid);

    const result = await this.request("PUT", `${addressBook.replace(/\/$/, "")}/${uid}.vcf`, accessToken, {
      body: vcard,
      expectedStatus: [200, 204],
    });

    if (result.outcome !== "ok") return result;
    return { outcome: "ok", data: undefined };
  }

  async deleteContact(accessToken: string, uid: string): Promise<MailboxResult<void>> {
    const addressBooksResult = await this.listAddressBooks(accessToken);
    if (addressBooksResult.outcome !== "ok") return addressBooksResult;

    const addressBook = addressBooksResult.data[0];
    const result = await this.request("DELETE", `${addressBook.replace(/\/$/, "")}/${uid}.vcf`, accessToken, {
      expectedStatus: [200, 204],
    });

    if (result.outcome !== "ok") return result;
    return { outcome: "ok", data: undefined };
  }
}
