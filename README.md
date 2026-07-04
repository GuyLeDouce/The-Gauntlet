# The Gauntlet

Discord bot for The Gauntlet.

## Gauntlet Online reward webhook

The bot can receive signed server-to-server reward events from TheGauntletOnline and pay `$CHARM` through the existing DRIP reward flow.

Required/relevant environment variables:

```env
ONLINE_REWARD_WEBHOOK_ENABLED=true
ONLINE_REWARD_WEBHOOK_SECRET=<same shared secret as Online>
ONLINE_REWARD_WEBHOOK_PATH=/webhooks/gauntlet-online/reward
ONLINE_REWARD_WEBHOOK_PORT=$PORT
ONLINE_REWARD_WEBHOOK_GUILD_ID=<optional>
ONLINE_REWARD_WEBHOOK_LOG_CHANNEL_ID=<optional>
ONLINE_REWARD_WEBHOOK_MAX_SKEW_SECONDS=300
```

The endpoint is `POST /webhooks/gauntlet-online/reward` by default. Online must sign the raw JSON body with HMAC-SHA256 using `x-gauntlet-timestamp` and `x-gauntlet-signature: sha256=<hex>`, and send `x-gauntlet-idempotency-key`.
