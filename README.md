# The Gauntlet

Discord bot for The Gauntlet.

## Gauntlet Online reward webhook

The bot can receive signed server-to-server reward events from TheGauntletOnline and pay `$CHARM` through the existing DRIP reward flow.

Required/relevant environment variables:

```env
ONLINE_REWARD_WEBHOOK_ENABLED=true
ONLINE_REWARD_WEBHOOK_SECRET=<same shared secret as Online>
ONLINE_REWARD_WEBHOOK_PATH=/webhooks/gauntlet-online/reward
ONLINE_REWARD_WEBHOOK_PORT=<optional; defaults to PORT>
ONLINE_REWARD_WEBHOOK_GUILD_ID=<optional>
ONLINE_REWARD_WEBHOOK_LOG_CHANNEL_ID=<optional>
ONLINE_REWARD_WEBHOOK_MAX_SKEW_SECONDS=300
```

The endpoint is `POST /webhooks/gauntlet-online/reward` by default. Online must sign the raw JSON body with HMAC-SHA256 using `x-gauntlet-timestamp` and `x-gauntlet-signature: sha256=<hex>`, and send `x-gauntlet-idempotency-key`.

Online should use the bot deployment's public HTTP URL:

```env
GAUNTLET_DISCORD_REWARD_WEBHOOK_URL=https://<bot-public-domain>/webhooks/gauntlet-online/reward
GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET=<same value as ONLINE_REWARD_WEBHOOK_SECRET>
```

`GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET` is also accepted by this bot as a compatibility alias, but `ONLINE_REWARD_WEBHOOK_SECRET` is the preferred bot-side name.

Troubleshooting:

- `HTTP 404` with `Application not found` is a hosting/domain problem. The Online app is not reaching this bot route. Check the bot's public deployment domain, public networking, and that the path is `/webhooks/gauntlet-online/reward`.
- `HTTP 401` with `invalid_signature` means the route was reached but the shared secrets or signed body disagree. Set Online `GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET` to exactly the same value as bot `ONLINE_REWARD_WEBHOOK_SECRET`, then redeploy/restart both services.
- Do not set `ONLINE_REWARD_WEBHOOK_PORT` to the literal string `$PORT`. Leave it unset unless the host requires an explicit numeric override.
