// src/drip.js
// DRIP reward helper for $CHARM payouts

const axios = require("axios");
const { Store } = require("./db");

const DRIP_API_KEY =
  process.env.DRIP_API_KEY ||
  process.env.DRIP_API_TOKEN ||
  process.env.DRIP_CLIENT_SECRET;
const DRIP_CLIENT_ID = process.env.DRIP_CLIENT_ID;
const DRIP_REALM_ID = process.env.DRIP_REALM_ID;
const DRIP_LOG_CHANNEL_ID =
  process.env.DRIP_LOG_CHANNEL_ID || "1403005536982794371";
const DRIP_BASE_URL = process.env.DRIP_BASE_URL || "https://api.drip.re";
const DRIP_DEBUG = (process.env.DRIP_DEBUG || "false").toLowerCase() === "true";
const DRIP_REALM_POINT_ID = process.env.DRIP_REALM_POINT_ID;

let envLogged = false;
function logEnvOnce() {
  if (envLogged) return;
  envLogged = true;
  const hasKey = Boolean(process.env.DRIP_API_KEY);
  const hasToken = Boolean(process.env.DRIP_API_TOKEN);
  const hasClientSecret = Boolean(process.env.DRIP_CLIENT_SECRET);
  const hasClientId = Boolean(process.env.DRIP_CLIENT_ID);
  const hasRealm = Boolean(process.env.DRIP_REALM_ID);
  const hasBase = Boolean(process.env.DRIP_BASE_URL);
  console.log(
    `[GAUNTLET:DRIP] Env check: key=${hasKey} token=${hasToken} clientSecret=${hasClientSecret} clientId=${hasClientId} realm=${hasRealm} baseUrl=${hasBase}`
  );
}

function buildRealmBaseUrl() {
  const raw = DRIP_BASE_URL || "";
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  const lower = base.toLowerCase();
  if (lower.includes("/api/v1/realm")) return base;
  if (lower.includes("/api/v1/realms")) {
    return base.replace(/\/api\/v1\/realms/i, "/api/v1/realm");
  }
  if (lower.endsWith("/realms")) return `${base.slice(0, -"/realms".length)}/realm`;
  if (lower.endsWith("/realm")) return base;
  return `${base}/api/v1/realm`;
}

function buildRealmsBaseUrl() {
  const raw = DRIP_BASE_URL || "";
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  const lower = base.toLowerCase();
  if (lower.includes("/api/v1/realms")) return base;
  if (lower.includes("/api/v1/realm")) {
    return base.replace(/\/api\/v1\/realm/i, "/api/v1/realms");
  }
  if (lower.endsWith("/realm")) return `${base.slice(0, -"/realm".length)}/realms`;
  if (lower.endsWith("/realms")) return base;
  return `${base}/api/v1/realms`;
}

function getMemberBaseUrls() {
  const realm = buildRealmBaseUrl();
  const realms = buildRealmsBaseUrl();
  return realm === realms ? [realm] : [realms, realm];
}

