require("dotenv").config();

const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function extractKeywords(text) {
  const stopwords = new Set([
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "y",
    "o",
    "que",
    "en",
    "con",
    "para",
    "por",
    "un",
    "una",
    "unos",
    "unas",
    "lo",
    "al",
    "se",
    "me",
    "mi",
    "tu",
    "su",
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
  ]);

  return normalize(text)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

function scoreMessage(messageText, keywords) {
  const text = normalize(messageText);
  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

async function getAllReadablePublicChannels(client, logger) {
  const channels = [];
  let cursor;

  do {
    const result = await client.conversations.list({
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });

    channels.push(...(result.channels || []));
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  logger.info(
    `Canales públicos encontrados: ${channels.map((c) => c.name).join(", ")}`,
  );

  return channels;
}

async function rankExperts(client, query, requesterUserId, logger) {
  const keywords = extractKeywords(query);
  const channels = await getAllReadablePublicChannels(client, logger);

  const userScores = {};
  const userExamples = {};

  for (const channel of channels) {
    try {
      const history = await client.conversations.history({
        channel: channel.id,
        limit: 100,
      });

      for (const message of history.messages || []) {
        if (!message.user || message.subtype) continue;
        if (message.user === requesterUserId) continue;

        const score = scoreMessage(message.text, keywords);
        if (score <= 0) continue;

        userScores[message.user] = (userScores[message.user] || 0) + score;

        if (!userExamples[message.user]) {
          userExamples[message.user] = {
            text: message.text,
            channelName: channel.name,
          };
        }
      }
    } catch (error) {
      logger.warn(
        `No pude leer #${channel.name}: ${error.data?.error || error.message}`,
      );
    }
  }

  return Object.entries(userScores)
    .map(([userId, score]) => ({
      userId,
      score,
      example: userExamples[userId],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function getUserLabel(client, userId) {
  const result = await client.users.info({ user: userId });
  const user = result.user;
  return user?.real_name || user?.name || userId;
}

async function getDndStatus(client, userId) {
  try {
    const result = await client.dnd.info({ user: userId });

    if (result.snooze_enabled && result.next_dnd_end_ts) {
      const freeAt = new Date(result.next_dnd_end_ts * 1000).toLocaleTimeString(
        "es-AR",
        { hour: "2-digit", minute: "2-digit" },
      );
      return `DND hasta ${freeAt}`;
    }

    return "Disponible";
  } catch {
    return "Estado no disponible";
  }
}

function buildBrief(query, expertName, example) {
  const lines = [
    `👋 Hi ${expertName}!`,
    ``,
    `🧠 *HuKnows identified you as one of the most relevant people to help with this topic.*`,
    ``,
    `📌 *Topic:* ${query}`,
  ];

  if (example) {
    lines.push(
      `💬 *Why you:* you recently discussed this in *#${example.channelName}*.`,
    );
  }

  lines.push(
    ``,
    `⚡ This connection was generated automatically to speed up internal problem solving.`,
  );

  return lines.join("\n");
}

app.command("/huknows", async ({ command, ack, respond, client, logger }) => {
  try {
    await ack();

    const query = (command.text || "").trim();

    if (!query) {
      await respond({
        response_type: "ephemeral",
        text: "Usá el comando así: /huknows <tema o problema>",
      });
      return;
    }

    const ranked = await rankExperts(client, query, command.user_id, logger);

    if (!ranked.length) {
      await respond({
        response_type: "ephemeral",
        text: `No encontré expertos claros para *${query}* en los canales públicos que puedo leer.`,
      });
      return;
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔎 *Top experts for:* ${query}`,
        },
      },
    ];

    for (let i = 0; i < ranked.length; i++) {
      const item = ranked[i];
      const userLabel = await getUserLabel(client, item.userId);
      const dndStatus = await getDndStatus(client, item.userId);

      let text = `👤 *${i + 1}. ${userLabel}* — score ${item.score} — 🟢 ${dndStatus}`;
      if (item.example) {
        text += `\n_${item.example.channelName}: ${item.example.text.slice(0, 100)}..._`;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: `🔗 Connect #${i + 1}`,
          },
          action_id: "connect_expert",
          value: JSON.stringify({
            userId: item.userId,
            query,
            example: item.example || null,
          }),
        },
      });
    }

    await respond({
      response_type: "ephemeral",
      text: `🔎 Top experts for: ${query}`,
      blocks,
    });
  } catch (error) {
    logger.error("Error en /huknows:", error);

    await respond({
      response_type: "ephemeral",
      text: "Hubo un error buscando expertos.",
    });
  }
});

app.action("connect_expert", async ({ ack, body, client, action, logger }) => {
  try {
    await ack();

    const payload = JSON.parse(action.value);
    const requesterUserId = body.user.id;
    const expertUserId = payload.userId;

    const expertName = await getUserLabel(client, expertUserId);

    const opened = await client.conversations.open({
      users: `${requesterUserId},${expertUserId}`,
    });

    const channelId = opened.channel.id;
    const brief = buildBrief(payload.query, expertName, payload.example);

    await client.chat.postMessage({
      channel: channelId,
      text: brief,
    });

    // opcional: feedback ephemeral al usuario
    if (body.container?.channel_id) {
      await client.chat.postEphemeral({
        channel: body.container.channel_id,
        user: requesterUserId,
        text: `🤝 Connected with *${expertName}*. I opened the chat and sent the brief.`,
      });
    }
  } catch (error) {
    logger.error("Error en connect_expert:", error);
  }
});

(async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.start(port);
    console.log(`⚡️ HuKnows corriendo en http://localhost:${port}`);
  } catch (error) {
    console.error("Error levantando app:", error);
  }
})();
