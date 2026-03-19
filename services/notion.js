const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PAGE_ID = (process.env.NOTION_PAGE_ID || "").replace(/^.*-([a-f0-9]{32})$/, "$1") || process.env.NOTION_PAGE_ID;

// ─── Block helpers ─────────────────────────────────────────────────────────────

function rich(text, options = {}) {
  const t = { type: "text", text: { content: String(text) } };
  if (options.bold)   t.annotations = { ...t.annotations, bold: true };
  if (options.italic) t.annotations = { ...t.annotations, italic: true };
  if (options.color)  t.annotations = { ...t.annotations, color: options.color };
  return t;
}

const empty = () => paragraph([rich(" ")]);

const heading2  = (text)  => ({ object: "block", type: "heading_2",  heading_2:  { rich_text: [rich(text)] } });
const bullet    = (parts) => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const numbered  = (parts) => ({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const divider   = ()      => ({ object: "block", type: "divider", divider: {} });
const paragraph = (parts) => ({ object: "block", type: "paragraph", paragraph: { rich_text: Array.isArray(parts) ? parts : [rich(parts)] } });
const callout      = (text, emoji = "⚡") => ({ object: "block", type: "callout", callout: { rich_text: [rich(text)], icon: { type: "emoji", emoji } } });
const metricLabel  = (text) => paragraph([rich(text, { bold: true })]);
const metricValue  = (value, emoji, color = "blue_background") => ({
  object: "block", type: "callout",
  callout: { rich_text: [rich(String(value), { bold: true })], icon: { type: "emoji", emoji }, color },
});

function columns(...cols) {
  return {
    object: "block",
    type: "column_list",
    column_list: {
      children: cols.map((blocks) => ({
        object: "block",
        type: "column",
        column: { children: blocks },
      })),
    },
  };
}

// ─── Page management ──────────────────────────────────────────────────────────

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
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({ block_id: PAGE_ID, children: blocks.slice(i, i + 100) });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportHomeToNotion({ trendingTopics, recentConnections, topExperts, totalSolved, avgTimeToConnect, uniqueResolvedTopics, lang, updatedAt }) {
  if (!PAGE_ID || !process.env.NOTION_API_KEY) {
    console.log("[notion] Skipping export — NOTION_API_KEY or NOTION_PAGE_ID not set");
    return;
  }
  console.log("[notion] Exporting summary to Notion...");

  const isEn = lang === "en";
  const noData = isEn ? "No data yet" : "Sin datos aún";
  const blocks = [];

  // Header
  blocks.push({
    object: "block", type: "callout",
    callout: {
      rich_text: [rich(isEn ? `Last updated: ${updatedAt}` : `Última actualización: ${updatedAt}`, { italic: true, color: "gray" })],
      icon: { type: "emoji", emoji: "🔄" },
      color: "gray_background",
    },
  });
  blocks.push(divider());

  // Metrics row (3 columns)
  blocks.push(columns(
    [
      metricLabel(isEn ? "Connections created:" : "Conexiones creadas:"),
      metricValue(totalSolved, "🤝🏻", "blue_background"),
    ],
    [
      metricLabel(isEn ? "Avg time:" : "Tiempo promedio:"),
      metricValue(avgTimeToConnect || noData, "⏱", "yellow_background"),
    ],
    [
      metricLabel(isEn ? "Topics resolved:" : "Temas resueltos:"),
      metricValue(uniqueResolvedTopics, "🧩", "green_background"),
    ],
  ));
  blocks.push(divider());

  // Content row (2 columns: trending | knowledge unlocked)
  const leftCol = [];
  const rightCol = [];

  if (trendingTopics.length > 0) {
    const word = isEn ? "search" : "búsqueda";
    const wordP = isEn ? "searches" : "búsquedas";
    leftCol.push(metricLabel(isEn ? "Trending topics:" : "Trending topics:"));
    for (const t of trendingTopics.slice(0, 3)) {
      leftCol.push(metricValue(`${t.topic} · ${t.count} ${t.count === 1 ? word : wordP}`, "🔥", "pink_background"));
    }
  }

  if (recentConnections.length > 0) {
    rightCol.push(metricLabel(isEn ? "Knowledge unlocked:" : "Conocimiento desbloqueado:"));
    for (const c of recentConnections.slice(0, 3)) {
      rightCol.push(metricValue(`${c.query} → ${c.expertName || "—"}`, "🧠", "purple_background"));
    }
  }

  if (leftCol.length > 0 || rightCol.length > 0) {
    if (leftCol.length === 0) leftCol.push(paragraph(noData));
    if (rightCol.length === 0) rightCol.push(paragraph(noData));
    blocks.push(columns(leftCol, rightCol));
    blocks.push(divider());
  }

  // Heroes
  if (topExperts.length > 0) {
    const MEDALS = ["🥇", "🥈", "🥉"];
    blocks.push(metricLabel(isEn ? "Top knowledge heroes:" : "Expertos destacados:"));
    for (let i = 0; i < topExperts.length; i++) {
      blocks.push(metricValue(`${topExperts[i].name} · Hero Level ${topExperts[i].level}`, MEDALS[i] || "🏅", "orange_background"));
    }
    blocks.push(divider());
  }

  // Footer
  blocks.push(empty());
  blocks.push(empty());
  blocks.push({
    object: "block", type: "callout",
    callout: {
      rich_text: [rich(isEn ? `Problems solved with HuKnows: ${totalSolved}` : `Dudas resueltas con HuKnows: ${totalSolved}`, { bold: true })],
      icon: { type: "emoji", emoji: "⚡" },
      color: "yellow_background",
    },
  });
  blocks.push(paragraph([rich("HuKnows ® El conocimiento ya está. HuKnows se encarga de conectarlo. Make things happen.", { italic: true })]));

  blocks.push({ object: "block", type: "image", image: { type: "external", external: { url: "https://raw.githubusercontent.com/jvuoso-hu/huknows/main/assets/footer.png" } } });

  await clearPage();
  await appendBlocks(blocks);
  console.log("[notion] Export complete.");
}

module.exports = { exportHomeToNotion };
