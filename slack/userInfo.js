const { interpretAvailabilityBatch } = require("../services/aiStatus");

function formatTime(unixTs) {
  if (!unixTs || unixTs === 0) return null;
  return new Date(unixTs * 1000).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

async function enrichExperts(client, experts, lang = "es") {
  // Fetch all user data in parallel across all experts
  const rawData = await Promise.all(
    experts.map(async (expert) => {
      const [userInfo, dndResult, presenceResult] = await Promise.all([
        client.users.info({ user: expert.userId }),
        client.dnd.info({ user: expert.userId }).catch(() => null),
        client.users.getPresence({ user: expert.userId }).catch(() => null),
      ]);

      const user = userInfo.user;
      const profile = user?.profile || {};

      return {
        ...expert,
        name: user?.real_name || user?.name || expert.userId,
        presence: presenceResult?.presence || "away",
        dndEnabled: dndResult?.snooze_enabled || false,
        dndEndsAt: formatTime(dndResult?.next_dnd_end_ts),
        statusText: profile.status_text || "",
        statusEmoji: profile.status_emoji || "",
        statusExpires: formatTime(profile.status_expiration),
      };
    })
  );

  // Interpret all availabilities in a single Claude call
  const availabilities = await interpretAvailabilityBatch(rawData, lang);

  // Map availabilities back by userId (safer than index)
  const availMap = Object.fromEntries(availabilities.map((a) => [a.userId, a]));

  return rawData.map((user) => {
    const avail = availMap[user.userId] || { emoji: "⚪", label: "?" };
    // If the user set their own status emoji, use it instead of the color circle
    const emoji = user.statusEmoji || avail.emoji;
    return { ...user, dnd: { emoji, label: avail.label } };
  });
}

module.exports = { enrichExperts };