function getCredentialsBaseUrls() {
  const realms = buildRealmsBaseUrl();
  const realm = buildRealmBaseUrl();
  return realms === realm ? [realms] : [realms, realm];
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
  logClient,
  logReason,
}) {
  logEnvOnce();
  if (!DRIP_API_KEY || !DRIP_REALM_ID) {
    console.warn(
      "[GAUNTLET:DRIP] Missing DRIP_API_KEY or DRIP_REALM_ID. Skipping reward."
    );
    if (logClient) {
      await logCharmReward(logClient, {
        userId,
        amount,
        score: 0,
        source,
        channelId,
        reason: `${logReason || source} payout failed (missing DRIP env)`,
      });
    }
    return { ok: false, skipped: true };
  }

  const auth = buildAuthHeader(DRIP_API_KEY);
  const memberBaseUrls = getMemberBaseUrls().map(
    (base) => `${base}/${DRIP_REALM_ID}`
  );
  const credentialBaseUrls = getCredentialsBaseUrls().map(
    (base) => `${base}/${DRIP_REALM_ID}`
  );

  let baseUsed = memberBaseUrls[0];
  try {
    const credentialPatchPayload = {
      amount,
      ...(DRIP_REALM_POINT_ID ? { realmPointId: DRIP_REALM_POINT_ID } : {}),
    };
    const credentialPatchOpts = {
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      timeout: DRIP_TIMEOUT_MS,
    };

    const tryCredentialBalancePatch = async (type, value, label) => {
      const cleanType = String(type || "").trim();
      const cleanValue = String(value || "").trim();
      if (!cleanType || !cleanValue) return false;

      for (const baseUrl of credentialBaseUrls) {
        baseUsed = baseUrl;
        const patchUrl = `${baseUrl}/credentials/balance?type=${encodeURIComponent(
          cleanType
        )}&value=${encodeURIComponent(cleanValue)}`;
        try {
          if (DRIP_DEBUG) {
            console.log(
              `[GAUNTLET:DRIP] credentials/balance type=${cleanType} valueType=${typeof cleanValue} valueLen=${cleanValue.length} value=${cleanValue}`
            );
            console.log(
              `[GAUNTLET:DRIP] credentials/balance payload=${JSON.stringify(credentialPatchPayload)}`
            );
          }
          await axios.patch(patchUrl, credentialPatchPayload, credentialPatchOpts);
          console.log(
            `[GAUNTLET:DRIP] Rewarded ${amount} $CHARM to ${userId} (${source}) via credentials/balance (${label || `${cleanType}:${cleanValue}`}).`
          );
          return true;
        } catch (err) {
          const status = err?.response?.status;
          // Keep trying other bases/types when DRIP can't resolve this credential.
          if (status === 404 || status === 400) continue;
          throw err;
        }
      }
      return false;
    };

    // Preferred path: original payout route by Discord credential.
    const credentialValue =
      typeof userId === "string" ? userId : String(userId || "");
    if (!credentialValue) {
      throw new Error("missing_discord_id");
    }
    {
      const ok = await tryCredentialBalancePatch(
        "discord-id",
        credentialValue,
        "discord-id"
      );
      if (ok) return { ok: true, amount };
    }

    // If original path fails, try manual override from /adduser as direct member payout.
    let manualOverride = null;
    try {
      manualOverride = await Store.getDripUserOverride(String(userId || ""));
    } catch (err) {
      console.warn(
        "[GAUNTLET:DRIP] Override lookup failed, continuing with normal search:",
        err?.message || err
      );
    }

    if (manualOverride?.drip_user_id) {
      const overrideValue = String(manualOverride.drip_user_id).trim();
      const configuredType = String(
        manualOverride.drip_credential_type || "id"
      ).trim();

      const memberPatchPayload = {
        tokens: amount,
        ...(DRIP_REALM_POINT_ID ? { realmPointId: DRIP_REALM_POINT_ID } : {}),
      };
      const memberPatchOpts = {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        timeout: DRIP_TIMEOUT_MS,
      };

      let memberPatch404 = false;
      for (const baseUrl of memberBaseUrls) {
        baseUsed = baseUrl;
        const patchUrl = `${baseUrl}/members/${encodeURIComponent(
          overrideValue
        )}/point-balance`;
        try {
          await axios.patch(patchUrl, memberPatchPayload, memberPatchOpts);
          console.log(
            `[GAUNTLET:DRIP] Rewarded ${amount} $CHARM to ${userId} (${source}) via manual override member id ${overrideValue}.`
          );
          return { ok: true, amount };
        } catch (err) {
          const status = err?.response?.status;
          if (status === 404) {
            memberPatch404 = true;
            continue;
          }
          throw err;
        }
      }

      // Fallback for realms where override should be treated as a credential value.
      const overrideTypes = [
        configuredType,
        ...["id", "member-id", "user-id", "discord-id", "username"].filter(
          (t) => t !== configuredType
        ),
      ];

      for (const type of overrideTypes) {
        const ok = await tryCredentialBalancePatch(
          type,
          overrideValue,
          `manual-override ${type}:${overrideValue}`
        );
        if (ok) return { ok: true, amount };
      }

      console.warn(
        `[GAUNTLET:DRIP] Manual override failed for Discord ID ${userId} -> ${overrideValue} (memberPatch404=${memberPatch404}).`
      );
      if (logClient) {
        await logCharmReward(logClient, {
          userId,
          amount,
          score: 0,
          source,
          channelId,
          reason: `${logReason || source} payout failed (manual override failed)`,
        });
      }
      return { ok: false, skipped: true, reason: "manual_override_failed" };
    }

    let member = null;

    const trySearch = async (baseUrl) => {
      const searchDiscordUrl = `${baseUrl}/members/search?type=discord-id&values=${encodeURIComponent(
        userId
      )}`;
      const searchUsernameUrl = username
        ? `${baseUrl}/members/search?type=username&values=${encodeURIComponent(username)}`
        : null;

      let search = await getWithRetry(searchDiscordUrl, {
        headers: { Authorization: auth },
        timeout: DRIP_TIMEOUT_MS,
      });

      let found = search?.data?.data?.[0];
      if (!found?.id && searchUsernameUrl) {
        search = await getWithRetry(searchUsernameUrl, {
          headers: { Authorization: auth },
          timeout: DRIP_TIMEOUT_MS,
        });
        found = search?.data?.data?.[0];
      }
      return found || null;
    };

    let lastSearchErr = null;
    for (const baseUrl of memberBaseUrls) {
      try {
        member = await trySearch(baseUrl);
        baseUsed = baseUrl;
        break;
      } catch (err) {
        lastSearchErr = err;
        if (err?.response?.status !== 404) throw err;
      }
    }
    if (!member && lastSearchErr) {
      throw lastSearchErr;
    }
    if (!member?.id) {
      console.warn(
        `[GAUNTLET:DRIP] No DRIP member found for Discord ID ${userId}.`
      );
      if (logClient) {
        await logCharmReward(logClient, {
          userId,
          amount,
          score: 0,
          source,
          channelId,
          reason: `${logReason || source} payout failed (member not found)`,
        });
      }
      return { ok: false, skipped: true, reason: "member_not_found" };
    }

    const fallbackCandidates = [];
    const seen = new Set();
    const pushCandidate = (type, value) => {
      const t = String(type || "").trim();
      const v = String(value || "").trim();
      if (!t || !v) return;
      const key = `${t}:${v}`;
      if (seen.has(key)) return;
      seen.add(key);
      fallbackCandidates.push({ type: t, value: v });
    };

    pushCandidate("discord-id", credentialValue);
    pushCandidate("username", member?.username || username);
    pushCandidate("id", member?.id);
    pushCandidate("member-id", member?.id);
    pushCandidate("user-id", member?.id);

    for (const c of fallbackCandidates) {
      const ok = await tryCredentialBalancePatch(
        c.type,
        c.value,
        `fallback ${c.type}:${c.value}`
      );
      if (ok) return { ok: true, amount };
    }

    console.warn(
      `[GAUNTLET:DRIP] DRIP member found (${member.id}) but no supported credential accepted for payout.`
    );
    if (logClient) {
      await logCharmReward(logClient, {
        userId,
        amount,
        score: 0,
        source,
        channelId,
        reason: `${logReason || source} payout failed (no usable credential)`,
      });
    }
    return { ok: false, skipped: true, reason: "no_usable_credential" };
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(
      "[GAUNTLET:DRIP] Reward failed:",
      status || err.message,
      data || "",
      `url=${baseUsed}`
    );
    if (logClient) {
      await logCharmReward(logClient, {
        userId,
        amount,
        score: 0,
        source,
        channelId,
        reason: `${logReason || source} payout failed (${status || err.message})`,
      });
    }
    return { ok: false, error: err };
  }
}

