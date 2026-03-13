require("dotenv").config();

const { App } = require("@slack/bolt");
const { rankExperts } = require("./services/ranking");
const { enrichExperts } = require("./slack/userInfo");
const {
  buildResultBlocks,
  buildNoExpertsBlocks,
  buildBrief,
} = require("./slack/blocks");
const { t, detectLanguage } = require("./utils/language");
const { recordSuccess, recordSearch, recordNegativeFeedback, recordExpertSuggestion } = require("./utils/feedback");
const { syncExpertPoints } = require("./utils/airtable");
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

    // Immediate feedback — language-aware
    const queryLang = detectLanguage(query);
    await respond({ response_type: "ephemeral", text: t(queryLang, "iKnow", query) });

    const {
      lang,
      experts: ranked,
      suggestedChannels,
    } = await rankExperts(client, query, command.user_id, logger);

    if (!ranked.length) {
      await respond({
        response_type: "ephemeral",
        replace_original: true,
        text: t(lang, "noExperts", query),
        blocks: buildNoExpertsBlocks(query, suggestedChannels, lang),
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
    await respond({ response_type: "ephemeral", text: t("es", "error") });
  }
});

app.action("connect_expert", async ({ ack, body, client, action, respond, logger }) => {
  try {
    await ack();

    const {
      userId: expertUserId,
      query,
      example,
      channelCount,
      explanation,
      briefMessage,
      wasRecommended = false,
      lang = "es",
    } = JSON.parse(action.value);
    const requesterUserId = body.user.id;

    const [expertName, opened] = await Promise.all([
      client.users.info({ user: expertUserId }).then((r) => r.user?.real_name || r.user?.name || expertUserId),
      client.conversations.open({ users: `${requesterUserId},${expertUserId}` }),
    ]);
    const channelId = opened.channel.id;
    const brief = buildBrief(query, expertName, explanation, example, channelCount, briefMessage, lang, wasRecommended);

    await client.chat.postMessage({ channel: channelId, text: brief });

    // Ephemeral feedback in the DM — two options: helpful or not
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
            {
              type: "button",
              text: { type: "plain_text", text: t(lang, "unhelpful") },
              action_id: "feedback_unhelpful_dm",
              value: JSON.stringify({ query, expertUserId, expertName, lang }),
            },
          ],
        },
      ],
    });
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

const pendingSuggestions = new Map();

app.action("feedback_unhelpful_dm", async ({ ack, action, respond, body }) => {
  await ack();
  const { query, expertUserId, lang } = JSON.parse(action.value);
  recordNegativeFeedback(query, [expertUserId]);
  pendingSuggestions.set(body.user.id, { query, lang });

  await respond({
    replace_original: true,
    text: t(lang, "unhelpfulAck", query),
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: t(lang, "unhelpfulAck", query) },
      },
      {
        type: "actions",
        elements: [
          {
            type: "users_select",
            placeholder: { type: "plain_text", text: t(lang, "selectExpert") },
            action_id: "suggest_expert",
          },
          {
            type: "button",
            text: { type: "plain_text", text: t(lang, "skipSuggestion") },
            action_id: "suggest_expert_skip",
          },
        ],
      },
    ],
  });
});

app.action("suggest_expert", async ({ ack, action, respond, body, client }) => {
  await ack();
  const suggestedUserId = action.selected_user;
  const pending = pendingSuggestions.get(body.user.id);
  if (!pending || !suggestedUserId) return;

  pendingSuggestions.delete(body.user.id);
  const { query, lang } = pending;
  recordExpertSuggestion(query, suggestedUserId);

  const name = await client.users.info({ user: suggestedUserId })
    .then((r) => r.user?.real_name || r.user?.name || suggestedUserId)
    .catch(() => suggestedUserId);

  await respond({
    replace_original: true,
    text: t(lang, "suggestionThanks", name),
  });
});

app.action("suggest_expert_skip", async ({ ack, respond, body }) => {
  await ack();
  pendingSuggestions.delete(body.user.id);
  await respond({ replace_original: true, text: "👍" });
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
  syncExpertPoints(expertUserId, expertName, query); // fire-and-forget

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
