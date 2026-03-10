const STOPWORDS = new Set([
  "el", "la", "los", "las", "de", "del", "y", "o", "que", "en", "con",
  "para", "por", "un", "una", "unos", "unas", "lo", "al", "se", "me",
  "mi", "tu", "su", "es", "no", "si", "hay", "como", "este", "esta",
  "más", "pero", "muy", "the", "a", "an", "and", "or", "to", "of",
  "in", "on", "for", "is", "it", "its", "was", "are", "be", "has",
]);

const RECENCY_DAYS = 14;
const RECENCY_MULTIPLIER = 1.5;

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function extractKeywords(text) {
  return normalize(text)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function scoreMessage(messageText, keywords) {
  const text = normalize(messageText);
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += 1;
  }
  return score;
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

async function rankExperts(client, query, requesterUserId, logger) {
  const keywords = extractKeywords(query);
  if (!keywords.length) return [];

  const channels = await getAllPublicChannels(client, logger);
  const cutoff = Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000;

  const userScores = {};
  const userBestExample = {};
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

      const baseScore = scoreMessage(message.text, keywords);
      if (baseScore <= 0) continue;

      const ts = parseFloat(message.ts) * 1000;
      const score = ts > cutoff ? baseScore * RECENCY_MULTIPLIER : baseScore;

      userScores[message.user] = (userScores[message.user] || 0) + score;

      if (!userChannels[message.user]) userChannels[message.user] = new Set();
      userChannels[message.user].add(channel.name);

      // Keep the best example (highest base score per user)
      if (!userBestExample[message.user] || baseScore > userBestExample[message.user].score) {
        userBestExample[message.user] = {
          text: message.text,
          channelName: channel.name,
          score: baseScore,
        };
      }
    }
  }

  return Object.entries(userScores)
    .map(([userId, score]) => ({
      userId,
      score: Math.round(score),
      example: userBestExample[userId],
      channelCount: userChannels[userId]?.size || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

module.exports = { rankExperts, extractKeywords };
