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

After deployment, a safe route probe should work:

```bash
curl https://<bot-public-domain>/webhooks/gauntlet-online/reward
```

Expected response:

```json
{"ok":true,"service":"the-gauntlet","webhook":"gauntlet-online-reward","path":"/webhooks/gauntlet-online/reward","method":"POST","secretConfigured":true}
```

Online should use the bot deployment's public HTTP URL:

```env
GAUNTLET_DISCORD_REWARD_WEBHOOK_URL=https://<bot-public-domain>/webhooks/gauntlet-online/reward
GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET=<same value as ONLINE_REWARD_WEBHOOK_SECRET>
```

`GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET` is also accepted by this bot as a compatibility alias, but `ONLINE_REWARD_WEBHOOK_SECRET` is the preferred bot-side name.

Troubleshooting:

- `HTTP 404` with `Application not found` is a hosting/domain problem. The Online app is not reaching this bot route. Check the bot's public deployment domain, public networking, and that the path is `/webhooks/gauntlet-online/reward`.
- `HTTP 401` with `invalid_signature` means the route was reached but the shared secrets or signed body disagree. The bot logs `senderSecretFingerprint` and `serverSecretFingerprints`; they must match. Set Online `GAUNTLET_DISCORD_REWARD_WEBHOOK_SECRET` to exactly the same value as bot `ONLINE_REWARD_WEBHOOK_SECRET`, then redeploy/restart both services.
- Do not set `ONLINE_REWARD_WEBHOOK_PORT` to the literal string `$PORT`. Leave it unset unless the host requires an explicit numeric override.


## Survival admin control center

`/survive` opens an ephemeral admin-only panel with **Start Lobby**, **Start Game**,
and **Settings**. Opening the panel has no public effect. Existing configured admin
IDs and Discord Administrator/Manage Server permissions grant access.

**Settings** displays the current values for type, era, ping roles, pool per player,
time, Creator Chaos, revives, bonus, required players, multiplier, prize, and replay.
Edit the controls and press **Save Defaults** to persist the configuration in the
existing `gauntlet_survival_settings` table. Custom prizes support text/links;
leave the custom prize field blank to clear it. No new migration or environment
variable is required.

**Start Lobby** reads saved defaults from the database and stores a separate snapshot
with the lobby. Later default edits affect future admin-created lobbies; the active
lobby/game and its existing replay behavior retain their original configuration.
**Start Game** starts the open lobby through the existing game flow. Timed and
player-count automatic starts continue to work. `/survivestart` remains available
to admins for compatibility. Public lobby controls, announcements, rewards, and
Survival gameplay are unchanged.

The bot's normal command registration updates `/survive` on restart, removing the
old per-invocation settings options. `npm run check` includes mocked interaction
checks for authorization, persistence, snapshot isolation, duplicate lobby creation,
manual start, timed scheduling, and database failures. A live Discord smoke check
should verify the ephemeral panel and role picker after deployment.
