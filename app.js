require("dotenv").config();

const { App } = require("@slack/bolt");
const { rankExperts } = require("./services/ranking");
const { enrichExperts } = require("./slack/userInfo");
const {
  buildResultBlocks,
  buildNoExpertsBlocks,
  buildBrief,
} = require("./slack/blocks");
const { t } = require("./utils/language");
const { recordSuccess, recordSearch } = require("./utils/feedback");
const { buildHomeView } = require("./slack/home");

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

    recordSearch(command.user_id, query);

    // Post a real (non-ephemeral) loading message so we can animate it via chat.update
    const loadingMsg = await client.chat.postMessage({
      channel: command.channel_id,
      text: `🔎 _${query}_`,
    });
    const loadingTs = loadingMsg.ts;

    // Animate dots by updating the same message — no response_url limit
    let animationStopped = false;
    let resolveAnim;
    const animDone = new Promise((r) => { resolveAnim = r; });
    (async () => {
      const frames = [".", "..", "..."];
      let i = 0;
      while (!animationStopped) {
        await new Promise((r) => setTimeout(r, 600));
        if (animationStopped) break;
        try {
          await client.chat.update({
            channel: command.channel_id,
            ts: loadingTs,
            text: `🔎 _${query}_${frames[i % frames.length]}`,
          });
        } catch {}
        i++;
      }
      resolveAnim();
    })();

    const onProgress = async (text) => {
      if (!animationStopped) {
        animationStopped = true;
        await animDone;
      }
      try {
        await client.chat.update({ channel: command.channel_id, ts: loadingTs, text });
      } catch {}
    };

    const {
      lang,
      experts: ranked,
      suggestedChannels,
    } = await rankExperts(client, query, command.user_id, logger, onProgress);

    // Stop animation and delete the loading message
    animationStopped = true;
    await animDone;
    await client.chat.delete({ channel: command.channel_id, ts: loadingTs }).catch(() => {});

    if (!ranked.length) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: t(lang, "noExperts", query),
        blocks: buildNoExpertsBlocks(query, suggestedChannels, lang),
      });
      return;
    }

    const experts = await enrichExperts(client, ranked, lang);
    const blocks = buildResultBlocks(query, experts, lang);

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: t(lang, "topExperts", query),
      blocks,
    });
  } catch (error) {
    logger.error("Error in /huknows:", error);
    await respond({ response_type: "ephemeral", text: t("es", "error") });
  }
});

app.action("connect_expert", async ({ ack, body, client, action, logger }) => {
  try {
    await ack();

    const {
      userId: expertUserId,
      query,
      example,
      channelCount,
      explanation,
      briefMessage,
      lang = "es",
    } = JSON.parse(action.value);
    const requesterUserId = body.user.id;

    const [expertName, opened] = await Promise.all([
      client.users
        .info({ user: expertUserId })
        .then((r) => r.user?.real_name || r.user?.name || expertUserId),
      client.conversations.open({
        users: `${requesterUserId},${expertUserId}`,
      }),
    ]);

    const channelId = opened.channel.id;
    const brief = buildBrief(query, expertName, explanation, example, channelCount, briefMessage, lang);

    await client.chat.postMessage({ channel: channelId, text: brief });

    // Ephemeral feedback button in the DM — only the requester sees it
    await client.chat.postEphemeral({
      channel: channelId,
      user: requesterUserId,
      text: t(lang, "feedbackPrompt", expertName),
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: t(lang, "feedbackPrompt", expertName) },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: t(lang, "helpful") },
              style: "primary",
              action_id: "feedback_helpful",
              value: JSON.stringify({ query, expertUserId, expertName, lang }),
            },
          ],
        },
      ],
    });

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

app.event("app_home_opened", async ({ event, client, logger }) => {
  try {
    const view = await buildHomeView(client, event.user);
    await client.views.publish({ user_id: event.user, view });
  } catch (error) {
    logger.error("Error building App Home:", error);
  }
});

app.action("feedback_helpful", async ({ ack, respond, action }) => {
  await ack();

  const {
    query,
    expertUserId,
    expertName,
    lang = "es",
  } = JSON.parse(action.value);
  recordSuccess(query, expertUserId);

  await respond({
    replace_original: true,
    text: t(lang, "feedbackThanks", expertName),
    blocks: [
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: t(lang, "feedbackThanks", expertName) },
        ],
      },
    ],
  });
});

(async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.start(port);
  console.log(`⚡️ HuKnows running on http://localhost:${port}`);
})();
