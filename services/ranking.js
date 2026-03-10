const { identifyExpertsWithAI } = require("./aiRanking");

const STOPWORDS = new Set([
  "el", "la", "los", "las", "de", "del", "y", "o", "que", "en", "con",
  "para", "por", "un", "una", "unos", "unas", "lo", "al", "se", "me",
  "mi", "tu", "su", "es", "no", "si", "hay", "como", "este", "esta",
  "más", "pero", "muy", "the", "a", "an", "and", "or", "to", "of",
  "in", "on", "for", "is", "it", "its", "was", "are", "be", "has",
]);

const MAX_CANDIDATES = 200;

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function extractKeywords(text) {
  return normalize(text)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function isCandidate(messageText, keywords) {
  const text = normalize(messageText);
  return keywords.some((kw) => text.includes(kw));
}

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

async function rankExperts(client, query, requesterUserId, logger, lang = "es") {
  const keywords = extractKeywords(query);
  if (!keywords.length) return [];

  const channels = await getAllPublicChannels(client, logger);
  const candidates = [];
  const userChannels = {};

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
      if (!isCandidate(message.text, keywords)) continue;

      candidates.push({
        userId: message.user,
        text: message.text,
        channelName: channel.name,
      });

      if (!userChannels[message.user]) userChannels[message.user] = new Set();
      userChannels[message.user].add(channel.name);
    }
  }

  logger.info(`Found ${candidates.length} candidate messages for query: ${query}`);

  const aiResults = await identifyExpertsWithAI(candidates.slice(0, MAX_CANDIDATES), query, lang);

  return aiResults.map((expert) => ({
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
  }));
}

module.exports = { rankExperts };
