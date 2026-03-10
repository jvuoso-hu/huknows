const { t } = require("../utils/language");

async function getUserLabel(client, userId) {
  const result = await client.users.info({ user: userId });
  const user = result.user;
  return user?.real_name || user?.name || userId;
}

async function getDndStatus(client, userId, lang = "es") {
  try {
    const [dndResult, presenceResult] = await Promise.all([
      client.dnd.info({ user: userId }),
      client.users.getPresence({ user: userId }),
    ]);

    if (dndResult.snooze_enabled) {
      if (dndResult.next_dnd_end_ts) {
        const freeAt = new Date(dndResult.next_dnd_end_ts * 1000).toLocaleTimeString("en", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return { emoji: "🔴", label: t(lang, "dndUntil", freeAt) };
      }
      return { emoji: "🔴", label: t(lang, "dnd") };
    }

    if (presenceResult.presence === "active") {
      return { emoji: "🟢", label: t(lang, "available") };
    }

    return { emoji: "⚪", label: t(lang, "away") };
  } catch {
    return { emoji: "⚪", label: t(lang, "away") };
  }
}

async function enrichExperts(client, experts, lang = "es") {
  return Promise.all(
    experts.map(async (expert) => {
      const [name, dnd] = await Promise.all([
        getUserLabel(client, expert.userId),
        getDndStatus(client, expert.userId, lang),
      ]);
      return { ...expert, name, dnd };
    })
  );
}

module.exports = { getUserLabel, getDndStatus, enrichExperts };
