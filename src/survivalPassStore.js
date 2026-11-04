"use strict";

const PASS_PRICE = 2500;
const PASS_DAYS = 7;

async function initSurvivalPassSchema(pool) {
  // Paid entitlements intentionally survive GAUNTLET_RESET.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gauntlet_survival_passes (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      activated_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      purchase_id TEXT,
      pending_purchase_id TEXT,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS gauntlet_survival_pass_purchases (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount = 2500),
      status TEXT NOT NULL CHECK (status IN ('reserved','submitted','unknown','succeeded','failed')),
      payment JSONB NOT NULL DEFAULT '{}',
      receipt JSONB NOT NULL DEFAULT '{}',
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      activated_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      reviewed_by TEXT,
      review_note TEXT
    );
    CREATE INDEX IF NOT EXISTS gauntlet_survival_passes_expiry_idx
      ON gauntlet_survival_passes (guild_id, expires_at);
    ALTER TABLE gauntlet_survival_lobby
      ADD COLUMN IF NOT EXISTS skipped_ids JSONB NOT NULL DEFAULT '[]';
  `);
}

class SurvivalPassStore {
  constructor(getPool) { this.getPool = getPool; }
  get pool() {
    const pool = this.getPool();
    if (!pool) throw new Error("Pass database unavailable");
    return pool;
  }
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async status(guildId, userId) {
    const r = await this.pool.query(`
      SELECT *, expires_at > now() AS active FROM gauntlet_survival_passes
      WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
    return r.rows[0] || null;
  }
  async entrants(guildId, openedAt) {
    // Overlap, not "active now": an earned lobby entry survives pass expiry/restart.
    const r = await this.pool.query(`
      SELECT user_id FROM gauntlet_survival_passes
      WHERE guild_id = $1 AND activated_at <= now() AND expires_at > $2`,
    [guildId, openedAt]);
    return r.rows.map(row => row.user_id);
  }
  async reserve(id, guildId, userId) {
    return this.transaction(async client => {
      await client.query(`INSERT INTO gauntlet_survival_passes (guild_id,user_id)
        VALUES ($1,$2) ON CONFLICT DO NOTHING`, [guildId,userId]);
      const account = (await client.query(`SELECT *, expires_at > now() AS active
        FROM gauntlet_survival_passes WHERE guild_id=$1 AND user_id=$2 FOR UPDATE`,
      [guildId,userId])).rows[0];
      const old = (await client.query(`SELECT * FROM gauntlet_survival_pass_purchases
        WHERE id=$1`, [id])).rows[0];
      if (old) return { kind: "duplicate", purchase: old };
      if (account.active) return { kind: "active", pass: account };
      if (account.pending_purchase_id) return { kind: "pending", id: account.pending_purchase_id };
      await client.query(`INSERT INTO gauntlet_survival_pass_purchases
        (id,guild_id,user_id,amount,status) VALUES ($1,$2,$3,$4,'reserved')`,
      [id,guildId,userId,PASS_PRICE]);
      await client.query(`UPDATE gauntlet_survival_passes SET pending_purchase_id=$3
        WHERE guild_id=$1 AND user_id=$2`, [guildId,userId,id]);
      return { kind: "reserved", id };
    });
  }
  async submitted(id, payment) {
    const r = await this.pool.query(`UPDATE gauntlet_survival_pass_purchases
      SET status='submitted', payment=$2 WHERE id=$1 AND status='reserved' RETURNING id`,
    [id,JSON.stringify(payment)]);
    if (r.rowCount !== 1) throw new Error("Purchase is not reserved");
  }
  async finish(id, status, receipt = {}, errorCode = null, review = null) {
    if (!["succeeded","failed","unknown"].includes(status)) throw new Error("Invalid purchase outcome");
    return this.transaction(async client => {
      const identity = (await client.query(`SELECT guild_id,user_id
        FROM gauntlet_survival_pass_purchases WHERE id=$1`, [id])).rows[0];
      if (!identity) throw new Error("Purchase not found");
      // Same lock order as reserve; serializes settlement, review and new purchases.
      const pass = (await client.query(`SELECT * FROM gauntlet_survival_passes
        WHERE guild_id=$1 AND user_id=$2 FOR UPDATE`,
      [identity.guild_id,identity.user_id])).rows[0];
      const purchase = (await client.query(`SELECT * FROM gauntlet_survival_pass_purchases
        WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (["succeeded","failed"].includes(purchase.status)) return purchase;
      if (pass.pending_purchase_id !== id) throw new Error("Purchase ownership mismatch");
      const result = (await client.query(`UPDATE gauntlet_survival_pass_purchases
        SET status=$2, receipt=$3, error_code=$4,
          activated_at=CASE WHEN $2='succeeded' THEN now() ELSE NULL END,
          expires_at=CASE WHEN $2='succeeded' THEN now()+interval '7 days' ELSE NULL END,
          reviewed_by=$5, review_note=$6
        WHERE id=$1 RETURNING *`,
      [id,status,JSON.stringify(receipt),errorCode,review?.by || null,review?.note || null])).rows[0];
      if (status === "succeeded") {
        await client.query(`UPDATE gauntlet_survival_passes SET activated_at=$3,expires_at=$4,
          purchase_id=$5,pending_purchase_id=NULL WHERE guild_id=$1 AND user_id=$2`,
        [identity.guild_id,identity.user_id,result.activated_at,result.expires_at,id]);
      } else if (status === "failed") {
        await client.query(`UPDATE gauntlet_survival_passes SET pending_purchase_id=NULL
          WHERE guild_id=$1 AND user_id=$2`, [identity.guild_id,identity.user_id]);
      }
      return result;
    });
  }
}
module.exports = { PASS_PRICE, PASS_DAYS, initSurvivalPassSchema, SurvivalPassStore };
