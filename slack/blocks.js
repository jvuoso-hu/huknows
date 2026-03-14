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

  const lines = [`🧩 *¿Es sobre la Mini-App ${miniapp}?* _(${squad})_`];
  if (showEM) lines.push(`• Algo técnico → hablar con *${emName}* _(Engineering Manager)_`);
  if (showPM) lines.push(`• Algo de producto → hablar con *${pmName}* _(Product Manager)_`);

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
  ];

  // Connect buttons for resolved users
  const buttons = [];
  if (showEM && emUserId) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: `Conectar con ${emName}` },
      style: "primary",
      action_id: "connect_expert",
      value: JSON.stringify({
        userId: emUserId,
        query,
        example: null,
        channelCount: 0,
        explanation: `Engineering Manager de la Mini-App ${miniapp}`,
        briefMessage: `Como *Engineering Manager* de *${miniapp}*, te contactamos porque la consulta parece ser de índole técnica.`,
        wasRecommended: false,
        lang,
      }),
    });
  }
  if (showPM && pmUserId) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: `Conectar con ${pmName}` },
      style: "primary",
      action_id: "connect_expert",
      value: JSON.stringify({
        userId: pmUserId,
        query,
        example: null,
        channelCount: 0,
        explanation: `Product Manager de la Mini-App ${miniapp}`,
        briefMessage: `Como *Product Manager* de *${miniapp}*, te contactamos porque la consulta parece estar relacionada con producto o experiencia.`,
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

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: t(lang, "topExperts", query) },
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
    if (wasRecommended) {
      text += `\n${t(lang, "wasRecommended")}`;
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
