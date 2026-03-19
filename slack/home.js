const Anthropic = require("@anthropic-ai/sdk");
const { getTopQueries, getTopExperts, getRecentSearches, getRecentConnections, getTotalSuccesses, getAvgTimeToConnect, getUniqueResolvedTopics, getTrendingExpertId, getCrossTeamConnectorId } = require("../utils/feedback");
const { exportHomeToNotion } = require("../services/notion");

const anthropic = new Anthropic();

const MEDALS = ["🥇", "🥈", "🥉"];

function heroLevel(count) {
  if (count >= 10) return 4;
  if (count >= 5)  return 3;
  if (count >= 3)  return 2;
  return 1;
}

function timeAgo(ts, lang) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return lang === "en" ? "just now" : "ahora";
  if (mins < 60) return lang === "en" ? `${mins}m ago` : `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return lang === "en" ? `${hrs}h ago` : `hace ${hrs}h`;
  return lang === "en" ? `${Math.floor(hrs / 24)}d ago` : `hace ${Math.floor(hrs / 24)}d`;
}

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

async function buildHomeView(client, userId) {
  // Detect user language from Slack locale
  let lang = "es";
  try {
    const info = await client.users.info({ user: userId });
    if ((info.user?.locale || "").startsWith("en")) lang = "en";
  } catch {}

  const isEn = lang === "en";
  const topQueries = getTopQueries(5);
  const topExperts = getTopExperts(3);
  const recentSearches = getRecentSearches(userId);
  const recentConnections = getRecentConnections(5);
  const totalSolved = getTotalSuccesses();

  // Compute once, share between Slack blocks and Notion export
  const [grouped, enriched] = await Promise.all([
    topQueries.length > 0 ? groupTopQueries(topQueries) : Promise.resolve([]),
    topExperts.length > 0 ? enrichTopExperts(client, topExperts) : Promise.resolve([]),
  ]);

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔍 HuKnows - The AI that knows who knows in Hu." },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? "Use `/huknows <topic>` to find the right expert in your team."
          : "Usá `/huknows <tema>` para encontrar al experto indicado en tu equipo.",
      },
    },
    { type: "divider" },
  ];

  // ⏱ Recent searches
  if (recentSearches.length > 0) {
    const lines = recentSearches.map((s) => `- _${s.query}_ · ${timeAgo(s.ts, lang)}`).join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? `*⏱ Your recent searches*\nYour latest knowledge quests:\n\n${lines}`
          : `*⏱ Tus búsquedas recientes*\nTus últimas exploraciones de conocimiento:\n\n${lines}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // 🔥 Trending topics
  if (grouped.length > 0) {
    const searchWord = isEn ? "search" : "búsqueda";
    const searchWordPlural = isEn ? "searches" : "búsquedas";
    const lines = grouped
      .map((q) => `• _${q.topic}_ · ${q.count} ${q.count === 1 ? searchWord : searchWordPlural}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? `*🔥 Trending topics in Hu*\nWhat people are looking for right now:\n\n${lines}`
          : `*🔥 Trending topics en Hu*\nLo que la gente está buscando ahora:\n\n${lines}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // 🧠 Knowledge unlocked
  if (recentConnections.length > 0) {
    const lines = recentConnections
      .map((c) => {
        const expert = c.expertName ? `*${c.expertName}*` : "_unknown_";
        return isEn
          ? `- _${c.query}_ → connected with ${expert}`
          : `- _${c.query}_ → conectado con ${expert}`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? `🧠 *Knowledge unlocked*\nConnections that recently helped solve topics across Hu:\n\n${lines}`
          : `🧠 *Conocimiento desbloqueado*\nLas conexiones que ayudaron a resolver temas recientemente:\n\n${lines}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // 🏆 Top knowledge heroes
  if (enriched.length > 0) {
    const lines = enriched
      .map((e, i) => `${MEDALS[i] || "🏅"} ${e.name} · Hero Level ${heroLevel(e.count)}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? `*🏆 Top knowledge heroes*\nThe experts helping Hu move faster:\n\n${lines}`
          : `*🏆 Expertos destacados*\nLas personas que están brindando más ayuda:\n\n${lines}`,
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
        text: isEn
          ? "No searches recorded yet. Be the first to use `/huknows`!"
          : "Todavía no hay búsquedas registradas. ¡Sé el primero en usar `/huknows`!",
      },
    });
  }

  // ⚡ Total solved
  if (totalSolved > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isEn
          ? `⚡ *Problems solved with HuKnows: ${totalSolved}*`
          : `⚡ *Dudas resueltas con HuKnows: ${totalSolved}*`,
      },
    });
    blocks.push({ type: "divider" });
  }

  // Admin
  blocks.push({
    type: "actions",
    elements: [{
      type: "button",
      text: { type: "plain_text", text: "🗑️ Reset stats" },
      style: "danger",
      action_id: "reset_stats",
      confirm: {
        title: { type: "plain_text", text: "¿Resetear todo?" },
        text: { type: "mrkdwn", text: "Esto borra todas las búsquedas, conexiones y puntos. No se puede deshacer." },
        confirm: { type: "plain_text", text: "Sí, resetear" },
        deny: { type: "plain_text", text: "Cancelar" },
      },
    }],
  });

  // Footer
  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: isEn
        ? "_HuKnows keeps learning from every connection to make knowledge flow faster across Hu._"
        : "_HuKnows aprende con cada conexión para que el conocimiento fluya cada vez más rápido dentro de Hu._",
    }],
  });

  // Export to Notion — fire and forget, non-critical
  triggerNotionExport(client, lang, { grouped, enriched, recentConnections, totalSolved });

  return { type: "home", blocks };
}

async function triggerNotionExport(client, lang = "es", cached = {}) {
  try {
    const recentConnections = cached.recentConnections || getRecentConnections(5);
    const totalSolved = cached.totalSolved ?? getTotalSuccesses();

    const [grouped, enriched] = await Promise.all([
      cached.grouped || (getTopQueries(5).length > 0 ? groupTopQueries(getTopQueries(5)) : Promise.resolve([])),
      cached.enriched || (getTopExperts(3).length > 0 ? enrichTopExperts(client, getTopExperts(3)) : Promise.resolve([])),
    ]);

    const trendingId = getTrendingExpertId();
    const crossTeamId = getCrossTeamConnectorId();
    const trendingExpert = enriched.find((e) => e.userId === trendingId)?.name || null;
    const crossTeamExpert = enriched.find((e) => e.userId === crossTeamId)?.name || null;

    await exportHomeToNotion({
      trendingTopics: grouped,
      recentConnections,
      topExperts: enriched.map((e) => ({
        name: e.name,
        level: heroLevel(e.count),
        count: e.count,
        isTrending: e.userId === trendingId,
        isCrossTeam: e.userId === crossTeamId,
      })),
      trendingExpert,
      crossTeamExpert,
      totalSolved,
      avgTimeToConnect: getAvgTimeToConnect(),
      uniqueResolvedTopics: getUniqueResolvedTopics(),
      lang,
      updatedAt: new Date().toLocaleString(lang === "en" ? "en-US" : "es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
    });
  } catch (e) {
    console.error("[notion] Export failed:", e.message);
  }
}

module.exports = { buildHomeView, triggerNotionExport };
