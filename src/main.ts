import { Notice, Plugin, TFile } from "obsidian";
import {
  GoogleCalendarSyncSettings,
  DEFAULT_SETTINGS,
  CalendarEvent,
  ParsedEvent,
} from "./types";
import { GoogleCalendarSyncSettingTab } from "./settings";
import { GoogleCalendarService } from "./google-calendar";
import {
  formatEventsToMarkdown,
  parseDailyPlan,
  parseDailyLog,
  updateSection,
  extractDateFromTitle,
  parseTimeToDate,
  compareEventsByTime,
} from "./parser";

export default class GoogleCalendarSyncPlugin extends Plugin {
  settings: GoogleCalendarSyncSettings;
  calendarService: GoogleCalendarService;

  async onload() {
    await this.loadSettings();
    this.calendarService = new GoogleCalendarService(this.settings);

    this.addRibbonIcon("calendar", "Calendar to Obsidian", async () => {
      await this.pullFromCalendar();
    });

    this.addCommand({
      id: "pull-from-calendar",
      name: "Calendar to Obsidian",
      callback: async () => {
        await this.pullFromCalendar();
      },
    });

    this.addCommand({
      id: "push-to-calendar",
      name: "Push to Calendar",
      callback: async () => {
        await this.pushToCalendar();
      },
    });

    this.addSettingTab(new GoogleCalendarSyncSettingTab(this.app, this));
  }

  onunload() {
    this.calendarService?.clearCache();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.calendarService = new GoogleCalendarService(this.settings);
  }

  private getActiveFile(): TFile | null {
    return this.app.workspace.getActiveFile();
  }

  private getDateFromFile(file: TFile): Date | null {
    const dateStr = extractDateFromTitle(file.basename);
    if (!dateStr) return null;

    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  async pullFromCalendar() {
    const file = this.getActiveFile();
    if (!file) {
      new Notice("No active file");
      return;
    }

    const date = this.getDateFromFile(file);
    if (!date) {
      new Notice("File name must be in YYYY-MM-DD format");
      return;
    }

    try {
      new Notice("Fetching calendar events...");

      const planEvents = await this.calendarService.getPlanEventsForDate(date);
      const logEvents = await this.calendarService.getLogEventsForDate(date);

      let content = await this.app.vault.read(file);

      const planMarkdown = formatEventsToMarkdown(planEvents, false, false);
      content = updateSection(content, "Daily Plan", planMarkdown);

      const logMarkdown = formatEventsToMarkdown(logEvents, true, true);
      content = updateSection(content, "Daily Log", logMarkdown);

      await this.app.vault.modify(file, content);

      new Notice(
        `Synced ${planEvents.length} plan events and ${logEvents.length} log events`
      );
    } catch (error) {
      console.error("Failed to pull from calendar:", error);
      new Notice(`Failed to sync: ${error.message}`);
    }
  }

  async pushToCalendar() {
    const file = this.getActiveFile();
    if (!file) {
      new Notice("No active file");
      return;
    }

    const date = this.getDateFromFile(file);
    if (!date) {
      new Notice("File name must be in YYYY-MM-DD format");
      return;
    }

    const dateStr = file.basename.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!dateStr) {
      new Notice("Could not parse date from file name");
      return;
    }

    try {
      new Notice("Syncing to calendar...");

      const content = await this.app.vault.read(file);

      const notePlanEvents = parseDailyPlan(content);
      const noteLogEvents = parseDailyLog(content);

      const calendarPlanEvents =
        await this.calendarService.getPlanEventsForDate(date);
      const calendarLogEvents =
        await this.calendarService.getLogEventsForDate(date);

      let created = 0;
      let updated = 0;

      created += await this.syncEventsToCalendar(
        notePlanEvents,
        calendarPlanEvents,
        this.settings.planCalendarId,
        dateStr
      );

      for (const noteEvent of noteLogEvents) {
        const calendarId = this.calendarService.getCalendarIdByName(
          noteEvent.calendarName
        );
        if (!calendarId) {
          console.warn(`Calendar not found: ${noteEvent.calendarName}`);
          continue;
        }

        const existingEvent = calendarLogEvents.find(
          (ce) =>
            ce.calendarId === calendarId &&
            this.eventsMatch(noteEvent, ce, dateStr)
        );

        if (!existingEvent) {
          await this.createEventFromParsed(noteEvent, calendarId, dateStr);
          created++;
        }
      }

      new Notice(`Pushed to calendar: ${created} created, ${updated} updated`);
    } catch (error) {
      console.error("Failed to push to calendar:", error);
      new Notice(`Failed to sync: ${error.message}`);
    }
  }

  private async syncEventsToCalendar(
    noteEvents: ParsedEvent[],
    calendarEvents: CalendarEvent[],
    calendarId: string,
    dateStr: string
  ): Promise<number> {
    let created = 0;

    for (const noteEvent of noteEvents) {
      const existingEvent = calendarEvents.find((ce) =>
        this.eventsMatch(noteEvent, ce, dateStr)
      );

      if (!existingEvent) {
        await this.createEventFromParsed(noteEvent, calendarId, dateStr);
        created++;
      }
    }

    return created;
  }

  private eventsMatch(
    noteEvent: ParsedEvent,
    calendarEvent: CalendarEvent,
    dateStr: string
  ): boolean {
    const noteStart = parseTimeToDate(dateStr, noteEvent.startTime);
    const noteEnd = parseTimeToDate(dateStr, noteEvent.endTime);

    const startMatch =
      Math.abs(noteStart.getTime() - calendarEvent.start.getTime()) < 60000;
    const endMatch =
      Math.abs(noteEnd.getTime() - calendarEvent.end.getTime()) < 60000;
    const titleMatch =
      noteEvent.title.toLowerCase() === calendarEvent.summary.toLowerCase();

    return startMatch && endMatch && titleMatch;
  }

  private async createEventFromParsed(
    event: ParsedEvent,
    calendarId: string,
    dateStr: string
  ): Promise<void> {
    const start = parseTimeToDate(dateStr, event.startTime);
    const end = parseTimeToDate(dateStr, event.endTime);
    const description = event.description?.join("\n");

    await this.calendarService.createEvent(
      calendarId,
      event.title,
      start,
      end,
      description
    );
  }
}
