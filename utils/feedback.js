// In-memory feedback store. Resets on redeploy — intentional for hackathon.
const queryCounts = new Map();          // query -> count
const expertHelpCounts = new Map();     // expertUserId -> count

function recordSuccess(query, expertUserId) {
  const key = query.toLowerCase().trim();
  queryCounts.set(key, (queryCounts.get(key) || 0) + 1);

  if (expertUserId) {
    expertHelpCounts.set(expertUserId, (expertHelpCounts.get(expertUserId) || 0) + 1);
  }
}

function getSuccessCount(query) {
  return queryCounts.get(query.toLowerCase().trim()) || 0;
}

function getExpertHelpCount(expertUserId) {
  return expertHelpCounts.get(expertUserId) || 0;
}

module.exports = { recordSuccess, getSuccessCount, getExpertHelpCount };
