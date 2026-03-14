const { google } = require("googleapis");

const teamProfilesCache = { data: null, ts: 0 };
const TEAM_CACHE_TTL = 5 * 60 * 1000;

function getClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function syncExpertPoints(userId, name, query) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  try {
    const sheets = google.sheets({ version: "v4", auth: getClient() });
    const range = "Sheet1!A:E";

    // Read all rows to find existing user
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const rows = res.data.values || [];

    // Row 0 = headers, find user by UserId (column B = index 1)
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[1] === userId);
    const today = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

    if (rowIndex > 0) {
      const currentPoints = parseInt(rows[rowIndex][2] || "0", 10);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Sheet1!C${rowIndex + 1}:E${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[currentPoints + 1, query, today]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [[name, userId, 1, query, today]] },
      });
    }
  } catch (e) {
    console.error("Sheets sync error:", e.message);
  }
}

async function getTeamProfiles() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return new Map();

  if (teamProfilesCache.data && Date.now() - teamProfilesCache.ts < TEAM_CACHE_TTL) {
    return teamProfilesCache.data;
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: getClient() });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Sheet2!A:C" });
    const rows = res.data.values || [];
    const map = new Map();
    // Expected columns: Name | Role | Area (row 0 = headers)
    for (let i = 1; i < rows.length; i++) {
      const [name, role, area] = rows[i];
      if (name) map.set(name.toLowerCase().trim(), { role: role || "", area: area || "" });
    }
    teamProfilesCache.data = map;
    teamProfilesCache.ts = Date.now();
    return map;
  } catch (e) {
    console.error("Sheet2 load error:", e.message);
    return new Map();
  }
}

module.exports = { syncExpertPoints, getTeamProfiles };