async function rewardCharm({
  userId,
  username,
  score,
  source,
  guildId,
  channelId,
  logClient,
  logReason,
}) {
  const amount = getCharmRewardAmount(score);
  return rewardCharmAmount({
    userId,
    username,
    amount,
    source,
    guildId,
    channelId,
    metadata: { score },
    logClient,
    logReason,
  });
}

async function logCharmReward(
  client,
  { userId, amount, score, source, channelId, reason }
) {
  const targetChannelId = DRIP_LOG_CHANNEL_ID || channelId;
  if (!client || !targetChannelId) return false;
  try {
    const ch = await client.channels.fetch(targetChannelId);
    if (!ch || !ch.send) return false;
    const reasonText = reason || source || "Gauntlet";
    const isFailure = /failed/i.test(reasonText);
    const failureHelp = [
      "How to Connect to DRIP",
      "",
      "1. Go to https://app.drip.re/user/profile",
      "2. Open the Linked Accounts tab",
      "3. Connect your Discord",
      "4. Connect your Wallet",
      "",
      "That's it — you're linked and ready to go",
      "",
      "If it still doesn't work, open a support ticket with a screenshot and the team will help get it sorted.",
    ].join("\n");
    const message = isFailure
      ? `PAYOUT FAILED: <@${userId}> | ${amount} $CHARM | ${reasonText}\n\n${failureHelp}`
      : `<@${userId}> received **${amount} $CHARM** for ${reasonText}.`;
    await ch.send(message);
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






