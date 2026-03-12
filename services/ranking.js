const { identifyExpertsWithAI } = require("./aiRanking");
const cache = require("../utils/cache");

const MAX_CANDIDATES = 200;

async function getAllPublicChannels(client, logger) {
  const channels = [];
  let cursor;

  do {
    const result = await client.conversations.list({
      types: "public_channel,private_channel",
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

  // Fetch all channel histories in parallel, with cache
  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      const cached = cache.get(channel.id);
      if (cached) return { channel, messages: cached };
      const h = await client.conversations.history({ channel: channel.id, limit: 100 });
      const messages = h.messages || [];
      cache.set(channel.id, messages);
      return { channel, messages };
    })
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

  const allChannelNames = channels.map((c) => c.name);
  const { lang, experts: aiResults, suggestedChannels } = await identifyExpertsWithAI(candidates.slice(0, MAX_CANDIDATES), query, allChannelNames);

  return {
    lang: lang || "es",
    suggestedChannels: suggestedChannels || [],
    experts: aiResults.map((expert) => ({
      userId: expert.userId,
      score: expert.score,
      confidence: expert.confidence,
      explanation: expert.explanation,
      briefMessage: expert.briefMessage || null,
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
