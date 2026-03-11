const { identifyExpertsWithAI } = require("./aiRanking");

const MAX_CANDIDATES = 200;

async function getAllPublicChannels(client, logger) {
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

  logger.info(`Found ${channels.length} public channels`);
  return channels;
}

async function rankExperts(client, query, requesterUserId, logger) {
  const channels = await getAllPublicChannels(client, logger);
  const candidates = [];
  const userChannels = {};

  // Fetch all channel histories in parallel
  const results = await Promise.allSettled(
    channels.map((channel) =>
      client.conversations.history({ channel: channel.id, limit: 100 })
        .then((h) => ({ channel, messages: h.messages || [] }))
    )
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { channel, messages } = result.value;

    for (const message of messages) {
      if (!message.user || message.subtype) continue;
      if (message.user === requesterUserId) continue;

      candidates.push({
        userId: message.user,
        text: message.text,
        channelName: channel.name,
      });

      if (!userChannels[message.user]) userChannels[message.user] = new Set();
      userChannels[message.user].add(channel.name);
    }
  }

  logger.info(`Sending ${Math.min(candidates.length, MAX_CANDIDATES)} messages to Claude for: ${query}`);

  const { lang, experts: aiResults } = await identifyExpertsWithAI(candidates.slice(0, MAX_CANDIDATES), query);

  return {
    lang: lang || "es",
    experts: aiResults.map((expert) => ({
      userId: expert.userId,
      score: expert.score,
      confidence: expert.confidence,
      explanation: expert.explanation,
      example: expert.exampleText
        ? {
            text: expert.exampleText,
            channelName: candidates.find((c) => c.userId === expert.userId)?.channelName || "",
          }
        : null,
      channelCount: userChannels[expert.userId]?.size || 0,
    })),
  };
}

module.exports = { rankExperts };
