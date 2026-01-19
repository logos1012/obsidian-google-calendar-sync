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

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const calendarId = "c_ad5fbc04d0d357840a5ae228007fb6bcf32f65c1c0d0f135116f3d0b4be1b2fd@group.calendar.google.com";

  const response = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  for (const event of response.data.items || []) {
    console.log("=== Event ===");
    console.log("Summary:", event.summary);
    console.log("Description raw:");
    console.log(JSON.stringify(event.description));
    console.log("");
    console.log("Description split by \\n:");
    if (event.description) {
      const lines = event.description.split("\n");
      lines.forEach((line, i) => {
        console.log(`  [${i}] "${line}"`);
      });
    }
    console.log("---\n");
  }
}

main().catch(console.error);
