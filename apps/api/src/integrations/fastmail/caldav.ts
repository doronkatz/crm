import { Injectable, Logger } from "@nestjs/common";

const CALDAV_BASE = "https://caldav.fastmail.com/dav";
const WELL_KNOWN = "https://caldav.fastmail.com/.well-known/caldav";

export type CrmCalendarEvent = {
  iCalUid: string;
  title: string | null;
  description: string | null;
  location: string | null;
  conferenceUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  status: string;
  organizerEmail: string | null;
  recurringEventId: string | null;
  originalStartTime: Date;
  rrule: string | null;
  attendees: Array<{ email: string; displayName: string | null; responseStatus: string }>;
};

type CalDavResult<T> =
  | { outcome: "ok"; data: T }
  | { outcome: "unauthorized"; reason: string }
  | { outcome: "failed"; reason: string; retryable: boolean };

@Injectable()
export class FastmailCalDavClient {
  private readonly logger = new Logger(FastmailCalDavClient.name);

  private basicAuth(accessToken: string): string {
    return `Basic ${Buffer.from(`oauth2:${accessToken}`).toString("base64")}`;
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
  ): Promise<CalDavResult<T>> {
    const { body, headers = {}, expectedStatus = [200, 207, 204] } = options;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          authorization: this.basicAuth(accessToken),
          "content-type": "application/xml",
          ...headers,
        },
        body,
      });

      if (response.status === 401) {
        return { outcome: "unauthorized", reason: "CalDAV auth failed" };
      }

      if (!expectedStatus.includes(response.status)) {
        const text = await response.text().catch(() => "");
        this.logger.warn({
          message: "CalDAV request failed",
          method,
          url,
          status: response.status,
          body: text.slice(0, 500),
        });
        return {
          outcome: "failed",
          reason: `HTTP ${response.status}`,
          retryable: response.status >= 500,
        };
      }

      if (response.status === 204 || response.status === 204) {
        return { outcome: "ok", data: undefined as unknown as T };
      }

      const text = await response.text();
      return { outcome: "ok", data: this.parseXml(text) as T };
    } catch (error) {
      return {
        outcome: "failed",
        reason: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }

  private parseXml(text: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const responseMatches = text.matchAll(/<D:response[^>]*>([\s\S]*?)<\/D:response>/gi);
    const responses: unknown[] = [];
    for (const match of responseMatches) {
      responses.push(this.parseXmlNode(match[1]));
    }
    if (responses.length > 0) result["D:response"] = responses;
    return result;
  }

  private parseXmlNode(xml: string): Record<string, unknown> {
    const node: Record<string, unknown> = {};
    const propMatches = xml.matchAll(/<D:prop>([\s\S]*?)<\/D:prop>/gi);
    for (const match of propMatches) {
      const propContent = match[1];
      const keyMatch = propContent.match(/<([dD]:[\w-]+)>([\s\S]*?)<\/\1>/);
      if (keyMatch) {
        node[keyMatch[1]] = keyMatch[2].trim();
      }
    }
    const hrefMatch = xml.match(/<D:href>([\s\S]*?)<\/D:href>/i);
    if (hrefMatch) node["D:href"] = hrefMatch[1].trim();
    const statusMatch = xml.match(/<D:status>([\s\S]*?)<\/D:status>/i);
    if (statusMatch) node["D:status"] = statusMatch[1].trim();
    const resourcetypeMatch = xml.match(/<D:resourcetype>([\s\S]*?)<\/D:resourcetype>/i);
    if (resourcetypeMatch) node["D:resourcetype"] = this.parseXmlNode(resourcetypeMatch[1]);
    return node;
  }

  async discoverPrincipalUrl(accessToken: string): Promise<CalDavResult<string>> {
    const result = await this.request<unknown>( "GET", WELL_KNOWN, accessToken, {});
    if (result.outcome !== "ok") return result;

    const data = result.data as Record<string, unknown>;
    const response = data["d:response"] ?? data["D:response"] ?? data["response"];
    if (!response) return { outcome: "failed", reason: "No DAV response in well-known", retryable: false };

    const resp = Array.isArray(response) ? response[0] : response;
    const href = (resp as Record<string, unknown>)["d:href"] ?? (resp as Record<string, unknown>)["D:href"];
    const hrefVal = typeof href === "object" && href !== null ? (href as Record<string, unknown>)["#text"] ?? String(href) : String(href);

    return { outcome: "ok", data: hrefVal };
  }

  async fetchCalendars(accessToken: string): Promise<CalDavResult<string[]>> {
    const result = await this.request<unknown>("GET", `${CALDAV_BASE}/`, accessToken, {});
    if (result.outcome !== "ok") return result;

    const data = result.data as Record<string, unknown>;
    const responses = this.flattenResponses(data);
    const calendarUrls: string[] = [];

    for (const resp of responses) {
      const resourcetype = (resp as Record<string, unknown>)["d:resourcetype"] ?? (resp as Record<string, unknown>)["D:resourcetype"];
      if (!resourcetype) continue;

      const rt = typeof resourcetype === "object" && resourcetype !== null ? resourcetype as Record<string, unknown> : {};
      const collection = rt["d:collection"] ?? rt["D:collection"];
      if (!collection) continue;

      const href = String((resp as Record<string, unknown>)["d:href"] ?? (resp as Record<string, unknown>)["D:href"] ?? "");
      if (href.includes("/calendar/") || href.includes("/calendars/")) {
        calendarUrls.push(href.startsWith("http") ? href : `${CALDAV_BASE}${href}`);
      }
    }

    return { outcome: "ok", data: calendarUrls };
  }

  async fetchEvents(
    accessToken: string,
    calendarId: string,
    timeMin?: Date,
    timeMax?: Date,
  ): Promise<CalDavResult<CrmCalendarEvent[]>> {
    const calendarUrl = calendarId.startsWith("http") ? calendarId : `${CALDAV_BASE}${calendarId}`;

    const filterXml = this.buildTimeRangeFilter(timeMin, timeMax);

    const result = await this.request<string>(
      "REPORT",
      calendarUrl,
      accessToken,
      { body: filterXml, headers: { "depth": "1", "content-type": "application/xml" } },
    );

    if (result.outcome !== "ok") return result as CalDavResult<CrmCalendarEvent[]>;
    return { outcome: "ok", data: this.extractEventsFromReport(result.data as unknown) };
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: Partial<CrmCalendarEvent>,
  ): Promise<CalDavResult<{ href: string; etag: string }>> {
    const calendarUrl = calendarId.startsWith("http") ? calendarId : `${CALDAV_BASE}${calendarId}`;
    const uid = event.iCalUid || crypto.randomUUID();
    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = this.buildVevent(uid, now, event);

    const result = await this.request<string>(
      "PUT",
      `${calendarUrl}${uid}.ics`,
      accessToken,
      { body: ics, headers: { "content-type": "text/calendar; charset=utf-8" } },
    );

    if (result.outcome !== "ok") return result as CalDavResult<{ href: string; etag: string }>;

    return {
      outcome: "ok",
      data: { href: `${calendarUrl}${uid}.ics`, etag: "" },
    };
  }

  async updateEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CrmCalendarEvent>,
  ): Promise<CalDavResult<{ href: string; etag: string }>> {
    const eventUrl = eventId.startsWith("http") ? eventId : `${CALDAV_BASE}${eventId}`;
    const uid = event.iCalUid || this.extractUidFromPath(eventId);
    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = this.buildVevent(uid, now, event);

    const result = await this.request<string>(
      "PUT",
      eventUrl,
      accessToken,
      { body: ics, headers: { "content-type": "text/calendar; charset=utf-8" } },
    );

    if (result.outcome !== "ok") return result as CalDavResult<{ href: string; etag: string }>;

    return {
      outcome: "ok",
      data: { href: eventUrl, etag: "" },
    };
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<CalDavResult<void>> {
    const eventUrl = eventId.startsWith("http") ? eventId : `${CALDAV_BASE}${eventId}`;

    const result = await this.request<void>("DELETE", eventUrl, accessToken, {
      headers: { "content-type": "text/calendar; charset=utf-8" },
    });

    return result as CalDavResult<void>;
  }

  private buildTimeRangeFilter(timeMin?: Date, timeMax?: Date): string {
    const comps: string[] = [];
    if (timeMin) comps.push(`<c:start${timeMin.toISOString()}>`);
    if (timeMax) comps.push(`<c:end${timeMax.toISOString()}>`);

    const timeFilter = comps.length > 0
      ? `<c:time-range start="${timeMin?.toISOString() ?? ""}" end="${timeMax?.toISOString() ?? ""}"/>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        ${timeFilter}
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
  }

  private buildVevent(uid: string, now: string, event: Partial<CrmCalendarEvent>): string {
    const dtstart = this.formatIcalDate(event.startsAt, event.isAllDay);
    const dtend = this.formatIcalDate(event.endsAt, event.isAllDay);
    const dtstamp = now;
    const summary = this.escapeIcal(event.title ?? "Busy");
    const description = event.description ? this.escapeIcal(event.description) : "";
    const location = event.location ? this.escapeIcal(event.location) : "";
    const rrule = event.rrule ? `\nRRULE:${event.rrule}` : "";
    const organizer = event.organizerEmail ? `ORGANIZER;CN="":mailto:${event.organizerEmail}` : "";

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CRM//Fastmail CalDAV//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART${event.isAllDay ? ";VALUE=DATE" : ""}:${dtstart}
DTEND${event.isAllDay ? ";VALUE=DATE" : ""}:${dtend}
SUMMARY:${summary}
${description}DESCRIPTION:${description}
${location}LOCATION:${location}
${organizer}${rrule}
END:VEVENT
END:VCALENDAR`;
  }

  private formatIcalDate(date: Date | undefined, isAllDay: boolean | undefined): string {
    if (!date) return "";
    if (isAllDay) {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    }
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  private escapeIcal(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  private extractUidFromPath(path: string): string {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(".ics", "");
  }

  private flattenResponses(data: unknown): unknown[] {
    if (!data || typeof data !== "object") return [];
    const d = data as Record<string, unknown>;

    const responses: unknown[] = [];
    const keys = Object.keys(d);

    for (const key of keys) {
      const val = d[key];
      if (key.toLowerCase().endsWith("response") || key === "response") {
        if (Array.isArray(val)) {
          responses.push(...val);
        } else if (val) {
          responses.push(val);
        }
      }
    }

    return responses;
  }

  private extractEventsFromReport(data: unknown): CrmCalendarEvent[] {
    const responses = this.flattenResponses(data as Record<string, unknown>);
    const events: CrmCalendarEvent[] = [];

    for (const resp of responses) {
      const r = resp as Record<string, unknown>;
      const calendarData = r["d:calendar-data"] ?? r["D:calendar-data"] ?? r["calendar-data"];
      if (!calendarData) continue;

      const cdText = typeof calendarData === "object"
        ? String((calendarData as Record<string, unknown>)["#text"] ?? "")
        : String(calendarData);

      const event = this.parseIcal(cdText);
      if (event) events.push(event);
    }

    return events;
  }

  private parseIcal(text: string): CrmCalendarEvent | null {
    const lines = text.split(/\r?\n/);
    const event: Partial<CrmCalendarEvent> = {
      attendees: [],
      rrule: null,
    };

    let currentKey = "";
    let currentValue = "";
    const multiValue: Array<{ key: string; value: string }> = [];

    for (const raw of lines) {
      if (raw.startsWith(" ") || raw.startsWith("\t")) {
        currentValue += raw.slice(1);
      } else {
        if (currentKey) {
          multiValue.push({ key: currentKey, value: currentValue });
        }
        const colonIdx = raw.indexOf(":");
        if (colonIdx === -1) { currentKey = ""; currentValue = raw; continue; }
        currentKey = raw.slice(0, colonIdx).toUpperCase();
        currentValue = raw.slice(colonIdx + 1);
      }
    }
    if (currentKey) multiValue.push({ key: currentKey, value: currentValue });

    for (const { key, value } of multiValue) {
      const parts = key.split(";");
      const k = parts[0];

      switch (k) {
        case "UID":
          event.iCalUid = value;
          break;
        case "DTSTART": {
          event.isAllDay = key.includes("VALUE=DATE");
          event.startsAt = this.parseIcalDate(value, event.isAllDay);
          break;
        }
        case "DTEND": {
          event.endsAt = this.parseIcalDate(value, event.isAllDay);
          break;
        }
        case "DTSTAMP":
        case "CREATED":
        case "LAST-MODIFIED":
          break;
        case "RECURRENCE-ID":
          event.originalStartTime = this.parseIcalDate(value, key.includes("VALUE=DATE"));
          break;
        case "SUMMARY":
          event.title = value;
          break;
        case "DESCRIPTION":
          event.description = value;
          break;
        case "LOCATION":
          event.location = value;
          break;
        case "ORGANIZER":
          event.organizerEmail = this.extractEmail(value);
          break;
        case "STATUS":
          event.status = value;
          break;
        case "RRULE":
          event.rrule = value;
          break;
        case "ATTENDEE": {
          const email = this.extractEmail(value);
          if (email) {
            event.attendees!.push({
              email,
              displayName: null,
              responseStatus: "needs-action",
            });
          }
          break;
        }
        case "URL":
        case "URI":
          if (value.startsWith("http")) {
            event.conferenceUrl = value;
          }
          break;
      }
    }

    if (!event.iCalUid || !event.startsAt || !event.endsAt) return null;

    return {
      iCalUid: event.iCalUid,
      title: event.title ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
      conferenceUrl: event.conferenceUrl ?? null,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      isAllDay: event.isAllDay ?? false,
      status: event.status ?? "confirmed",
      organizerEmail: event.organizerEmail ?? null,
      recurringEventId: event.rrule ? event.iCalUid : null,
      originalStartTime: event.originalStartTime ?? event.startsAt,
      rrule: event.rrule ?? null,
      attendees: event.attendees ?? [],
    };
  }

  private parseIcalDate(value: string, isAllDay: boolean): Date {
    if (isAllDay) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      return new Date(`${year}-${month}-${day}T00:00:00Z`);
    }
    const cleaned = value.replace(/[^0-9Z]/g, "");
    const iso = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}Z`;
    return new Date(iso);
  }

  private extractEmail(value: string): string | null {
    const match = value.match(/mailto:([^@]+@[^,\s]+)/);
    return match ? match[1] : null;
  }
}
