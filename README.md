# The Gauntlet

Discord bot for The Gauntlet.

## Survival Pass

The public Survival lobby includes a **Survival Pass** button. Checkout and status
are private Discord replies; no new slash command is required. A confirmed purchase
transfers **2,500 $CHARM** from the buyer to the **same resolved account used for
ordinary Gauntlet payouts**, then activates exactly **seven days**. There is no
stacking, extension, automatic renewal, extra entry, or gameplay advantage.

Pass holders join normal public lobbies (including replays) automatically. Purchasing
during an open lobby also enrolls the buyer. A pass qualifies if its validity overlaps
the lobby's open time; expiry never removes an earned entry. **Leave** skips only
that lobby and survives restarts. **Join** opts back in without creating a duplicate.
Automatic entrants must still be server members with access to the lobby channel.
Admin simulations do not enroll pass holders. Pass entrants count toward the usual
prize pool and player-count start threshold.

### Existing configuration and storage

No separate receiving-account variable is introduced. Both flows use the existing
sender resolution: `DRIP_SENDER_ID`, then `DRIP_TRANSFER_SENDER_ID`, then
`DRIP_TIPPER_ID`, then the existing fallback sender. Pass payments require the
existing API key, `DRIP_REALM_ID`, and an explicit `DRIP_REALM_POINT_ID` for $CHARM.
They use the documented modern `/api/v1/realms/{realmId}/members/{dripId}/transfer`
endpoint with a positive amount. There is no fallback to negative payouts,
alternate write routes, or username-based charging.

Startup adds two tables in the existing main database:
`gauntlet_survival_passes` and `gauntlet_survival_pass_purchases`, plus
`skipped_ids` on `gauntlet_survival_lobby`. These paid-entitlement tables are
intentionally excluded from `GAUNTLET_RESET`. Discord-to-DRIP overrides are read
from the existing DRIP mapping database; otherwise an exact Discord-ID search is used.
Unsupported override types fail closed and need an administrator to correct them.

### Payment recovery

The database reserves the purchase before any transfer, serializes purchases for
the same account, and stores the intended sender, recipient, currency and amount
before submitting. Confirm buttons are buyer-bound and expire after 15 minutes.
Repeated clicks, concurrent panels and restarts cannot retransmit that purchase.

DRIP's documented transfer endpoint does not specify an idempotency key. A timeout,
5xx, ambiguous response, or post-transfer database failure leaves the purchase
pending review and blocks new purchases. Do not infer payment from a balance
difference alone. Inspect the DRIP transaction evidence and the stored payment
details; application logs retain a confirmed response if settlement persistence fails.
Never retry a transfer just because its response was lost.

An operator with database access can list unresolved purchases:

```bash
node scripts/survival-pass-review.js list
```

After verifying the outcome in DRIP, resolve a purchase at least five minutes old:

```bash
node scripts/survival-pass-review.js resolve --id PURCHASE_ID --by ADMIN_DISCORD_ID --note "DRIP evidence reference and confirmed outcome" --confirm-transferred
node scripts/survival-pass-review.js resolve --id PURCHASE_ID --by ADMIN_DISCORD_ID --note "DRIP evidence confirms no transfer occurred" --confirm-not-transferred
```

Use exactly one outcome, not both commands. The script never calls DRIP or moves
funds. Confirmed transfers activate a full seven days from recovery; confirmed
non-transfers release the purchase lock. The operator and evidence note are saved.
It refuses to run with `GAUNTLET_RESET=true`.

### Validation before launch

Run `npm install` (including dev dependencies) and `npm run check`. Pass tests use
PGlite to execute the actual PostgreSQL schema and purchase queries, plus mocked
DRIP responses and Discord interactions. They never access production credentials.
Before live sales, verify the configured currency/account and API transfer permissions
with an authorized test account, including insufficient-balance rejection. The public
API documentation and local tests do not verify the live key's permissions.

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


### Resetting a confirmed paid test

HTTP 200 transfers activate even if DRIP omits optional receipt fields or wraps
its receipt in `data`. Explicit conflicting IDs, error responses, timeouts and
HTTP 202 remain unresolved; transfers are never automatically retried.

To expire only a confirmed paid test and release its pending lock, use:

```bash
node scripts/survival-pass-review.js reset-test --id PURCHASE_ID --by ADMIN_DISCORD_ID --note "Buyer confirmed payment; requested reset for another test" --confirm-transferred
```

This requires database access and a purchase at least five minutes old. It retains
the payment ledger and audit note, never transfers or refunds funds, and does not
remove an existing lobby entry. Opening a new checkout afterward charges another
2,500 CHARM. Repeating the reset cannot clear a newer purchase or entitlement.
