const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

async function interpretAvailabilityBatch(users, lang = "es") {
  const langInstruction = lang === "en" ? "Respond in English." : "Responde en español.";

  const userList = users
    .map((u) => {
      const parts = [
        `userId: ${u.userId}`,
        `presence: ${u.presence}`,
        `dnd: ${u.dndEnabled ? `yes, ends at ${u.dndEndsAt || "unknown"}` : "no"}`,
        `statusEmoji: "${u.statusEmoji || ""}"`,
        `statusText: "${u.statusText || ""}"`,
        `statusExpires: ${u.statusExpires || "no expiry"}`,
      ];
      return `- ${parts.join(", ")}`;
    })
    .join("\n");

  const prompt = `Interpret the current availability of these people based on their Slack status. ${langInstruction}

${userList}

For each person, write a short availability label (max 30 chars). Consider:
- If they have a status like "Doctor", "Lunch", "Gym", interpret what that means
- If the status has an expiry time, include "until HH:MM" or "libre a las HH:MM"
- If they are in a meeting, say so with the end time if available
- If presence is "away" and no status, just say away/ausente
- If fully available, say so

Return ONLY valid JSON array:
[
  {
    "userId": "...",
    "emoji": "<🟢 if available | 🟡 if busy but free soon | 🔴 if DND or in meeting | ⚪ if away/unknown>",
    "label": "<short label in detected language>"
  }
]`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return users.map(() => ({ emoji: "⚪", label: "?" }));

  return JSON.parse(jsonMatch[0]);
}

module.exports = { interpretAvailabilityBatch };
