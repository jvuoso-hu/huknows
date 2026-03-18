// In-memory store. Resets on redeploy — intentional for hackathon.
const queryCounts = new Map();       // query -> count
const expertHelpCounts = new Map();  // expertUserId -> count
const userSearches = new Map();      // userId -> [{ query, ts }]
const negativeExperts = new Map();   // `${query}:${userId}` -> count
const suggestedExperts = new Map();  // `${query}:${userId}` -> count
const recentConnections = [];        // [{ query, expertUserId, expertName, ts }]

const MAX_RECENT = 5;
const MAX_CONNECTIONS = 10;

function recordSuccess(query, expertUserId, expertName = null) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
  if (expertUserId) {
    expertHelpCounts.set(expertUserId, (expertHelpCounts.get(expertUserId) || 0) + 1);
    recentConnections.unshift({ query, expertUserId, expertName, ts: Date.now() });
    if (recentConnections.length > MAX_CONNECTIONS) recentConnections.pop();
  }
}

function recordSearch(userId, query) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
  const list = userSearches.get(userId) || [];
  list.unshift({ query, ts: Date.now() });
  userSearches.set(userId, list.slice(0, MAX_RECENT));
}

function getSuccessCount(query) {
  return queryCounts.get(query.toLowerCase().trim()) || 0;
}

function getExpertHelpCount(expertUserId) {
  return expertHelpCounts.get(expertUserId) || 0;
}

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

function getRecentSearches(userId) {
  return userSearches.get(userId) || [];
}

function getRecentConnections(limit = 5) {
  return recentConnections.slice(0, limit);
}

function getTotalSuccesses() {
  return [...expertHelpCounts.values()].reduce((a, b) => a + b, 0);
}

function recordNegativeFeedback(query, expertIds) {
  const base = query.toLowerCase().trim();
  for (const userId of expertIds) {
    const k = `${base}:${userId}`;
    negativeExperts.set(k, (negativeExperts.get(k) || 0) + 1);
  }
}

function recordExpertSuggestion(query, suggestedUserId) {
  const k = `${query.toLowerCase().trim()}:${suggestedUserId}`;
  suggestedExperts.set(k, (suggestedExperts.get(k) || 0) + 1);
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
  recordSuccess, recordSearch,
  recordNegativeFeedback, recordExpertSuggestion,
  getNegativeExperts, getSuggestedExperts,
  getSuccessCount, getExpertHelpCount,
  getTopQueries, getTopExperts, getRecentSearches,
  getRecentConnections, getTotalSuccesses,
};
