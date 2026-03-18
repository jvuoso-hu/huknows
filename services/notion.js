const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PAGE_ID = (process.env.NOTION_PAGE_ID || "").replace(/^.*-([a-f0-9]{32})$/, "$1") || process.env.NOTION_PAGE_ID;

// In-memory cache for the DB ID — persists for the lifetime of the process
let _dbId = process.env.NOTION_DATABASE_ID || null;

// ─── Block helpers ───────────────────────────────────────────────────────────

function rich(text, options = {}) {
  const t = { type: "text", text: { content: String(text) } };
  if (options.bold)   t.annotations = { ...t.annotations, bold: true };
  if (options.italic) t.annotations = { ...t.annotations, italic: true };
  return t;
}

const heading2   = (text)  => ({ object: "block", type: "heading_2",  heading_2:  { rich_text: [rich(text)] } });
const bullet     = (parts) => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const numbered   = (parts) => ({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const divider    = ()      => ({ object: "block", type: "divider", divider: {} });
const paragraph  = (parts) => ({ object: "block", type: "paragraph", paragraph: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const callout    = (text, emoji = "⚡") => ({ object: "block", type: "callout", callout: { rich_text: [rich(text)], icon: { type: "emoji", emoji } } });

// ─── Database ─────────────────────────────────────────────────────────────────

async function getOrCreateDatabase() {
  if (_dbId) return _dbId;
  if (!PAGE_ID) return null;

  // Try to find an existing HuKnows DB in the page
  const children = await notion.blocks.children.list({ block_id: PAGE_ID, page_size: 50 });
  const existing = children.results.find((b) => b.type === "child_database");
  if (existing) {
    _dbId = existing.id;
    console.log(`[notion] Found existing database: ${_dbId}`);
    return _dbId;
  }

  // Create a new database inside the page
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: PAGE_ID },
    title: [{ type: "text", text: { content: "🤝 HuKnows — Connections Log" } }],
    properties: {
      "Query":                { title: {} },
      "Expert":               { rich_text: {} },
      "Date":                 { date: {} },
      "Time to Connect (min)":{ number: { format: "number" } },
    },
  });

  _dbId = db.id;
  console.log(`[notion] Created new database. Add to Railway env vars: NOTION_DATABASE_ID=${_dbId}`);
  return _dbId;
}

async function logConnectionToDatabase(query, expertName, timeToConnectMs) {
  if (!process.env.NOTION_API_KEY) return;
  try {
    const dbId = await getOrCreateDatabase();
    if (!dbId) return;

    const mins = timeToConnectMs ? Math.round(timeToConnectMs / 60000) : null;

    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        "Query":   { title:      [{ text: { content: query } }] },
        "Expert":  { rich_text:  [{ text: { content: expertName || "—" } }] },
        "Date":    { date:       { start: new Date().toISOString() } },
        ...(mins !== null && { "Time to Connect (min)": { number: mins } }),
      },
    });
    console.log(`[notion] Logged connection: ${query} → ${expertName}`);
  } catch (e) {
    console.error("[notion] logConnection failed:", e.message);
  }
}

// ─── Summary page ────────────────────────────────────────────────────────────

async function clearPage() {
  let cursor;
  const ids = [];
  do {
    const res = await notion.blocks.children.list({ block_id: PAGE_ID, start_cursor: cursor, page_size: 100 });
    // Don't delete the child_database block — preserve the DB
    ids.push(...res.results.filter((b) => b.type !== "child_database").map((b) => b.id));
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  await Promise.all(ids.map((id) => notion.blocks.delete({ block_id: id })));
}

async function appendBlocks(blocks) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({ block_id: PAGE_ID, children: blocks.slice(i, i + 100) });
  }
}

async function exportHomeToNotion({ trendingTopics, recentConnections, topExperts, totalSolved, avgTimeToConnect, uniqueResolvedTopics, lang, updatedAt }) {
  if (!PAGE_ID || !process.env.NOTION_API_KEY) {
    console.log("[notion] Skipping export — NOTION_API_KEY or NOTION_PAGE_ID not set");
    return;
  }
  console.log("[notion] Exporting summary to Notion...");

  const isEn = lang === "en";
  const noData = isEn ? "No data yet" : "Sin datos aún";
  const blocks = [];

  // Ensure DB exists (creates it if needed)
  await getOrCreateDatabase();

  blocks.push(callout(isEn ? `Last updated: ${updatedAt}` : `Última actualización: ${updatedAt}`, "🔄"));
  blocks.push(divider());

  // 📊 Metrics
  blocks.push(callout(`${isEn ? "Connections created" : "Conexiones creadas"}: ${totalSolved}`, "🤝"));
  blocks.push(callout(`${isEn ? "Avg time to connect" : "Tiempo promedio de conexión"}: ${avgTimeToConnect || noData}`, "⏱"));
  blocks.push(callout(`${isEn ? "Unique topics resolved" : "Temas únicos resueltos"}: ${uniqueResolvedTopics}`, "🔁"));
  blocks.push(divider());

  // 🔥 Trending topics
  if (trendingTopics.length > 0) {
    blocks.push(heading2(isEn ? "🔥 Trending topics in Hu" : "🔥 Trending topics en Hu"));
    const word = isEn ? "search" : "búsqueda";
    const wordP = isEn ? "searches" : "búsquedas";
    for (const t of trendingTopics) {
      blocks.push(bullet([rich(t.topic, { bold: true }), rich(` · ${t.count} ${t.count === 1 ? word : wordP}`)]));
    }
    blocks.push(divider());
  }

  // 🧠 Knowledge unlocked
  if (recentConnections.length > 0) {
    blocks.push(heading2(isEn ? "🧠 Knowledge unlocked" : "🧠 Conocimiento desbloqueado"));
    for (const c of recentConnections) {
      blocks.push(bullet([
        rich(c.query, { italic: true }),
        rich(isEn ? " → connected with " : " → conectado con "),
        rich(c.expertName || "—", { bold: true }),
      ]));
    }
    blocks.push(divider());
  }

  // 🏆 Top experts
  if (topExperts.length > 0) {
    const MEDALS = ["🥇", "🥈", "🥉"];
    blocks.push(heading2(isEn ? "🏆 Top knowledge heroes" : "🏆 Expertos destacados"));
    for (let i = 0; i < topExperts.length; i++) {
      blocks.push(numbered([rich(`${MEDALS[i] || "🏅"} ${topExperts[i].name}`, { bold: true }), rich(` · Hero Level ${topExperts[i].level}`)]));
    }
    blocks.push(divider());
  }

  // ⚡ Footer
  blocks.push(callout(isEn ? `Problems solved with HuKnows: ${totalSolved}` : `Dudas resueltas con HuKnows: ${totalSolved}`, "⚡"));
  blocks.push(paragraph([rich(isEn
    ? "HuKnows keeps learning from every connection to make knowledge flow faster across Hu."
    : "HuKnows aprende con cada conexión para que el conocimiento fluya cada vez más rápido dentro de Hu.",
    { italic: true }
  )]));

  await clearPage();
  await appendBlocks(blocks);
}

module.exports = { exportHomeToNotion, logConnectionToDatabase };
