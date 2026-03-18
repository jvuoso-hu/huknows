const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
// Strip optional page-title prefix (e.g. "HuKnows-3278271f..." → "3278271f...")
const PAGE_ID = (process.env.NOTION_PAGE_ID || "").replace(/^.*-([a-f0-9]{32})$/, "$1") || process.env.NOTION_PAGE_ID;

function rich(text, options = {}) {
  const t = { type: "text", text: { content: text } };
  if (options.bold)   t.annotations = { ...t.annotations, bold: true };
  if (options.italic) t.annotations = { ...t.annotations, italic: true };
  if (options.code)   t.annotations = { ...t.annotations, code: true };
  return t;
}

function heading2(text) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [rich(text)] } };
}

function paragraph(parts) {
  const rich_text = Array.isArray(parts) ? parts : [rich(parts)];
  return { object: "block", type: "paragraph", paragraph: { rich_text } };
}

function bullet(parts) {
  const rich_text = Array.isArray(parts) ? parts : [rich(parts)];
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text } };
}

function numbered(parts, n) {
  const rich_text = Array.isArray(parts) ? parts : [rich(parts)];
  return { object: "block", type: "numbered_list_item", numbered_list_item: { rich_text } };
}

function divider() {
  return { object: "block", type: "divider", divider: {} };
}

function callout(text, emoji = "⚡") {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [rich(text)],
      icon: { type: "emoji", emoji },
    },
  };
}

async function clearPage() {
  let cursor;
  const ids = [];
  do {
    const res = await notion.blocks.children.list({ block_id: PAGE_ID, start_cursor: cursor, page_size: 100 });
    ids.push(...res.results.map((b) => b.id));
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  await Promise.all(ids.map((id) => notion.blocks.delete({ block_id: id })));
}

async function appendBlocks(blocks) {
  // Notion allows max 100 blocks per request
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({ block_id: PAGE_ID, children: blocks.slice(i, i + 100) });
  }
}

function metricColumn(emoji, label, value, isEn) {
  return {
    object: "block",
    type: "column",
    column: {},
    children: [
      callout(`${emoji} ${value}\n${label}`, emoji),
    ],
  };
}

async function exportHomeToNotion({ trendingTopics, recentConnections, topExperts, totalSolved, avgTimeToConnect, uniqueResolvedTopics, lang, updatedAt }) {
  if (!PAGE_ID || !process.env.NOTION_API_KEY) {
    console.log("[notion] Skipping export — NOTION_API_KEY or NOTION_PAGE_ID not set");
    return;
  }
  console.log("[notion] Exporting home to Notion...");

  const isEn = lang === "en";
  const blocks = [];

  // Header
  blocks.push(callout(
    isEn ? `Last updated: ${updatedAt}` : `Última actualización: ${updatedAt}`,
    "🔄"
  ));
  blocks.push(divider());

  // 📊 Metrics dashboard — 3 columns
  blocks.push({
    object: "block",
    type: "column_list",
    column_list: {},
    children: [
      metricColumn("🤝", isEn ? "Connections created" : "Conexiones creadas", totalSolved, isEn),
      metricColumn("⏱", isEn ? "Avg time to connect" : "Tiempo promedio de conexión", avgTimeToConnect || (isEn ? "No data yet" : "Sin datos aún"), isEn),
      metricColumn("🔁", isEn ? "Unique topics resolved" : "Temas únicos resueltos", uniqueResolvedTopics, isEn),
    ],
  });
  blocks.push(divider());

  // 🔥 Trending topics
  if (trendingTopics.length > 0) {
    blocks.push(heading2(isEn ? "🔥 Trending topics in Hu" : "🔥 Trending topics en Hu"));
    const word = isEn ? "search" : "búsqueda";
    const wordPlural = isEn ? "searches" : "búsquedas";
    for (const t of trendingTopics) {
      blocks.push(bullet([
        rich(t.topic, { bold: true }),
        rich(` · ${t.count} ${t.count === 1 ? word : wordPlural}`),
      ]));
    }
    blocks.push(divider());
  }

  // 🧠 Knowledge unlocked
  if (recentConnections.length > 0) {
    blocks.push(heading2(isEn ? "🧠 Knowledge unlocked" : "🧠 Conocimiento desbloqueado"));
    for (const c of recentConnections) {
      const expertLabel = c.expertName || "—";
      blocks.push(bullet([
        rich(c.query, { italic: true }),
        rich(isEn ? " → connected with " : " → conectado con "),
        rich(expertLabel, { bold: true }),
      ]));
    }
    blocks.push(divider());
  }

  // 🏆 Top experts
  if (topExperts.length > 0) {
    const MEDALS = ["🥇", "🥈", "🥉"];
    blocks.push(heading2(isEn ? "🏆 Top knowledge heroes" : "🏆 Expertos destacados"));
    for (let i = 0; i < topExperts.length; i++) {
      const e = topExperts[i];
      const medal = MEDALS[i] || "🏅";
      blocks.push(numbered([
        rich(`${medal} ${e.name}`, { bold: true }),
        rich(` · Hero Level ${e.level}`),
      ]));
    }
    blocks.push(divider());
  }

  // ⚡ Total solved
  blocks.push(callout(
    isEn
      ? `Problems solved with HuKnows: ${totalSolved}`
      : `Dudas resueltas con HuKnows: ${totalSolved}`,
    "⚡"
  ));

  // Footer
  blocks.push(paragraph([
    rich(
      isEn
        ? "HuKnows keeps learning from every connection to make knowledge flow faster across Hu."
        : "HuKnows aprende con cada conexión para que el conocimiento fluya cada vez más rápido dentro de Hu.",
      { italic: true }
    ),
  ]));

  await clearPage();
  await appendBlocks(blocks);
}

module.exports = { exportHomeToNotion };
