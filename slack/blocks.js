const { t } = require("../utils/language");
const { getSuccessCount } = require("../utils/feedback");

const CONFIDENCE_EMOJI = {
  "coincidencia fuerte": "🔥", "strong match": "🔥",
  "buena coincidencia": "✅", "good match": "✅",
  "posible coincidencia": "🤔", "possible match": "🤔",
};

function confidenceEmoji(confidence) {
  return CONFIDENCE_EMOJI[(confidence || "").toLowerCase()] || "🔍";
}

function buildResultBlocks(query, experts, lang = "es") {
  const successCount = getSuccessCount(query);

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: t(lang, "topExperts", query) },
    },
  ];

  if (successCount > 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: t(lang, "frequentBadge", successCount) }],
    });
  }

  blocks.push({ type: "divider" });

  for (let i = 0; i < experts.length; i++) {
    const { userId, name, confidence, explanation, briefMessage, dnd, example, channelCount } = experts[i];

    const channelInfo =
      channelCount > 1
        ? `${channelCount} channels`
        : example?.channelName
        ? `#${example.channelName}`
        : "";

    let text = `*${i + 1}. ${name}*  ${dnd.emoji} ${dnd.label}`;
    text += `\n${confidenceEmoji(confidence)} ${confidence}${channelInfo ? ` · ${channelInfo}` : ""}`;

    if (explanation) {
      text += `\n_${explanation}_`;
    } else if (example) {
      const snippet = example.text.slice(0, 120).replace(/\n/g, " ");
      text += `\n_"${snippet}${example.text.length > 120 ? "..." : ""}"_`;
    }

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: t(lang, "connect") },
        style: "primary",
        action_id: "connect_expert",
        value: JSON.stringify({
          userId, query, example: example || null, channelCount,
          explanation: explanation || null, briefMessage: briefMessage || null, lang,
        }),
      },
    });
  }

  return blocks;
}

function buildNoExpertsBlocks(query, suggestedChannels, lang = "es") {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: t(lang, "topExperts", query) },
    },
    { type: "divider" },
  ];

  if (suggestedChannels.length > 0) {
    const channelList = suggestedChannels.map((c) => `• #${c}`).join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `${t(lang, "tryChannels")}\n${channelList}` },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: t(lang, "noExpertsNoChannels", query) },
    });
  }

  return blocks;
}

function buildBrief(query, expertName, explanation, example, channelCount, briefMessage) {
  const lines = [
    `👋 Hi ${expertName}!`,
    ``,
    `🧠 *HuKnows identified you as one of the most relevant people to help with this topic.*`,
    ``,
    `📌 *Topic:* ${query}`,
  ];

  if (briefMessage) {
    lines.push(`💬 ${briefMessage}`);
  } else if (explanation) {
    lines.push(`💬 *Why you:* ${explanation}`);
  } else if (example) {
    const reason =
      channelCount > 1
        ? `you've discussed this across ${channelCount} channels, including *#${example.channelName}*`
        : `you recently discussed this in *#${example.channelName}*`;
    lines.push(`💬 *Why you:* ${reason}`);
  }

  lines.push(
    ``,
    `⚡ This connection was generated automatically to speed up internal problem solving.`
  );

  return lines.join("\n");
}

module.exports = { buildResultBlocks, buildNoExpertsBlocks, buildBrief };
