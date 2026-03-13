// In-memory store. Resets on redeploy — intentional for hackathon.
const queryCounts = new Map();       // query -> count
const expertHelpCounts = new Map();  // expertUserId -> count
const userSearches = new Map();      // userId -> [{ query, ts }]

const MAX_RECENT = 5;

function recordSuccess(query, expertUserId) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
  if (expertUserId) {
    expertHelpCounts.set(expertUserId, (expertHelpCounts.get(expertUserId) || 0) + 1);
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

module.exports = {
  recordSuccess, recordSearch,
  getSuccessCount, getExpertHelpCount,
  getTopQueries, getTopExperts, getRecentSearches,
};
