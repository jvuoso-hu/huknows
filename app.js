require("dotenv").config();

const { App } = require("@slack/bolt");
const { rankExperts } = require("./services/ranking");
const { enrichExperts } = require("./slack/userInfo");
const { buildResultBlocks, buildBrief } = require("./slack/blocks");

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
        text: "Usage: `/huknows <topic or problem>`",
      });
      return;
    }

    // Acknowledge immediately so the user knows something is happening
    await respond({
      response_type: "ephemeral",
      text: `🔍 Searching for experts on _${query}_...`,
    });

    const ranked = await rankExperts(client, query, command.user_id, logger);

    if (!ranked.length) {
      await respond({
        response_type: "ephemeral",
        replace_original: true,
        text: `No clear experts found for *${query}* in the public channels I can read.`,
      });
      return;
    }

    const experts = await enrichExperts(client, ranked);
    const blocks = buildResultBlocks(query, experts);

    await respond({
      response_type: "ephemeral",
      replace_original: true,
      text: `Top experts for: ${query}`,
      blocks,
    });
  } catch (error) {
    logger.error("Error in /huknows:", error);
    await respond({
      response_type: "ephemeral",
      replace_original: true,
      text: "Something went wrong while searching for experts.",
    });
  }
});

app.action("connect_expert", async ({ ack, body, client, action, logger }) => {
  try {
    await ack();

    const { userId: expertUserId, query, example, channelCount, explanation } = JSON.parse(action.value);
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
        text: `🤝 Connected with *${expertName}*. Chat opened and brief sent.`,
      });
    }
  } catch (error) {
    logger.error("Error in connect_expert:", error);
  }
});

(async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.start(port);
  console.log(`⚡️ HuKnows running on http://localhost:${port}`);
})();
