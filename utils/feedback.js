const redis = require("../services/redis");

// In-memory store
const queryCounts = new Map();
const expertHelpCounts = new Map();
const userSearches = new Map();
const negativeExperts = new Map();
const suggestedExperts = new Map();
const recentConnections = [];
const connectionDurations = [];
const resolvedTopics = new Set();

const MAX_RECENT = 5;
const MAX_CONNECTIONS = 10;

// ─── Persistence ──────────────────────────────────────────────────────────────

function persist() {
  redis.set("hk:queryCounts",      Object.fromEntries(queryCounts)).catch(() => {});
  redis.set("hk:expertHelpCounts", Object.fromEntries(expertHelpCounts)).catch(() => {});
  redis.set("hk:userSearches",     Object.fromEntries(userSearches)).catch(() => {});
  redis.set("hk:negativeExperts",  Object.fromEntries(negativeExperts)).catch(() => {});
  redis.set("hk:suggestedExperts", Object.fromEntries(suggestedExperts)).catch(() => {});
  redis.set("hk:recentConnections", recentConnections).catch(() => {});
  redis.set("hk:connectionDurations", connectionDurations).catch(() => {});
  redis.set("hk:resolvedTopics",   [...resolvedTopics]).catch(() => {});
}

async function hydrate() {
  try {
    const [qc, ehc, us, ne, se, rc, cd, rt] = await Promise.all([
      redis.get("hk:queryCounts"),
      redis.get("hk:expertHelpCounts"),
      redis.get("hk:userSearches"),
      redis.get("hk:negativeExperts"),
      redis.get("hk:suggestedExperts"),
      redis.get("hk:recentConnections"),
      redis.get("hk:connectionDurations"),
      redis.get("hk:resolvedTopics"),
    ]);
    if (qc)  for (const [k, v] of Object.entries(qc))  queryCounts.set(k, v);
    if (ehc) for (const [k, v] of Object.entries(ehc)) expertHelpCounts.set(k, v);
    if (us)  for (const [k, v] of Object.entries(us))  userSearches.set(k, v);
    if (ne)  for (const [k, v] of Object.entries(ne))  negativeExperts.set(k, v);
    if (se)  for (const [k, v] of Object.entries(se))  suggestedExperts.set(k, v);
    if (rc)  recentConnections.push(...rc);
    if (cd)  connectionDurations.push(...cd);
    if (rt)  for (const v of rt) resolvedTopics.add(v);
    console.log("[redis] Hydrated in-memory state");
  } catch (e) {
    console.error("[redis] Hydration failed:", e.message);
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function recordSuccess(query, expertUserId, expertName = null) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
  if (expertUserId) {
    expertHelpCounts.set(expertUserId, (expertHelpCounts.get(expertUserId) || 0) + 1);
    recentConnections.unshift({ query, expertUserId, expertName, ts: Date.now() });
    if (recentConnections.length > MAX_CONNECTIONS) recentConnections.pop();
    resolvedTopics.add(key);
  }
  persist();
}

function recordConnect(userId, query) {
  const searches = userSearches.get(userId) || [];
  const key = query.toLowerCase().trim();
  const match = searches.find((s) => s.query.toLowerCase().trim() === key);
  if (match) {
    const duration = Date.now() - match.ts;
    connectionDurations.push(duration);
    persist();
    return duration;
  }
  return null;
}

function recordSearch(userId, query) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
  const list = userSearches.get(userId) || [];
  list.unshift({ query, ts: Date.now() });
  userSearches.set(userId, list.slice(0, MAX_RECENT));
  persist();
}

function recordNegativeFeedback(query, expertIds) {
  const base = query.toLowerCase().trim();
  for (const userId of expertIds) {
    const k = `${base}:${userId}`;
    negativeExperts.set(k, (negativeExperts.get(k) || 0) + 1);
  }
  persist();
}

function recordExpertSuggestion(query, suggestedUserId) {
  const k = `${query.toLowerCase().trim()}:${suggestedUserId}`;
  suggestedExperts.set(k, (suggestedExperts.get(k) || 0) + 1);
  persist();
}

// ─── Reads ────────────────────────────────────────────────────────────────────

function getSuccessCount(query)       { return queryCounts.get(query.toLowerCase().trim()) || 0; }
function getExpertHelpCount(userId)   { return expertHelpCounts.get(userId) || 0; }
function getRecentSearches(userId)    { return userSearches.get(userId) || []; }
function getRecentConnections(limit = 5) { return recentConnections.slice(0, limit); }
function getTotalSuccesses()          { return [...expertHelpCounts.values()].reduce((a, b) => a + b, 0); }
function getUniqueResolvedTopics()    { return resolvedTopics.size; }

function getTopQueries(limit = 5) {
  return [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}

function getTopExperts(limit = 5) {
  return [...expertHelpCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([userId, count]) => ({ userId, count }));
}

function getAvgTimeToConnect() {
  if (!connectionDurations.length) return null;
  const avg = connectionDurations.reduce((a, b) => a + b, 0) / connectionDurations.length;
  const mins = Math.round(avg / 60000);
  return mins < 1 ? "< 1 min" : `${mins} min`;
}

function getNegativeExperts(query) {
  const base = query.toLowerCase().trim() + ":";
  return [...negativeExperts.entries()]
    .filter(([k]) => k.startsWith(base))
    .map(([k, count]) => ({ userId: k.slice(base.length), count }));
}

function getSuggestedExperts(query) {
  const base = query.toLowerCase().trim() + ":";
  return [...suggestedExperts.entries()]
    .filter(([k]) => k.startsWith(base))
    .map(([k, count]) => ({ userId: k.slice(base.length), count }));
}

module.exports = {
  hydrate,
  recordSuccess, recordSearch, recordConnect,
  recordNegativeFeedback, recordExpertSuggestion,
  getNegativeExperts, getSuggestedExperts,
  getSuccessCount, getExpertHelpCount,
  getTopQueries, getTopExperts, getRecentSearches,
  getRecentConnections, getTotalSuccesses,
  getAvgTimeToConnect, getUniqueResolvedTopics,
};
