// src/db.js
// Postgres store for The Gauntlet (Railway-friendly, non-destructive)
//
// - Uses DATABASE_URL + SSL from ./utils
// - Creates tables if they don't exist
// - NEVER drops tables unless GAUNTLET_RESET is explicitly "true" (or true)
// - Exposes a singleton Store + initStore()

const { Pool } = require("pg");
const { GAUNTLET_RESET, getSSL } = require("./utils");

// ------------------------------------------------------------
// INTERNAL HELPERS
// ------------------------------------------------------------

// Be VERY explicit about when we reset.
// Only if GAUNTLET_RESET is literally "true" or boolean true.
const shouldReset =
  GAUNTLET_RESET === true || GAUNTLET_RESET === "true";

function log(...args) {
  console.log("[GAUNTLET:DB]", ...args);
}

// ------------------------------------------------------------
// PG STORE
// ------------------------------------------------------------

class PgStore {
  constructor() {
    // Pool will reuse connections across queries
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: getSSL(),
    });

    // Prevent unhandled pool errors from crashing the process.
    this.pool.on("error", (err) => {
      log("Postgres pool error (will continue):", err?.message || err);
    });

    this._initialized = false;
    this._keepAliveTimer = null;
  }

  async init() {
    if (this._initialized) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      throw new Error(
        "[GAUNTLET:DB] DATABASE_URL is not set. Check Railway variables."
      );
    }

    log("Connecting to Postgres...");

    // Health check: verify we can reach the DB at startup.
    try {
      await this.pool.query("SELECT 1");
      log("DB health check OK.");
    } catch (err) {
      log("DB health check FAILED:", err?.message || err);
      // Keep going so the bot can retry on next query.
    }

    // Optional destructive reset – ONLY when explicitly enabled
    if (shouldReset) {
      log("GAUNTLET_RESET=true → DROPPING ALL GAUNTLET TABLES");
      await this.pool.query(`
        DROP TABLE IF EXISTS gauntlet_scores;
        DROP TABLE IF EXISTS gauntlet_plays;
        DROP TABLE IF EXISTS gauntlet_daily;
        DROP TABLE IF EXISTS gauntlet_runs;
        DROP TABLE IF EXISTS gauntlet_lb_messages;
        DROP TABLE IF EXISTS gauntlet_drip_user_overrides;
      `);
    } else {
      log("GAUNTLET_RESET is not true → keeping existing data");
    }

    // Main runs table: one row per completed game
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_runs (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        month TEXT NOT NULL,
        score INTEGER NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Daily limit table: track if a user has played today
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_daily (
        user_id TEXT NOT NULL,
        play_date DATE NOT NULL,
        PRIMARY KEY (user_id, play_date)
      );
    `);

    // LB messages table: one per (guild, channel, month)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_lb_messages (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        month TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id, month)
      );
    `);

    // Manual DRIP routing override for Discord IDs.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_drip_user_overrides (
        discord_user_id TEXT PRIMARY KEY,
        drip_user_id TEXT NOT NULL,
        drip_credential_type TEXT NOT NULL DEFAULT 'discord-id',
        added_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      ALTER TABLE gauntlet_drip_user_overrides
      ADD COLUMN IF NOT EXISTS drip_credential_type TEXT NOT NULL DEFAULT 'discord-id';
    `);

    this._initialized = true;
    log("Database ready.");

    // Keep-alive: reduce idle disconnects (Railway can drop idle connections).
    if (!this._keepAliveTimer) {
      const minutes = Number(process.env.PG_KEEPALIVE_MINUTES || "5");
      const intervalMs = Math.max(1, minutes) * 60_000;
      this._keepAliveTimer = setInterval(async () => {
        try {
          await this.pool.query("SELECT 1");
        } catch (err) {
          log("DB keep-alive failed:", err?.message || err);
        }
      }, intervalMs);
      // Don't keep the process alive just for the timer.
      if (this._keepAliveTimer.unref) this._keepAliveTimer.unref();
      log(`DB keep-alive every ${minutes} minute(s).`);
    }
  }

  // ----------------------------------------------------------
  // DAILY PLAY LIMIT
  // ----------------------------------------------------------

  /**
   * Record that a user has played today.
   * @param {string} userId
   * @param {string} dateStr - YYYY-MM-DD
   */
  async recordPlay(userId, dateStr) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_daily (user_id, play_date)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, dateStr]
    );
  }

  /**
   * Has this user already played today?
   * @param {string} userId
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Promise<boolean>}
   */
  async hasPlayed(userId, dateStr) {
    const r = await this.pool.query(
      `
      SELECT 1
      FROM gauntlet_daily
      WHERE user_id = $1 AND play_date = $2
      LIMIT 1
      `,
      [userId, dateStr]
    );
    return r.rowCount > 0;
  }

  // ----------------------------------------------------------
  // RUNS (SCORES)
  // ----------------------------------------------------------

  /**
   * Insert a completed run.
   * @param {string} userId
   * @param {string} username
   * @param {string} month - e.g. "2025-11"
   * @param {number} score
   */
  async insertRun(userId, username, month, score) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_runs (user_id, username, month, score)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, username, month, score]
    );
  }

  /**
   * Get top players for a given month.
   * Ranked by:
   *   1) highest single-game score ("best")
   *   2) total points ("total")
   *   3) username (ASC)
   *
   * Returns rows like:
   * { user_id, username, best, total }
   */
  async getMonthlyTop(month, limit = 10) {
    const r = await this.pool.query(
      `
      SELECT
        user_id,
        MAX(username) AS username,
        MAX(score) AS best,
        SUM(score) AS total
      FROM gauntlet_runs
      WHERE month = $1
      GROUP BY user_id
      ORDER BY best DESC, total DESC, username ASC
      LIMIT $2
      `,
      [month, limit]
    );
    return r.rows;
  }

  /**
   * Get recent runs for a given month, newest first.
   * Returns rows like:
   * { user_id, username, score, finished_at }
   */
  async getRecentRuns(month, limit = 10) {
    const r = await this.pool.query(
      `
      SELECT user_id, username, score, finished_at
      FROM gauntlet_runs
      WHERE month = $1
      ORDER BY finished_at DESC
      LIMIT $2
      `,
      [month, limit]
    );
    return r.rows;
  }

  /**
   * Get my stats for a given month:
   * best (max), total (sum), plays (count).
   */
  async getMyMonth(userId, month) {
    const r = await this.pool.query(
      `
      SELECT
        COALESCE(MAX(score), 0) AS best,
        COALESCE(SUM(score), 0) AS total,
        COUNT(*) AS plays
      FROM gauntlet_runs
      WHERE user_id = $1 AND month = $2
      `,
      [userId, month]
    );

    return r.rows[0] || { best: 0, total: 0, plays: 0 };
  }

  // ----------------------------------------------------------
  // LEADERBOARD MESSAGE TRACKING
  // ----------------------------------------------------------

  /**
   * Upsert a stored leaderboard message ID for a guild/channel/month.
   */
  async upsertLbMessage(guildId, channelId, month, messageId) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_lb_messages (guild_id, channel_id, month, message_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id, channel_id, month)
      DO UPDATE SET message_id = EXCLUDED.message_id
      `,
      [guildId, channelId, month, messageId]
    );
  }

  /**
   * Get all leaderboard messages for a month.
   * Returns rows like:
   * { guild_id, channel_id, message_id }
   */
  async getLbMessages(month) {
    const r = await this.pool.query(
      `
      SELECT guild_id, channel_id, message_id
      FROM gauntlet_lb_messages
      WHERE month = $1
      `,
      [month]
    );
    return r.rows;
  }

  // ----------------------------------------------------------
  // DRIP USER OVERRIDES
  // ----------------------------------------------------------

  /**
   * Upsert manual DRIP user mapping for a Discord user ID.
   */
  async upsertDripUserOverride(
    discordUserId,
    dripUserId,
    addedBy,
    dripCredentialType = "discord-id"
  ) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_drip_user_overrides (
        discord_user_id,
        drip_user_id,
        drip_credential_type,
        added_by
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (discord_user_id)
      DO UPDATE SET
        drip_user_id = EXCLUDED.drip_user_id,
        drip_credential_type = EXCLUDED.drip_credential_type,
        added_by = EXCLUDED.added_by,
        updated_at = now()
      `,
      [
        discordUserId,
        dripUserId,
        dripCredentialType || "discord-id",
        addedBy || null,
      ]
    );
  }

  /**
   * Get manual DRIP user mapping for a Discord user ID.
   */
  async getDripUserOverride(discordUserId) {
    const r = await this.pool.query(
      `
      SELECT
        discord_user_id,
        drip_user_id,
        drip_credential_type,
        added_by,
        created_at,
        updated_at
      FROM gauntlet_drip_user_overrides
      WHERE discord_user_id = $1
      LIMIT 1
      `,
      [discordUserId]
    );
    return r.rows[0] || null;
  }

  // ----------------------------------------------------------
  // OPTIONAL: CLEANUP (not required but nice to have)
  // ----------------------------------------------------------

  async close() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
    }
    await this.pool.end();
    log("Pool closed.");
  }
}

// ------------------------------------------------------------
// SINGLETON EXPORTS
// ------------------------------------------------------------

const Store = new PgStore();

/**
 * Call this once on bot startup.
 */
async function initStore() {
  await Store.init();
}

module.exports = {
  Store,
  initStore,
};
