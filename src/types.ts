// Plugin Settings
export interface GoogleCalendarSyncSettings {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsSecretName: string;
  impersonateEmail: string;
  planCalendarId: string; // '계획' 캘린더 ID
}

export const DEFAULT_SETTINGS: GoogleCalendarSyncSettings = {
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRegion: "ap-northeast-2",
  awsSecretName: "/gcp/google-drive-service-account",
  impersonateEmail: "jake@workbetterlife.com",
  planCalendarId: "c_92ce73b3a68e4071b369ddcbc9f649ca53c9846cedf4d36522d2e9969250d800@group.calendar.google.com",
};

// Google Service Account Key structure
export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Calendar Event from Google Calendar API
export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

// Parsed event from Obsidian note
export interface ParsedEvent {
  startTime: string; // "10:00"
  endTime: string;   // "12:00"
  title: string;
  calendarName: string;
  description?: string[]; // Multiple lines of description
  rawLine: string;
}

// Calendar info
export interface CalendarInfo {
  id: string;
  name: string;
}

// Sync result
export interface SyncResult {
  success: boolean;
  message: string;
  eventsProcessed: number;
}
