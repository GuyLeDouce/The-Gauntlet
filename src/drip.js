// src/drip.js
// DRIP reward helper for $CHARM payouts

const axios = require("axios");

const DRIP_API_KEY = process.env.DRIP_API_KEY;
const DRIP_REALM_ID = process.env.DRIP_REALM_ID;
const DRIP_LOG_CHANNEL_ID = "1403005536982794371";

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

async function rewardCharmAmount({
  userId,
  username,
  amount,
  source,
  guildId,
  channelId,
  metadata,
}) {
  if (!DRIP_API_KEY || !DRIP_REALM_ID) {
    console.warn(
      "[GAUNTLET:DRIP] Missing DRIP_API_KEY or DRIP_REALM_ID. Skipping reward."
    );
    return { ok: false, skipped: true };
  }

  const auth = buildAuthHeader(DRIP_API_KEY);
  const base = `https://api.drip.re/api/v1/realm/${DRIP_REALM_ID}`;

  try {
    const search = await axios.get(
      `${base}/members/search?type=discord-id&values=${encodeURIComponent(
        userId
      )}`,
      {
        headers: { Authorization: auth },
        timeout: 10_000,
      }
    );

    const member = search?.data?.data?.[0];
    if (!member?.id) {
      console.warn(
        `[GAUNTLET:DRIP] No DRIP member found for Discord ID ${userId}.`
      );
      return { ok: false, skipped: true, reason: "member_not_found" };
    }

    await axios.patch(`${base}/members/${member.id}/point-balance`, {
      tokens: amount,
      source,
      guildId,
      channelId,
      awardedAt: new Date().toISOString(),
      ...(metadata || {}),
    }, {
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    });
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
      data || ""
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

async function logCharmReward(client, { userId, amount, score, source }) {
  if (!client || !DRIP_LOG_CHANNEL_ID) return false;
  try {
    const ch = await client.channels.fetch(DRIP_LOG_CHANNEL_ID);
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
