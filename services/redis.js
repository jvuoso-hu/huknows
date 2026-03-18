const { createClient } = require("redis");

let client = null;

async function getClient() {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (e) => console.error("[redis] error:", e.message));
  await client.connect();
  console.log("[redis] Connected");
  return client;
}

async function get(key) {
  try {
    const c = await getClient();
    if (!c) return null;
    const val = await c.get(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("[redis] get error:", e.message);
    return null;
  }
}

async function set(key, value) {
  try {
    const c = await getClient();
    if (!c) return;
    await c.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("[redis] set error:", e.message);
  }
}

module.exports = { getClient, get, set };
