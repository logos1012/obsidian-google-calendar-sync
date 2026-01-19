import { google, calendar_v3 } from "googleapis";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type {
  GoogleCalendarSyncSettings,
  ServiceAccountKey,
  CalendarEvent,
  CalendarInfo,
} from "./types";

export class GoogleCalendarService {
  private settings: GoogleCalendarSyncSettings;
  private calendar: calendar_v3.Calendar | null = null;
  private calendarsCache: CalendarInfo[] | null = null;

  constructor(settings: GoogleCalendarSyncSettings) {
    this.settings = settings;
  }

  private async getServiceAccountKey(): Promise<ServiceAccountKey> {
    const client = new SecretsManagerClient({
      region: this.settings.awsRegion,
      credentials: {
        accessKeyId: this.settings.awsAccessKeyId,
        secretAccessKey: this.settings.awsSecretAccessKey,
      },
    });

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: this.settings.awsSecretName,
      })
    );

    if (!response.SecretString) {
      throw new Error("Failed to retrieve service account key from AWS");
    }

    return JSON.parse(response.SecretString) as ServiceAccountKey;
  }

  async initialize(): Promise<void> {
    const serviceAccountKey = await this.getServiceAccountKey();

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
      subject: this.settings.impersonateEmail,
    });

    this.calendar = google.calendar({ version: "v3", auth });
  }

  async getCalendars(): Promise<CalendarInfo[]> {
    if (this.calendarsCache) {
      return this.calendarsCache;
    }

    if (!this.calendar) {
      await this.initialize();
    }

    const response = await this.calendar!.calendarList.list({
      maxResults: 100,
    });

    this.calendarsCache =
      response.data.items?.map((cal) => ({
        id: cal.id || "",
        name: cal.summary || "",
      })) || [];

    return this.calendarsCache;
  }

  async getEventsForDate(date: Date): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      await this.initialize();
    }

    const calendars = await this.getCalendars();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const allEvents: CalendarEvent[] = [];

    for (const cal of calendars) {
      if (cal.id.includes("holiday")) continue;

      try {
        const response = await this.calendar!.events.list({
          calendarId: cal.id,
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        const events =
          response.data.items?.map((event) => {
            const start = event.start?.dateTime
              ? new Date(event.start.dateTime)
              : event.start?.date
              ? new Date(event.start.date)
              : new Date();

            const end = event.end?.dateTime
              ? new Date(event.end.dateTime)
              : event.end?.date
              ? new Date(event.end.date)
              : new Date();

            return {
              id: event.id || "",
              calendarId: cal.id,
              calendarName: cal.name,
              summary: event.summary || "",
              description: event.description || undefined,
              start,
              end,
              allDay: !event.start?.dateTime,
            };
          }) || [];

        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to fetch events from calendar ${cal.name}:`, error);
      }
    }

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    return allEvents;
  }

  async getPlanEventsForDate(date: Date): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsForDate(date);
    return allEvents.filter(
      (event) => event.calendarId === this.settings.planCalendarId
    );
  }

  async getLogEventsForDate(date: Date): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsForDate(date);
    return allEvents.filter(
      (event) => event.calendarId !== this.settings.planCalendarId
    );
  }

  async createEvent(
    calendarId: string,
    summary: string,
    start: Date,
    end: Date,
    description?: string
  ): Promise<string> {
    if (!this.calendar) {
      await this.initialize();
    }

    const response = await this.calendar!.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Seoul",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Seoul",
        },
      },
    });

    return response.data.id || "";
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    summary: string,
    start: Date,
    end: Date,
    description?: string
  ): Promise<void> {
    if (!this.calendar) {
      await this.initialize();
    }

    await this.calendar!.events.update({
      calendarId,
      eventId,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Seoul",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Seoul",
        },
      },
    });
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    if (!this.calendar) {
      await this.initialize();
    }

    await this.calendar!.events.delete({
      calendarId,
      eventId,
    });
  }

  getCalendarIdByName(name: string): string | null {
    if (!this.calendarsCache) return null;
    const calendar = this.calendarsCache.find(
      (cal) => cal.name === name
    );
    return calendar?.id || null;
  }

  clearCache(): void {
    this.calendarsCache = null;
    this.calendar = null;
  }
}
