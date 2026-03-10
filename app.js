require("dotenv").config();

const { App } = require("@slack/bolt");
const { rankExperts } = require("./services/ranking");
const { enrichExperts } = require("./slack/userInfo");
const { buildResultBlocks, buildBrief } = require("./slack/blocks");
const { t } = require("./utils/language");
const { recordSuccess } = require("./utils/feedback");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.command("/huknows", async ({ command, ack, respond, client, logger }) => {
  try {
    await ack();

    const query = (command.text || "").trim();

    if (!query) {
      await respond({
        response_type: "ephemeral",
        text: t("es", "noQuery"),
      });
      return;
    }

    // Send immediate feedback before the AI call
    await respond({
      response_type: "ephemeral",
      text: `🔍 _${query}_...`,
    });

    const { lang, experts: ranked } = await rankExperts(client, query, command.user_id, logger);

    if (!ranked.length) {
      await respond({
        response_type: "ephemeral",
        replace_original: true,
        text: t(lang, "noExperts", query),
      });
      return;
    }

    const experts = await enrichExperts(client, ranked, lang);
    const blocks = buildResultBlocks(query, experts, lang);

    await respond({
      response_type: "ephemeral",
      replace_original: true,
      text: t(lang, "topExperts", query),
      blocks,
    });
  } catch (error) {
    logger.error("Error in /huknows:", error);
    await respond({
      response_type: "ephemeral",
      replace_original: true,
      text: t("es", "error"),
    });
  }
});

app.action("connect_expert", async ({ ack, body, client, action, logger }) => {
  try {
    await ack();

    const { userId: expertUserId, query, example, channelCount, explanation, lang = "es" } = JSON.parse(action.value);
    const requesterUserId = body.user.id;

    const [expertName, opened] = await Promise.all([
      client.users.info({ user: expertUserId }).then((r) => r.user?.real_name || r.user?.name || expertUserId),
      client.conversations.open({ users: `${requesterUserId},${expertUserId}` }),
    ]);

    const channelId = opened.channel.id;
    const brief = buildBrief(query, expertName, explanation, example, channelCount);

    await client.chat.postMessage({ channel: channelId, text: brief });

    if (body.container?.channel_id) {
      await client.chat.postEphemeral({
        channel: body.container.channel_id,
        user: requesterUserId,
        text: t(lang, "connected", expertName),
      });
    }
  } catch (error) {
    logger.error("Error in connect_expert:", error);
  }
});

app.action("feedback_helpful", async ({ ack, body, respond, action }) => {
  await ack();

  const { query, lang = "es" } = JSON.parse(action.value);
  recordSuccess(query);

  // Replace the feedback button with a thank you note
  const originalBlocks = body.message?.blocks || [];
  const blocksWithoutButton = originalBlocks.filter((b) => b.type !== "actions");

  blocksWithoutButton.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: t(lang, "feedbackThanks") }],
  });

  await respond({
    replace_original: true,
    blocks: blocksWithoutButton,
  });
});

(async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.start(port);
  console.log(`⚡️ HuKnows running on http://localhost:${port}`);
})();
