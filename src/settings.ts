import { App, PluginSettingTab, Setting } from "obsidian";
import type GoogleCalendarSyncPlugin from "./main";
import type { GoogleCalendarSyncSettings } from "./types";

export class GoogleCalendarSyncSettingTab extends PluginSettingTab {
  plugin: GoogleCalendarSyncPlugin;

  constructor(app: App, plugin: GoogleCalendarSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Google Calendar Sync Settings" });

    containerEl.createEl("h3", { text: "AWS Credentials" });

    new Setting(containerEl)
      .setName("AWS Access Key ID")
      .setDesc("AWS access key for Secrets Manager")
      .addText((text) =>
        text
          .setPlaceholder("AKIAIOSFODNN7EXAMPLE")
          .setValue(this.plugin.settings.awsAccessKeyId)
          .onChange(async (value) => {
            this.plugin.settings.awsAccessKeyId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("AWS Secret Access Key")
      .setDesc("AWS secret key for Secrets Manager")
      .addText((text) => {
        text
          .setPlaceholder("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
          .setValue(this.plugin.settings.awsSecretAccessKey)
          .onChange(async (value) => {
            this.plugin.settings.awsSecretAccessKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("AWS Region")
      .setDesc("AWS region where Secrets Manager is located")
      .addText((text) =>
        text
          .setPlaceholder("ap-northeast-2")
          .setValue(this.plugin.settings.awsRegion)
          .onChange(async (value) => {
            this.plugin.settings.awsRegion = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("AWS Secret Name")
      .setDesc("Name of the secret containing Google service account key")
      .addText((text) =>
        text
          .setPlaceholder("/gcp/google-drive-service-account")
          .setValue(this.plugin.settings.awsSecretName)
          .onChange(async (value) => {
            this.plugin.settings.awsSecretName = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Google Calendar" });

    new Setting(containerEl)
      .setName("Impersonate Email")
      .setDesc("Google Workspace user email to impersonate")
      .addText((text) =>
        text
          .setPlaceholder("user@domain.com")
          .setValue(this.plugin.settings.impersonateEmail)
          .onChange(async (value) => {
            this.plugin.settings.impersonateEmail = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Plan Calendar ID")
      .setDesc("Calendar ID for '계획' calendar (used for Daily Plan)")
      .addText((text) =>
        text
          .setPlaceholder("calendar-id@group.calendar.google.com")
          .setValue(this.plugin.settings.planCalendarId)
          .onChange(async (value) => {
            this.plugin.settings.planCalendarId = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Todoist" });

    new Setting(containerEl)
      .setName("Todoist API Key")
      .setDesc("API token from Todoist Settings > Integrations > Developer")
      .addText((text) => {
        text
          .setPlaceholder("Your Todoist API token")
          .setValue(this.plugin.settings.todoistApiKey)
          .onChange(async (value) => {
            this.plugin.settings.todoistApiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });
  }
}
