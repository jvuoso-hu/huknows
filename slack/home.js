const Anthropic = require("@anthropic-ai/sdk");
const { getTopQueries, getTopExperts, getRecentSearches } = require("../utils/feedback");

const anthropic = new Anthropic();

async function groupTopQueries(queries) {
  if (queries.length <= 1) return queries.map((q) => ({ topic: q.query, count: q.count }));
  const list = queries.map((q) => `- "${q.query}" (${q.count})`).join("\n");
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Group these Slack search queries by topic. Queries about the same subject should be merged and their counts summed. Keep truly different topics separate. Use a short, clear topic name.\n\nQueries:\n${list}\n\nReturn ONLY valid JSON array sorted by count desc:\n[{"topic": "<topic name>", "count": <total>}]`,
      }],
    });
    const match = response.content[0].text.trim().match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return queries.map((q) => ({ topic: q.query, count: q.count }));
}

async function buildHomeView(client, userId) {
  const topQueries = getTopQueries(5);
  const topExperts = getTopExperts(3);
  const recentSearches = getRecentSearches(userId);

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔍 HuKnows - The AI that knows who knows in Hu." },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Usá `/huknows <tema>` para encontrar al experto indicado en tu equipo.",
      },
    },
    { type: "divider" },
  ];

  // Recent searches for this user
  if (recentSearches.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🕐 Tus últimas búsquedas*\n${recentSearches
          .map((s) => `• _${s.query}_ · ${timeAgo(s.ts)}`)
          .join("\n")}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Top queries across workspace — semantically grouped
  if (topQueries.length > 0) {
    const grouped = await groupTopQueries(topQueries);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔥 Temas más buscados*\n${grouped
          .map((q) => `• _${q.topic}_ · ${q.count} ${q.count === 1 ? "búsqueda" : "búsquedas"}`)
          .join("\n")}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Top experts by helpful feedback
  if (topExperts.length > 0) {
    const enriched = await enrichTopExperts(client, topExperts);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🏆 Expertos más útiles*\n${enriched
          .map((e) => `• *${e.name}* · ${e.count} ${e.count === 1 ? "conexión exitosa" : "conexiones exitosas"}`)
          .join("\n")}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Empty state
  if (topQueries.length === 0 && recentSearches.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Todavía no hay búsquedas registradas. ¡Sé el primero en usar `/huknows`!",
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "_Los datos se acumulan desde que el bot está activo._" }],
  });

  return { type: "home", blocks };
}

async function enrichTopExperts(client, experts) {
  return Promise.all(
    experts.map(async (e) => {
      try {
        const result = await client.users.info({ user: e.userId });
        const user = result.user;
        return { ...e, name: user?.real_name || user?.name || e.userId };
      } catch {
        return { ...e, name: e.userId };
      }
    })
  );
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

module.exports = { buildHomeView };
