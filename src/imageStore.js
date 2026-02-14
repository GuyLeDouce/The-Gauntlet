// src/imageStore.js
// Postgres store for Squig Survival images (separate DB via DATABASE_URL_IMAGE).

const { Pool } = require("pg");
const { getSSL } = require("./utils");

function log(...args) {
  console.log("[GAUNTLET:IMGDB]", ...args);
}

class ImageStore {
  constructor() {
    this.pool = null;
    this._initialized = false;
  }

  _buildPool() {
    if (this.pool) return;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL_IMAGE,
      ssl: getSSL(),
    });
    this.pool.on("error", (err) => {
      log("Postgres pool error (will continue):", err?.message || err);
    });
  }

  async init() {
    if (this._initialized) return;

    if (!process.env.DATABASE_URL_IMAGE) {
      log("DATABASE_URL_IMAGE not set. Image DB disabled.");
      this._initialized = true;
      return;
    }

    if (process.env.IMAGE_DB_SAFE !== "true") {
      log(
        "IMAGE_DB_SAFE is not set to \"true\". Image DB disabled to prevent accidental destructive changes."
      );
      this._initialized = true;
      return;
    }

    this._buildPool();

    try {
      await this.pool.query("SELECT 1");
      log("DB health check OK.");
    } catch (err) {
      log("DB health check FAILED:", err?.message || err);
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS squig_survival_images (
        id BIGSERIAL PRIMARY KEY,
        image_url TEXT NOT NULL UNIQUE,
        user_id TEXT NULL,
        added_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    this._initialized = true;
    log("Image database ready.");
  }

  async addSurvivalImage({ imageUrl, userId = null, addedBy = null }) {
    await this.init();

    if (!process.env.DATABASE_URL_IMAGE || !this.pool) {
      return { ok: false, reason: "DATABASE_URL_IMAGE not set" };
    }

    const r = await this.pool.query(
      `
      INSERT INTO squig_survival_images (image_url, user_id, added_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (image_url)
      DO UPDATE SET user_id = EXCLUDED.user_id, added_by = EXCLUDED.added_by
      RETURNING id
      `,
      [imageUrl, userId, addedBy]
    );

    return { ok: true, id: r.rows[0]?.id || null };
  }

  async getSurvivalImages() {
    await this.init();

    if (!process.env.DATABASE_URL_IMAGE || !this.pool) return [];

    const r = await this.pool.query(`
      SELECT image_url, user_id
      FROM squig_survival_images
      ORDER BY id ASC
    `);
    return r.rows || [];
  }
}

const imageStore = new ImageStore();

async function initImageStore() {
  await imageStore.init();
}

module.exports = {
  imageStore,
  initImageStore,
};
