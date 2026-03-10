async function getUserLabel(client, userId) {
  const result = await client.users.info({ user: userId });
  const user = result.user;
  return user?.real_name || user?.name || userId;
}

async function getDndStatus(client, userId) {
  try {
    const result = await client.dnd.info({ user: userId });
    if (result.snooze_enabled) {
      if (result.next_dnd_end_ts) {
        const freeAt = new Date(result.next_dnd_end_ts * 1000).toLocaleTimeString("en", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return { emoji: "🔴", label: `DND until ${freeAt}` };
      }
      return { emoji: "🔴", label: "Do Not Disturb" };
    }
    return { emoji: "🟢", label: "Available" };
  } catch {
    return { emoji: "⚪", label: "Unknown" };
  }
}

// Enriches a list of ranked experts with name + DND status in parallel
async function enrichExperts(client, experts) {
  return Promise.all(
    experts.map(async (expert) => {
      const [name, dnd] = await Promise.all([
        getUserLabel(client, expert.userId),
        getDndStatus(client, expert.userId),
      ]);
      return { ...expert, name, dnd };
    })
  );
}

module.exports = { getUserLabel, getDndStatus, enrichExperts };
