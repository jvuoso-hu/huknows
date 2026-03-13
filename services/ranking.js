const { identifyExpertsWithAI } = require("./aiRanking");
const cache = require("../utils/cache");
const { getNegativeExperts, getSuggestedExperts } = require("../utils/feedback");

const MAX_CANDIDATES = 200;
const MAX_THREADS = 30;

async function getAllChannels(client, logger) {
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
  logger.info(`Found ${channels.length} channels`);
  return channels;
}

async function fetchThreadReplies(client, channel, messages) {
  const withThreads = messages
    .filter((m) => m.reply_count > 0 && m.thread_ts && !m.subtype)
    .sort((a, b) => b.reply_count - a.reply_count)
    .slice(0, MAX_THREADS);

  const results = await Promise.allSettled(
    withThreads.map(async (msg) => {
      const cacheKey = `thread:${channel.id}:${msg.ts}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      const r = await client.conversations.replies({ channel: channel.id, ts: msg.ts, limit: 50 });
      const replies = (r.messages || []).slice(1); // skip parent
      cache.set(cacheKey, replies);
      return replies;
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

async function fetchUserTitles(client, userIds) {
  const titles = {};
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const r = await client.users.info({ user: userId });
        const title = r.user?.profile?.title;
        if (title) titles[userId] = title;
      } catch {}
    })
  );
  return titles;
}

async function rankExperts(client, query, requesterUserId, logger, onProgress) {
  const channels = await getAllChannels(client, logger);

  await onProgress?.(`📖 _Leyendo ${channels.length} canales..._`);

  // Fetch all channel histories in parallel, with cache
  const historyResults = await Promise.allSettled(
    channels.map(async (channel) => {
      const cached = cache.get(channel.id);
      if (cached) return { channel, messages: cached };
      const h = await client.conversations.history({ channel: channel.id, limit: 100 });
      const messages = h.messages || [];
      cache.set(channel.id, messages);
      return { channel, messages };
    })
  );

  const candidates = [];
  const userChannels = {};
  const threadFetches = [];

  for (const result of historyResults) {
    if (result.status !== "fulfilled") continue;
    const { channel, messages } = result.value;

    for (const message of messages) {
      if (!message.user || message.subtype) continue;
      if (message.user === requesterUserId) continue;
      candidates.push({
        userId: message.user,
        text: message.text,
        channelName: channel.name,
        isPrivate: channel.is_private || false,
      });
      if (!userChannels[message.user]) userChannels[message.user] = new Set();
      userChannels[message.user].add(channel.name);
    }

    // Queue thread fetches
    threadFetches.push({ channel, messages });
  }

  // Fetch threads in parallel across all channels
  const allThreadReplies = await Promise.allSettled(
    threadFetches.map(({ channel, messages }) => fetchThreadReplies(client, channel, messages))
  );

  for (let i = 0; i < threadFetches.length; i++) {
    const result = allThreadReplies[i];
    if (result.status !== "fulfilled") continue;
    const { channel } = threadFetches[i];

    for (const reply of result.value) {
      if (!reply.user || reply.subtype) continue;
      if (reply.user === requesterUserId) continue;
      candidates.push({
        userId: reply.user,
        text: reply.text,
        channelName: channel.name,
        isPrivate: channel.is_private || false,
        isThread: true,
      });
      if (!userChannels[reply.user]) userChannels[reply.user] = new Set();
      userChannels[reply.user].add(channel.name);
    }
  }

  // Fetch titles for unique users appearing in candidates
  const uniqueUserIds = [...new Set(candidates.map((c) => c.userId))];
  const userTitles = await fetchUserTitles(client, uniqueUserIds);

  await onProgress?.(`🧠 _Analizando con IA..._`);

  const allChannelNames = channels.map((c) => c.name);
  const negativeIds = getNegativeExperts(query).map((e) => e.userId);
  const suggestedIds = getSuggestedExperts(query).map((e) => e.userId);
  const suggestedSet = new Set(suggestedIds);

  // Ensure suggested experts appear in candidates even if they haven't posted about this topic
  for (const userId of suggestedIds) {
    if (!candidates.some((c) => c.userId === userId)) {
      candidates.push({
        userId,
        text: `[colleague-suggested expert for this topic — no matching messages found but human-validated]`,
        channelName: "suggestion",
        isPrivate: false,
      });
    }
  }
  const { lang, experts: aiResults, suggestedChannels } = await identifyExpertsWithAI(
    candidates.slice(0, MAX_CANDIDATES),
    query,
    allChannelNames,
    userTitles,
    negativeIds,
    suggestedIds
  );

  return {
    lang: lang || "es",
    suggestedChannels: suggestedChannels || [],
    experts: aiResults.map((expert) => {
      const userCandidates = candidates.filter((c) => c.userId === expert.userId);
      const hasPrivateSource = userCandidates.some((c) => c.isPrivate);
      const firstCandidate = userCandidates[0];
      return {
        userId: expert.userId,
        score: expert.score,
        confidence: expert.confidence,
        explanation: expert.explanation,
        briefMessage: expert.briefMessage || null,
        wasRecommended: suggestedSet.has(expert.userId),
        hasPrivateSource,
        example: expert.exampleText && !hasPrivateSource
          ? { text: expert.exampleText, channelName: firstCandidate?.channelName || "" }
          : hasPrivateSource
          ? { isPrivate: true, channelName: null }
          : null,
        channelCount: userChannels[expert.userId]?.size || 0,
      };
    }),
  };
}

module.exports = { rankExperts };
