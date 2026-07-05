// src/onlineRewardWebhook.js
// Signed server-to-server receiver for TheGauntletOnline $CHARM rewards.

const http = require("http");
const crypto = require("crypto");

const LOG_PREFIX = "[GAUNTLET:ONLINE-REWARD]";
const DEFAULT_PATH = "/webhooks/gauntlet-online/reward";
const MAX_BODY_BYTES = 64 * 1024;
const SECRET_FINGERPRINT_PREFIX = "gauntlet-online-reward";
const SECRET_ENV_KEYS = [
  "ONLINE_REWARD_WEBHOOK_SECRET",
  "GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET",
];

let activeServer = null;

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function warn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

function error(...args) {
  console.error(LOG_PREFIX, ...args);
}

function isExplicitlyFalse(value) {
  return String(value || "").trim().toLowerCase() === "false";
}

function getStore() {
  return require("./db").Store;
}

function getDripRewards() {
  return require("./drip");
}

function secretFingerprint(secret) {
  const value = String(secret || "").trim();
  if (!value) return "";
  return crypto
    .createHash("sha256")
    .update(`${SECRET_FINGERPRINT_PREFIX}:${value}`)
    .digest("hex")
    .slice(0, 12);
}

function configuredSecretFingerprints(secrets) {
  return secrets.map((entry) => `${entry.key}:${secretFingerprint(entry.value)}`);
}

