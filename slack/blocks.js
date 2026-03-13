const { t } = require("../utils/language");
const { getSuccessCount } = require("../utils/feedback");

const CONFIDENCE_EMOJI = {
  "coincidencia fuerte": "🔥", "strong match": "🔥",
  "buena coincidencia": "✅", "good match": "✅",
  "posible coincidencia": "🤔", "possible match": "🤔",
  "coincidencia moderada": "🟡", "moderate match": "🟡",
};

function confidenceEmoji(confidence) {
  return CONFIDENCE_EMOJI[(confidence || "").toLowerCase()] || "🟡";
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
    }
    if (example?.isPrivate) {
      text += `  🔒`;
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

function buildBrief(query, expertName, explanation, example, channelCount, briefMessage, lang = "es") {
  const lines = [
    t(lang, "briefGreeting", expertName),
    ``,
    t(lang, "briefIdentified"),
    ``,
    t(lang, "briefTopic", query),
  ];

  if (example?.isPrivate) {
    lines.push(t(lang, "briefWhyPrivate"));
  } else if (briefMessage) {
    lines.push(`💬 ${briefMessage}`);
  } else if (explanation) {
    lines.push(t(lang, "briefWhy", explanation));
  } else if (example?.channelName) {
    const reason = channelCount > 1
      ? t(lang, "briefWhy", `${channelCount} channels incl. *#${example.channelName}*`)
      : t(lang, "briefWhy", `*#${example.channelName}*`);
    lines.push(reason);
  }

  lines.push(``, t(lang, "briefFooter"));
  return lines.join("\n");
}

module.exports = { buildResultBlocks, buildNoExpertsBlocks, buildBrief };
