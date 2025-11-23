// src/db.js
// Postgres store for The Gauntlet

const { Pool } = require("pg");
const { GAUNTLET_RESET, getSSL } = require("./utils");

class PgStore {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: getSSL(),
    });
  }

  async init() {
    if (GAUNTLET_RESET) {
      await this.pool.query(`
        DROP TABLE IF EXISTS gauntlet_scores;
        DROP TABLE IF EXISTS gauntlet_plays;
        DROP TABLE IF EXISTS gauntlet_daily;
        DROP TABLE IF EXISTS gauntlet_runs;
        DROP TABLE IF EXISTS gauntlet_lb_messages;
      `);
    }

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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_daily (
        user_id TEXT NOT NULL,
        play_date DATE NOT NULL,
        PRIMARY KEY (user_id, play_date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_lb_messages (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        month TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id, month)
      );
    `);
  }

  async recordPlay(userId, dateStr) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_daily(user_id, play_date)
      VALUES($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, dateStr]
    );
  }

  async hasPlayed(userId, dateStr) {
    const r = await this.pool.query(
      `
      SELECT 1
      FROM gauntlet_daily
      WHERE user_id=$1 AND play_date=$2
      LIMIT 1
      `,
      [userId, dateStr]
    );
    return r.rowCount > 0;
  }

  async insertRun(userId, username, month, score) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_runs(user_id, username, month, score)
      VALUES ($1,$2,$3,$4)
      `,
      [userId, username, month, score]
    );
  }

  async getMonthlyTop(month, limit = 10) {
    const r = await this.pool.query(
      `
      SELECT
        user_id,
        MAX(username) AS username,
        MAX(score) AS best,
        SUM(score) AS total
      FROM gauntlet_runs
      WHERE month=$1
      GROUP BY user_id
      ORDER BY best DESC, total DESC, username ASC
      LIMIT $2
      `,
      [month, limit]
    );
    return r.rows;
  }

  async getRecentRuns(month, limit = 10) {
    const r = await this.pool.query(
      `
      SELECT user_id, username, score, finished_at
      FROM gauntlet_runs
      WHERE month=$1
      ORDER BY finished_at DESC
      LIMIT $2
      `,
      [month, limit]
    );
    return r.rows;
  }

  async upsertLbMessage(guildId, channelId, month, messageId) {
    await this.pool.query(
      `
      INSERT INTO gauntlet_lb_messages(guild_id, channel_id, month, message_id)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (guild_id, channel_id, month)
      DO UPDATE SET message_id = EXCLUDED.message_id
      `,
      [guildId, channelId, month, messageId]
    );
  }

  async getLbMessages(month) {
    const r = await this.pool.query(
      `
      SELECT guild_id, channel_id, message_id
      FROM gauntlet_lb_messages
      WHERE month=$1
      `,
      [month]
    );
    return r.rows;
  }

  async getMyMonth(userId, month) {
    const r = await this.pool.query(
      `
      SELECT
        COALESCE(MAX(score),0) AS best,
        COALESCE(SUM(score),0) AS total,
        COUNT(*) AS plays
      FROM gauntlet_runs
      WHERE user_id=$1 AND month=$2
      `,
      [userId, month]
    );
    return r.rows[0] || { best: 0, total: 0, plays: 0 };
  }
}

const Store = new PgStore();

async function initStore() {
  await Store.init();
}

module.exports = {
  Store,
  initStore,
};