function configuredPath() {
  const raw = String(process.env.ONLINE_REWARD_WEBHOOK_PATH || DEFAULT_PATH).trim();
  if (!raw) return DEFAULT_PATH;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function configuredPort() {
  const raw =
    process.env.ONLINE_REWARD_WEBHOOK_PORT || process.env.PORT || 3000;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid ONLINE_REWARD_WEBHOOK_PORT/PORT: ${raw}`);
  }
  return port;
}

function configuredSecrets() {
  const seen = new Set();
  return SECRET_ENV_KEYS.map((key) => ({
    key,
    value: String(process.env[key] || "").trim(),
  }))
    .filter((entry) => {
      if (!entry.value || seen.has(entry.value)) return false;
      seen.add(entry.value);
      return true;
    });
}

function getHeader(req, name) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return;
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;

    req.on("data", (chunk) => {
      if (rejected) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        req.resume();
        reject(httpError(413, "request_body_too_large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (rejected) return;
      resolve(Buffer.concat(chunks, total));
    });

    req.on("error", (err) => {
      if (rejected) return;
      rejected = true;
      reject(err);
    });
  });
}

function timestampMillis(timestamp) {
  const value = String(timestamp || "").trim();
  if (!/^\d{10,13}$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed > 10_000_000_000 ? parsed : parsed * 1000;
}

function timestampWithinSkew(timestamp, maxSkewSeconds) {
  const millis = timestampMillis(timestamp);
  if (!millis) return false;
  return Math.abs(Date.now() - millis) <= maxSkewSeconds * 1000;
}

function signatureDigest(secret, timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
}

function parseSignature(signatureHeader) {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(
    String(signatureHeader || "").trim()
  );
  if (!match) return null;
  return Buffer.from(match[1], "hex");
}

function verifySignature(secrets, timestamp, rawBody, signatureHeader) {
  const provided = parseSignature(signatureHeader);
  if (!provided) return { ok: false, reason: "invalid_signature_header" };

  for (const entry of secrets) {
    const expected = signatureDigest(entry.value, timestamp, rawBody);
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
      return { ok: true, key: entry.key };
    }
  }

  return { ok: false, reason: "signature_mismatch" };
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "payload_must_be_object" };
  }

  if (payload.type !== "ugly_interview.reward") {
    return { ok: false, reason: "invalid_type" };
  }

  const eventId = cleanString(payload.eventId);
  const payoutId = cleanString(payload.payoutId);
  if (!eventId && !payoutId) {
    return { ok: false, reason: "missing_event_or_payout_id" };
  }

  const discordUserId = cleanString(payload.player?.discordUserId);
  if (!/^\d{17,20}$/.test(discordUserId)) {
    return { ok: false, reason: "invalid_discord_user_id" };
  }

  const amount = payload.reward?.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_reward_amount" };
  }

  const currency = payload.reward?.currency;
  if (
    currency !== undefined &&
    String(currency || "").trim().toUpperCase() !== "CHARM"
  ) {
    return { ok: false, reason: "invalid_reward_currency" };
  }

  return {
    ok: true,
    value: {
      eventId: eventId || payoutId,
      payoutId: payoutId || null,
      runId: cleanString(payload.runId) || null,
      claimCode: cleanString(payload.claimCode) || null,
      discordUserId,
      discordHandle: cleanString(payload.player?.discordHandle) || null,
      walletAddress: cleanString(payload.player?.walletAddress) || null,
      amount,
      resultType: cleanString(payload.run?.resultType) || null,
      runStatus: cleanString(payload.run?.status) || null,
      squigCount: Number.isSafeInteger(payload.run?.squigCount)
        ? payload.run.squigCount
        : null,
      hasRevivePill:
        typeof payload.run?.hasRevivePill === "boolean"
          ? payload.run.hasRevivePill
          : null,
    },
  };
}

function statusIsPaid(status) {
  return status === "paid" || status === "success";
}

function responseFromStoredEvent(row) {
  const stored =
    row && row.response && typeof row.response === "object" ? row.response : {};
  if (Object.keys(stored).length) {
    return {
      ...stored,
      duplicate: true,
      eventId: row.event_id,
      amount: Number(row.amount || 0) || 0,
    };
  }

  if (statusIsPaid(row?.status)) {
    return {
      ok: true,
      paid: true,
      duplicate: true,
      eventId: row.event_id,
      amount: Number(row.amount || 0) || 0,
    };
  }

  if (row?.status === "processing") {
    return {
      ok: true,
      paid: false,
      duplicate: true,
      inProgress: true,
      eventId: row.event_id,
      amount: Number(row.amount || 0) || 0,
    };
  }

  return {
    ok: false,
    paid: false,
    duplicate: true,
    failed: true,
    eventId: row?.event_id || null,
    amount: Number(row?.amount || 0) || 0,
    reason: row?.error_message || "stored_reward_failed",
  };
}

function duplicateStatusCode(row) {
  if (row?.status === "processing") return 202;
  return 200;
}

function rewardFailureReason(reward) {
  if (reward?.reason) return String(reward.reason).slice(0, 1000);
  if (reward?.error?.response?.status) {
    return `drip_http_${reward.error.response.status}`;
  }
  if (reward?.error?.message) return String(reward.error.message).slice(0, 1000);
  if (reward?.skipped) return "reward_skipped";
  return "reward_failed";
}

async function processReward(client, rewardEvent) {
  const { rewardCharmAmount, logCharmReward } = getDripRewards();
  const Store = getStore();
  const channelId =
    process.env.ONLINE_REWARD_WEBHOOK_LOG_CHANNEL_ID ||
    process.env.DRIP_LOG_CHANNEL_ID ||
    null;
  const reason = `Ugly Interview ${
    rewardEvent.claimCode || rewardEvent.payoutId || rewardEvent.eventId
  }`;

  const reward = await rewardCharmAmount({
    userId: rewardEvent.discordUserId,
    username:
      rewardEvent.discordHandle || `User-${rewardEvent.discordUserId}`,
    amount: rewardEvent.amount,
    source: "gauntlet-online",
    guildId: process.env.ONLINE_REWARD_WEBHOOK_GUILD_ID || null,
    channelId,
    metadata: {
      mode: "gauntlet-online",
      eventId: rewardEvent.eventId,
      payoutId: rewardEvent.payoutId,
      runId: rewardEvent.runId,
      claimCode: rewardEvent.claimCode,
      walletAddress: rewardEvent.walletAddress,
      resultType: rewardEvent.resultType,
      status: rewardEvent.runStatus,
      squigCount: rewardEvent.squigCount,
      hasRevivePill: rewardEvent.hasRevivePill,
    },
    logClient: client,
    logReason: reason,
  });

  if (!reward?.ok) {
    const failureResponse = {
      ok: false,
      paid: false,
      duplicate: false,
      eventId: rewardEvent.eventId,
      reason: rewardFailureReason(reward),
    };
    await Store.markOnlineRewardEventFailed(
      rewardEvent.eventId,
      failureResponse.reason,
      failureResponse
    );
    return { statusCode: 502, body: failureResponse };
  }

  const successResponse = {
    ok: true,
    paid: true,
    duplicate: false,
    eventId: rewardEvent.eventId,
    amount: rewardEvent.amount,
  };

  await Store.markOnlineRewardEventPaid(rewardEvent.eventId, successResponse);
  await logCharmReward(client, {
    userId: rewardEvent.discordUserId,
    amount: rewardEvent.amount,
    score: 0,
    source: "gauntlet-online",
    channelId,
    reason,
  });

  return { statusCode: 200, body: successResponse };
}

async function handleRewardRequest(req, res, client, config) {
  const timestamp = getHeader(req, "x-gauntlet-timestamp");
  const signature = getHeader(req, "x-gauntlet-signature");
  const idempotencyKey = getHeader(req, "x-gauntlet-idempotency-key");
  const senderSecretFingerprint =
    getHeader(req, "x-gauntlet-secret-fingerprint") || "missing";

  if (!timestamp || !signature) {
    sendJson(res, 401, { ok: false, paid: false, reason: "missing_signature" });
    return;
  }

  const rawBody = await readRawBody(req);

  if (!timestampWithinSkew(timestamp, config.maxSkewSeconds)) {
    sendJson(res, 401, { ok: false, paid: false, reason: "invalid_timestamp" });
    return;
  }

  const signatureResult = verifySignature(config.secrets, timestamp, rawBody, signature);
  if (!signatureResult.ok) {
    warn(
      `Invalid reward webhook signature reason=${signatureResult.reason} bodyBytes=${rawBody.length} senderSecretFingerprint=${senderSecretFingerprint} serverSecretFingerprints=${configuredSecretFingerprints(config.secrets).join(",")}`
    );
    sendJson(res, 401, { ok: false, paid: false, reason: "invalid_signature" });
    return;
  }

  if (!idempotencyKey) {
    sendJson(res, 400, {
      ok: false,
      paid: false,
      reason: "missing_idempotency_key",
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    sendJson(res, 400, { ok: false, paid: false, reason: "invalid_json" });
    return;
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    sendJson(res, 400, {
      ok: false,
      paid: false,
      reason: validation.reason,
    });
    return;
  }

  const rewardEvent = validation.value;
  if (
    idempotencyKey !== rewardEvent.eventId &&
    idempotencyKey !== rewardEvent.payoutId
  ) {
    sendJson(res, 400, {
      ok: false,
      paid: false,
      reason: "invalid_idempotency_key",
    });
    return;
  }

  const Store = getStore();
  const reservation = await Store.reserveOnlineRewardEvent({
    eventId: rewardEvent.eventId,
    payoutId: rewardEvent.payoutId,
    runId: rewardEvent.runId,
    discordUserId: rewardEvent.discordUserId,
    amount: rewardEvent.amount,
    claimCode: rewardEvent.claimCode,
  });

  if (!reservation.reserved) {
    const storedResponse = responseFromStoredEvent(reservation.event);
    log(
      `Duplicate event ${reservation.event?.event_id || rewardEvent.eventId} status=${reservation.event?.status || "unknown"}`
    );
    sendJson(res, duplicateStatusCode(reservation.event), storedResponse);
    return;
  }

  log(
    `Processing event ${rewardEvent.eventId} user=${rewardEvent.discordUserId} amount=${rewardEvent.amount}`
  );
  const result = await processReward(client, rewardEvent);
  sendJson(res, result.statusCode, result.body);
}

async function handleRequest(req, res, client, config) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "the-gauntlet",
      rewardWebhook: {
        enabled: true,
        path: config.path,
        method: "POST",
        secretConfigured: config.secrets.length > 0,
        secretSources: config.secrets.map((entry) => entry.key),
      },
    });
    return;
  }

  if (requestUrl.pathname !== config.path) {
    sendJson(res, 404, { ok: false, reason: "not_found" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    sendJson(res, 200, {
      ok: true,
      service: "the-gauntlet",
      webhook: "gauntlet-online-reward",
      path: config.path,
      method: "POST",
      secretConfigured: config.secrets.length > 0,
    });
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "POST",
    });
    res.end(JSON.stringify({ ok: false, reason: "method_not_allowed" }));
    return;
  }

  try {
    await handleRewardRequest(req, res, client, config);
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    const reason = statusCode === 500 ? "internal_error" : err.message;
    if (statusCode >= 500) {
      error("Request failed:", err?.message || err);
      if (err?.stack) error(err.stack);
    }
    sendJson(res, statusCode, { ok: false, paid: false, reason });
  }
}

async function startOnlineRewardWebhook(client) {
  if (activeServer) return activeServer;

  if (isExplicitlyFalse(process.env.ONLINE_REWARD_WEBHOOK_ENABLED)) {
    log("Webhook server disabled by ONLINE_REWARD_WEBHOOK_ENABLED=false.");
    return null;
  }

  const secrets = configuredSecrets();
  if (!secrets.length) {
    warn(
      "ONLINE_REWARD_WEBHOOK_SECRET is not set; webhook server will not start. GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET is accepted as a compatibility alias."
    );
    return null;
  }

  const config = {
    secrets,
    path: configuredPath(),
    port: configuredPort(),
    maxSkewSeconds: Math.max(
      1,
      Number(process.env.ONLINE_REWARD_WEBHOOK_MAX_SKEW_SECONDS) || 300
    ),
  };

  activeServer = http.createServer((req, res) => {
    handleRequest(req, res, client, config).catch((err) => {
      error("Unhandled request failure:", err?.message || err);
      sendJson(res, 500, { ok: false, paid: false, reason: "internal_error" });
    });
  });

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      activeServer = null;
      reject(err);
    };
    activeServer.once("error", onError);
    activeServer.listen(config.port, "0.0.0.0", () => {
      activeServer.off("error", onError);
      log(
        `Webhook server listening on 0.0.0.0:${config.port} path=${config.path} secretFingerprints=${configuredSecretFingerprints(config.secrets).join(",")}`
      );
      resolve();
    });
  });

  return activeServer;
}

module.exports = {
  startOnlineRewardWebhook,
  configuredSecrets,
  secretFingerprint,
  signatureDigest,
  verifySignature,
};
