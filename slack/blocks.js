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

function buildMiniappBlock(miniappMatch, lang, query = "") {
  const { miniapp, squad, emName, pmName, emUserId, pmUserId, type } = miniappMatch;

  const showEM = emName && (type === "technical" || type === "both");
  const showPM = pmName && (type === "product" || type === "both");

  const lines = [t(lang, "miniappTitle", miniapp, squad)];
  if (showEM) lines.push(t(lang, "miniappTechnical", emName));
  if (showPM) lines.push(t(lang, "miniappProduct", pmName));

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
  ];

  // Connect buttons for resolved users
  const buttons = [];
  if (showEM && emUserId) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: t(lang, "miniappConnectWith", emName) },
      style: "primary",
      action_id: "connect_expert",
      value: JSON.stringify({
        userId: emUserId,
        query,
        example: null,
        channelCount: 0,
        explanation: t(lang, "miniappEMExplanation", miniapp),
        briefMessage: t(lang, "miniappEMBrief", miniapp),
        wasRecommended: false,
        lang,
      }),
    });
  }
  if (showPM && pmUserId) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: t(lang, "miniappConnectWith", pmName) },
      style: "primary",
      action_id: "connect_expert",
      value: JSON.stringify({
        userId: pmUserId,
        query,
        example: null,
        channelCount: 0,
        explanation: t(lang, "miniappPMExplanation", miniapp),
        briefMessage: t(lang, "miniappPMBrief", miniapp),
        wasRecommended: false,
        lang,
      }),
    });
  }

  if (buttons.length) {
    blocks.push({ type: "actions", elements: buttons });
  }

  return blocks;
}

function buildResultBlocks(query, experts, lang = "es", miniappMatch = null) {
  const successCount = getSuccessCount(query);
  const isSingle = experts.length === 1;

  const headerText = isSingle
    ? t(lang, "singleExpertHeader")
    : t(lang, "topExpertsHeader");

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${headerText}*` },
    },
  ];

  if (successCount > 5) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: t(lang, "frequentBadge", successCount) }],
    });
  }

  blocks.push({ type: "divider" });

  for (let i = 0; i < experts.length; i++) {
    const { userId, name, confidence, explanation, briefMessage, dnd, example, channelCount, wasRecommended } = experts[i];

    const nameLabel = isSingle ? `<@${userId}>` : `*${i + 1}. ${name}*`;
    let text = `${nameLabel}  ${dnd.emoji} ${dnd.label}`;
    text += `\n${confidenceEmoji(confidence)} ${confidence}  ${t(lang, "topicLabel", query)}`;

    const channelName = example?.channelName;
    if (channelName) {
      text += `\n${example.isPrivate ? "🔒" : t(lang, "activeIn", channelName)}`;
    }

    const description = briefMessage || explanation;
    if (description) {
      text += `\n\n${description}`;
    }

    if (wasRecommended) {
      text += `\n${t(lang, "wasRecommended")}`;
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
          explanation: explanation || null, briefMessage: briefMessage || null,
          wasRecommended: wasRecommended || false, lang,
        }),
      },
    });
  }

  if (miniappMatch) {
    blocks.push({ type: "divider" });
    blocks.push(...buildMiniappBlock(miniappMatch, lang, query));
  }

  return blocks;
}

function buildNoExpertsBlocks(query, suggestedChannels, lang = "es", miniappMatch = null) {
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

  if (miniappMatch) {
    blocks.push({ type: "divider" });
    blocks.push(...buildMiniappBlock(miniappMatch, lang, query));
  }

  return blocks;
}

function buildBrief(query, expertName, explanation, example, channelCount, briefMessage, lang = "es", wasRecommended = false) {
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

  if (wasRecommended) {
    lines.push(``, t(lang, "briefWasRecommended"));
  }
  lines.push(``, t(lang, "briefFooter"));
  return lines.join("\n");
}

module.exports = { buildResultBlocks, buildNoExpertsBlocks, buildBrief };
