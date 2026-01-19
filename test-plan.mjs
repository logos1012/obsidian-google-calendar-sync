import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { google } from "googleapis";

async function main() {
  const smClient = new SecretsManagerClient({ region: "ap-northeast-2" });
  const secretResponse = await smClient.send(
    new GetSecretValueCommand({ SecretId: "/gcp/google-drive-service-account" })
  );
  const serviceAccountKey = JSON.parse(secretResponse.SecretString);

  const auth = new google.auth.JWT({
    email: serviceAccountKey.client_email,
    key: serviceAccountKey.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: "jake@workbetterlife.com",
  });

  const calendar = google.calendar({ version: "v3", auth });

  const planCalendarId = "c_92ce73b3a68e4071b369ddcbc9f649ca53c9846cedf4d36522d2e9969250d800@group.calendar.google.com";
  
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  console.log("=== Checking '계획' Calendar ===");
  console.log(`Date: ${today.toISOString().split('T')[0]}`);
  console.log(`Calendar ID: ${planCalendarId}`);
  console.log("");

  try {
    const response = await calendar.events.list({
      calendarId: planCalendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    console.log(`Found ${events.length} events in '계획' calendar for today:`);
    
    for (const event of events) {
      console.log(`- ${event.summary}`);
      console.log(`  Start: ${event.start?.dateTime || event.start?.date}`);
      console.log(`  End: ${event.end?.dateTime || event.end?.date}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
