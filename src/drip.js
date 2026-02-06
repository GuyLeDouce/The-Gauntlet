// src/drip.js
// DRIP reward helper for $CHARM payouts

const axios = require("axios");

const DRIP_API_KEY =
  process.env.DRIP_API_KEY || process.env.DRIP_API_TOKEN;
const DRIP_REALM_ID = process.env.DRIP_REALM_ID;
const DRIP_LOG_CHANNEL_ID =
  process.env.DRIP_LOG_CHANNEL_ID || "1403005536982794371";
const DRIP_BASE_URL = process.env.DRIP_BASE_URL || "https://api.drip.re";
const DRIP_REALM_PATH = process.env.DRIP_REALM_PATH || "realm";

let envLogged = false;
function logEnvOnce() {
  if (envLogged) return;
  envLogged = true;
  const hasKey = Boolean(process.env.DRIP_API_KEY);
  const hasToken = Boolean(process.env.DRIP_API_TOKEN);
  const hasRealm = Boolean(process.env.DRIP_REALM_ID);
  const hasBase = Boolean(process.env.DRIP_BASE_URL);
  const realmPath = DRIP_REALM_PATH;
  console.log(
    `[GAUNTLET:DRIP] Env check: key=${hasKey} token=${hasToken} realm=${hasRealm} baseUrl=${hasBase} realmPath=${realmPath}`
  );
}

function buildRealmBaseUrl() {
  const raw = DRIP_BASE_URL || "";
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  const lower = base.toLowerCase();
  if (lower.includes("/realm") || lower.includes("/realms")) return base;
  if (lower.includes("/api/v1")) return `${base}/${DRIP_REALM_PATH}`;
  return `${base}/api/v1/${DRIP_REALM_PATH}`;
}

function getCharmRewardAmount(score) {
  if (score > 20) return 500;
  if (score > 10) return 100;
  return 50;
}

function buildAuthHeader(apiKey) {
  if (!apiKey) return undefined;
  if (apiKey.toLowerCase().startsWith("bearer ")) return apiKey;
  return `Bearer ${apiKey}`;
}

const DRIP_TIMEOUT_MS = Number(process.env.DRIP_TIMEOUT_MS) || 30_000;
const DRIP_RETRY_COUNT = Number(process.env.DRIP_RETRY_COUNT) || 2;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWithRetry(url, opts) {
  let lastErr;
  for (let attempt = 0; attempt <= DRIP_RETRY_COUNT; attempt += 1) {
    try {
      return await axios.get(url, opts);
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const isRetryable =
        !status || status >= 500 || err?.code === "ECONNABORTED";
      if (!isRetryable || attempt === DRIP_RETRY_COUNT) break;
      const backoff = 500 * Math.pow(2, attempt);
      await wait(backoff);
    }
  }
  throw lastErr;
}

async function rewardCharmAmount({
  userId,
  username,
  amount,
  source,
  guildId,
  channelId,
  metadata,
}) {
  logEnvOnce();
  if (!DRIP_API_KEY || !DRIP_REALM_ID) {
    console.warn(
      "[GAUNTLET:DRIP] Missing DRIP_API_KEY or DRIP_REALM_ID. Skipping reward."
    );
    return { ok: false, skipped: true };
  }

  const auth = buildAuthHeader(DRIP_API_KEY);
  const base = `${buildRealmBaseUrl()}/${DRIP_REALM_ID}`;
  const searchUrl = `${base}/members/search?type=discord-id&values=${encodeURIComponent(
    userId
  )}`;

  try {
    const search = await getWithRetry(searchUrl, {
      headers: { Authorization: auth },
      timeout: DRIP_TIMEOUT_MS,
    });

    const member = search?.data?.data?.[0];
    if (!member?.id) {
      console.warn(
        `[GAUNTLET:DRIP] No DRIP member found for Discord ID ${userId}.`
      );
      return { ok: false, skipped: true, reason: "member_not_found" };
    }

    await axios.patch(
      `${base}/members/${member.id}/point-balance`,
      {
        tokens: amount,
        source,
        guildId,
        channelId,
        awardedAt: new Date().toISOString(),
        ...(metadata || {}),
      },
      {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        timeout: DRIP_TIMEOUT_MS,
      }
    );
    console.log(
      `[GAUNTLET:DRIP] Rewarded ${amount} $CHARM to ${userId} (${source}).`
    );
    return { ok: true, amount };
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(
      "[GAUNTLET:DRIP] Reward failed:",
      status || err.message,
      data || "",
      `url=${searchUrl}`
    );
    return { ok: false, error: err };
  }
}

async function rewardCharm({ userId, username, score, source, guildId, channelId }) {
  const amount = getCharmRewardAmount(score);
  return rewardCharmAmount({
    userId,
    username,
    amount,
    source,
    guildId,
    channelId,
    metadata: { score },
  });
}

async function logCharmReward(client, { userId, amount, score, source, channelId }) {
  const targetChannelId = channelId || DRIP_LOG_CHANNEL_ID;
  if (!client || !targetChannelId) return false;
  try {
    const ch = await client.channels.fetch(targetChannelId);
    if (!ch || !ch.send) return false;
    await ch.send(
      `<@${userId}> received **${amount} $CHARM** for Gauntlet (${source}, score: ${score}).`
    );
    return true;
  } catch (err) {
    console.error("[GAUNTLET:DRIP] Reward log failed:", err?.message || err);
    return false;
  }
}

module.exports = {
  getCharmRewardAmount,
  rewardCharmAmount,
  rewardCharm,
  DRIP_LOG_CHANNEL_ID,
  logCharmReward,
};
