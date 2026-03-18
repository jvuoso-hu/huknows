const { t } = require("../utils/language");
const { getSuccessCount } = require("../utils/feedback");

const SLACK_ID_PATTERN = /\bU[A-Z0-9]{6,12}\b/g;
function sanitize(text) {
  return text ? text.replace(SLACK_ID_PATTERN, "").replace(/\s{2,}/g, " ").trim() : text;
}

const CONFIDENCE_EMOJI = {
  "coincidencia perfecta": "🔥", "perfect match": "🔥",
  "coincidencia alta": "⭐", "strong match": "⭐",
  "buen match": "💡", "good match": "💡",
  "coincidencia posible": "🔎", "potential match": "🔎",
  "posible ayuda": "👍", "low match, suggested connection": "👍",
};

function confidenceEmoji(confidence) {
  return CONFIDENCE_EMOJI[(confidence || "").toLowerCase()] || "🟡";
}

function buildMiniappBlock(miniappMatch, lang, query = "") {
  const { miniapp, squad, emName, pmName, emUserId, pmUserId, type } = miniappMatch;

  const showEM = emName && (type === "technical" || type === "both");
  const showPM = pmName && (type === "product" || type === "both");

  const emMention = emUserId ? `<@${emUserId}>` : `*${emName}*`;
  const pmMention = pmUserId ? `<@${pmUserId}>` : `*${pmName}*`;

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${t(lang, "miniappShortcutTitle")}\n${t(lang, "miniappRelatedTo", miniapp, squad)}`,
      },
    },
  ];

  if (showEM) {
    const section = {
      type: "section",
      text: { type: "mrkdwn", text: t(lang, "miniappTechnical", emMention) },
    };
    if (emUserId) {
      section.accessory = {
        type: "button",
        text: { type: "plain_text", text: t(lang, "miniappConnectWith", emName) },
        style: "primary",
        action_id: "connect_expert",
        value: JSON.stringify({
          userId: emUserId, query, example: null, channelCount: 0,
          explanation: t(lang, "miniappEMExplanation", miniapp),
          briefMessage: t(lang, "miniappEMBrief", miniapp),
          briefMessageExpert: t(lang, "miniappEMBrief", miniapp),
          wasRecommended: false, lang,
        }),
      };
    }
    blocks.push(section);
  }

  if (showPM) {
    const section = {
      type: "section",
      text: { type: "mrkdwn", text: t(lang, "miniappProduct", pmMention) },
    };
    if (pmUserId) {
      section.accessory = {
        type: "button",
        text: { type: "plain_text", text: t(lang, "miniappConnectWith", pmName) },
        style: "primary",
        action_id: "connect_expert",
        value: JSON.stringify({
          userId: pmUserId, query, example: null, channelCount: 0,
          explanation: t(lang, "miniappPMExplanation", miniapp),
          briefMessage: t(lang, "miniappPMBrief", miniapp),
          briefMessageExpert: t(lang, "miniappPMBrief", miniapp),
          wasRecommended: false, lang,
        }),
      };
    }
    blocks.push(section);
  }

  return blocks;
}

function buildResultBlocks(query, experts, lang = "es", miniappMatch = null) {
  const successCount = getSuccessCount(query);
  const isSingle = experts.length === 1;

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: t(lang, "resultIntro") },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: isSingle
          ? t(lang, "singleExpertHeader", query)
          : t(lang, "topExpertsHeader", query),
      },
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
    const { userId, name, confidence, explanation, briefMessage, briefMessageExpert, dnd, example, channelCount, wasRecommended, lowActivity } = experts[i];

    const nameLabel = (isSingle && !lowActivity) ? `<@${userId}>` : `*${i + 1 > 1 || !isSingle ? `${i + 1}. ` : ""}${name}*`;
    const statusLabel = lowActivity
      ? t(lang, "lowActivityBadge")
      : `${dnd.emoji} ${dnd.label}`;

    let text = `${nameLabel}  ${statusLabel}`;
    text += `\n${confidenceEmoji(confidence)} *${confidence}*`;

    const channelName = example?.channelName;
    if (channelName) {
      const channelLine = lowActivity
        ? t(lang, "expertiseSignals", channelName)
        : example.isPrivate
        ? "🔒"
        : t(lang, "activeIn", channelName);
      text += `\n${channelLine}`;
    }

    const description = sanitize(briefMessage || explanation);
    if (description) {
      text += `\n\n${description}`;
    }

    if (lowActivity) {
      text += `\n\n${t(lang, "lowActivityWarning")}`;
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
          userId, expertName: name, query, example: example || null, channelCount,
          explanation: explanation || null, briefMessage: briefMessage || null,
          briefMessageExpert: briefMessageExpert || null,
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

function buildBrief(query, expertName, explanation, example, channelCount, briefMessage, lang = "es", wasRecommended = false, requesterUserId = null) {
  const lines = [
    t(lang, "briefGreeting", expertName),
    ``,
    t(lang, "briefIdentified", query),
  ];

  const reason = sanitize(briefMessage || explanation);
  const channel = example?.channelName;
  const isPrivate = example?.isPrivate;

  if (isPrivate) {
    lines.push(``, reason ? t(lang, "briefWhyPrivate", reason) : t(lang, "briefWhyPrivateGeneric"));
  } else if (reason && channel) {
    lines.push(``, t(lang, "briefWhyChannel", reason, channel));
  } else if (reason) {
    lines.push(``, t(lang, "briefWhy", reason));
  } else if (channel) {
    lines.push(``, t(lang, "briefWhyGeneric", channel));
  }

  if (wasRecommended) {
    lines.push(``, t(lang, "briefWasRecommended"));
  }

  if (requesterUserId) {
    lines.push(``, t(lang, "briefCTA", requesterUserId));
  }

  lines.push(``, t(lang, "briefFooter"));
  return lines.join("\n");
}

module.exports = { buildResultBlocks, buildNoExpertsBlocks, buildBrief };
