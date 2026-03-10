const { t } = require("../utils/language");
const { getSuccessCount } = require("../utils/feedback");

function buildResultBlocks(query, experts, lang = "es") {
  const successCount = getSuccessCount(query);

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🔎 ${t(lang, "topExperts", query)}` },
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
    const { userId, name, confidence, explanation, dnd, example, channelCount } = experts[i];

    const channelInfo =
      channelCount > 1
        ? `active in ${channelCount} channels`
        : example?.channelName
        ? `active in #${example.channelName}`
        : "";

    let text = `*${i + 1}. ${name}*  ${dnd.emoji} ${dnd.label}`;
    text += `\n${confidence}${channelInfo ? ` · ${channelInfo}` : ""}`;

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
        value: JSON.stringify({ userId, query, example: example || null, channelCount, explanation: explanation || null, lang }),
      },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: t(lang, "helpful") },
          action_id: "feedback_helpful",
          value: JSON.stringify({ query, lang }),
        },
      ],
    }
  );

  return blocks;
}

function buildBrief(query, expertName, explanation, example, channelCount) {
  const lines = [
    `👋 Hi ${expertName}!`,
    ``,
    `🧠 *HuKnows identified you as one of the most relevant people to help with this topic.*`,
    ``,
    `📌 *Topic:* ${query}`,
  ];

  if (explanation) {
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

module.exports = { buildResultBlocks, buildBrief };
