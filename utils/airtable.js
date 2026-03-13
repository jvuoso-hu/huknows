const https = require("https");

async function airtableRequest(method, path = "", body = null) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;
  if (!token || !baseId || !tableId) return null;

  const postData = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.airtable.com",
      path: `/v0/${baseId}/${tableId}${path}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function syncExpertPoints(userId, name, query) {
  try {
    const encoded = encodeURIComponent(`{UserId} = "${userId}"`);
    const result = await airtableRequest("GET", `?filterByFormula=${encoded}`);
    const existing = result?.records?.[0];
    const today = new Date().toISOString().split("T")[0];

    if (existing) {
      await airtableRequest("PATCH", `/${existing.id}`, {
        fields: {
          Points: (existing.fields.Points || 0) + 1,
          LastQuery: query,
          LastContribution: today,
        },
      });
    } else {
      await airtableRequest("POST", "", {
        fields: { Name: name, UserId: userId, Points: 1, LastQuery: query, LastContribution: today },
      });
    }
  } catch (e) {
    console.error("Airtable sync error:", e.message);
  }
}

module.exports = { syncExpertPoints };
