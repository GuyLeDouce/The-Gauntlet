const assert = require("assert");
const crypto = require("crypto");

const {
  configuredSecrets,
  secretFingerprint,
  verifySignature,
} = require("../src/onlineRewardWebhook");

const SECRET_KEYS = [
  "ONLINE_REWARD_WEBHOOK_SECRET",
  "GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET",
];

function withCleanSecretEnv(callback) {
  const original = Object.fromEntries(
    SECRET_KEYS.map((key) => [key, process.env[key]])
  );

  for (const key of SECRET_KEYS) delete process.env[key];

  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function signLikeOnline(body, secret, timestamp) {
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

withCleanSecretEnv(() => {
  process.env.ONLINE_REWARD_WEBHOOK_SECRET = "main-secret";
  const secrets = configuredSecrets();
  assert.strictEqual(secrets.length, 1);
  assert.strictEqual(secrets[0].key, "ONLINE_REWARD_WEBHOOK_SECRET");
  assert.strictEqual(secrets[0].value, "main-secret");
});

withCleanSecretEnv(() => {
  process.env.GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET = "alias-secret";
  const secrets = configuredSecrets();
  assert.strictEqual(secrets.length, 1);
  assert.strictEqual(secrets[0].key, "GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET");
  assert.strictEqual(secrets[0].value, "alias-secret");
});

withCleanSecretEnv(() => {
  process.env.ONLINE_REWARD_WEBHOOK_SECRET = "shared-secret";
  process.env.GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET = "shared-secret";
  assert.strictEqual(configuredSecrets().length, 1);
});

const body = JSON.stringify({
  type: "ugly_interview.reward",
  eventId: "payout-123",
  payoutId: "payout-123",
  player: { discordUserId: "123456789012345678" },
  reward: { amount: 25, currency: "CHARM" },
});
const timestamp = "1814688000";
const signature = signLikeOnline(body, "shared-secret", timestamp);

assert.strictEqual(secretFingerprint("shared-secret").length, 12);
assert.strictEqual(secretFingerprint(" shared-secret "), secretFingerprint("shared-secret"));
assert.strictEqual(secretFingerprint("different-secret").length, 12);
assert.notStrictEqual(
  secretFingerprint("different-secret"),
  secretFingerprint("shared-secret")
);

const valid = verifySignature(
  [{ key: "ONLINE_REWARD_WEBHOOK_SECRET", value: "shared-secret" }],
  timestamp,
  Buffer.from(body, "utf8"),
  signature
);
assert.strictEqual(valid.ok, true);

const invalid = verifySignature(
  [{ key: "ONLINE_REWARD_WEBHOOK_SECRET", value: "wrong-secret" }],
  timestamp,
  Buffer.from(body, "utf8"),
  signature
);
assert.strictEqual(invalid.ok, false);

console.log("Online reward webhook signature check passed.");
