// In-memory feedback store. Resets on redeploy — intentional for hackathon.
const counts = new Map();

function recordSuccess(query) {
  const key = query.toLowerCase().trim();
  counts.set(key, (counts.get(key) || 0) + 1);
}

function getSuccessCount(query) {
  return counts.get(query.toLowerCase().trim()) || 0;
}

module.exports = { recordSuccess, getSuccessCount };
