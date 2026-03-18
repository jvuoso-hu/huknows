const { interpretAvailabilityBatch } = require("../services/aiStatus");

function timeUntil(unixTs, lang = "es") {
  if (!unixTs || unixTs === 0) return null;
  const ms = unixTs * 1000 - Date.now();
  if (ms <= 0) return null;
  const isEs = lang !== "en";
  const totalMins = Math.round(ms / 60000);
  const totalHours = Math.floor(totalMins / 60);
  const totalDays = Math.floor(totalHours / 24);
  if (totalMins < 60) {
    return isEs ? `en ${totalMins} minutos` : `in ${totalMins} minutes`;
  }
  if (totalHours < 24) {
    const mins = totalMins % 60;
    return mins === 0
      ? (isEs ? `en ${totalHours}h` : `in ${totalHours}h`)
      : (isEs ? `en ${totalHours}h ${mins}min` : `in ${totalHours}h ${mins}min`);
  }
  const hours = totalHours % 24;
  return hours === 0
    ? (isEs ? `en ${totalDays} días` : `in ${totalDays} days`)
    : (isEs ? `en ${totalDays} días y ${hours}hs` : `in ${totalDays} days and ${hours}h`);
}

function formatTime(unixTs) {
  if (!unixTs || unixTs === 0) return null;
  const tz = "America/Argentina/Buenos_Aires";
  const date = new Date(unixTs * 1000);
  const now = new Date();
  const sameDay =
    date.toLocaleDateString("es-AR", { timeZone: tz }) ===
    now.toLocaleDateString("es-AR", { timeZone: tz });
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  if (sameDay) return time;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: tz }) + " " + time;
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
        dndEndsAt: timeUntil(dndResult?.next_dnd_end_ts, lang),
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
