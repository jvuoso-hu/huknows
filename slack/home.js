const { getTopQueries, getTopExperts, getRecentSearches } = require("../utils/feedback");

async function buildHomeView(client, userId) {
  const topQueries = getTopQueries(5);
  const topExperts = getTopExperts(3);
  const recentSearches = getRecentSearches(userId);

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🧠 HuKnows — El AI que sabe quién sabe" },
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

  // Top queries across workspace
  if (topQueries.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔥 Temas más buscados*\n${topQueries
          .map((q) => `• _${q.query}_ · ${q.count} ${q.count === 1 ? "búsqueda" : "búsquedas"}`)
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
