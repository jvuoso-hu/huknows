const { google } = require("googleapis");

function getClient() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
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

module.exports = { syncExpertPoints };
