// Resolve linked wallets and snapshot Squig traits for future Survival bonuses.

const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");
const { getSSL } = require("./utils");

const LINKS_DATABASE_URL = process.env.DATABASE_URL_LINKS;
const WALLET_LINKS_TABLE = process.env.WALLET_LINKS_TABLE || "wallet_links";
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const OPENSEA_CHAIN = process.env.OPENSEA_CHAIN || "ethereum";
const SQUIGS_CONTRACT_ADDRESS = (
  process.env.SQUIGS_CONTRACT_ADDRESS ||
  "0x8c9a02c0585200c4c65608df6b8def543d33792a"
).toLowerCase();
const OPENSEA_SQUIG_COLLECTION = process.env.OPENSEA_SQUIG_COLLECTION || null;
const SQUIG_TRAIT_LOG_CHANNEL_ID =
  process.env.SQUIG_TRAIT_LOG_CHANNEL_ID || "1477463175665287410";
const OPENSEA_TIMEOUT_MS = Number(process.env.OPENSEA_TIMEOUT_MS || "15000");
const OPENSEA_ACCOUNT_PAGE_LIMIT = Math.min(
  200,
  Math.max(1, Number(process.env.OPENSEA_ACCOUNT_PAGE_LIMIT || "200") || 200)
);
const OPENSEA_ACCOUNT_MAX_PAGES = Math.max(
  1,
  Number(process.env.OPENSEA_ACCOUNT_MAX_PAGES || "10") || 10
);
const OPENSEA_MAX_DETAILS_PER_WALLET = Math.max(
  1,
  Number(process.env.OPENSEA_MAX_DETAILS_PER_WALLET || "100") || 100
);
const SQUIG_TRAIT_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.SQUIG_TRAIT_CACHE_TTL_MS || `${15 * 60_000}`) || 0
);

const DISCORD_ID_COLUMN_CANDIDATES = [
  "discord_user_id",
  "discord_id",
  "discordid",
  "discordId",
  "discordUserId",
  "user_id",
  "userid",
  "userId",
  "discord",
];
const WALLET_COLUMN_CANDIDATES = [
  "wallet_address",
  "walletAddress",
  "wallet",
  "address",
  "evm_address",
  "eth_address",
  "linked_wallet",
  "linkedWallet",
];
const ORDER_COLUMN_CANDIDATES = [
  "verified_at",
  "updated_at",
  "linked_at",
  "created_at",
];

let linksPool = null;
let walletLinkColumnsPromise = null;
const walletSquigCache = new Map();
const nftDetailCache = new Map();

function log(...args) {
  console.log("[SQUIG:TRAITS]", ...args);
}

function warn(...args) {
  console.warn("[SQUIG:TRAITS]", ...args);
}

function normalizeAddress(value) {
  const address = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? address.toLowerCase() : null;
}

function maskWallet(wallet) {
  const clean = normalizeAddress(wallet);
  if (!clean) return "unknown wallet";
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function truncate(value, maxLength = 1000) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function parseTableName(raw) {
  const parts = String(raw || "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || parts.length > 2) return null;
  if (!parts.every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) {
    return null;
  }
  return parts.length === 2
    ? { schema: parts[0], table: parts[1] }
    : { schema: null, table: parts[0] };
}

function findColumn(columns, candidates) {
  const byLower = new Map(columns.map((col) => [col.toLowerCase(), col]));
  for (const candidate of candidates) {
    const found = byLower.get(candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function getLinksPool() {
  if (!LINKS_DATABASE_URL) return null;
  if (!linksPool) {
    linksPool = new Pool({
      connectionString: LINKS_DATABASE_URL,
      ssl: getSSL(LINKS_DATABASE_URL),
    });
    linksPool.on("error", (err) => {
      warn("wallet link pool error:", err?.message || err);
    });
  }
  return linksPool;
}

async function getWalletLinkColumns() {
  const pool = getLinksPool();
  if (!pool) {
    return { ok: false, reason: "DATABASE_URL_LINKS is not set" };
  }

  if (walletLinkColumnsPromise) return walletLinkColumnsPromise;

  walletLinkColumnsPromise = (async () => {
    const parsed = parseTableName(WALLET_LINKS_TABLE);
    if (!parsed) {
      return { ok: false, reason: `Invalid WALLET_LINKS_TABLE: ${WALLET_LINKS_TABLE}` };
    }

    const params = parsed.schema
      ? [parsed.schema, parsed.table]
      : [parsed.table];
    const sql = parsed.schema
      ? `
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `
      : `
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, ordinal_position
      `;
    const result = await pool.query(sql, params);
    const rows = result.rows || [];
    if (!rows.length) {
      return { ok: false, reason: `Table ${WALLET_LINKS_TABLE} was not found` };
    }

    const schema = rows[0].table_schema;
    const table = rows[0].table_name;
    const columns = rows
      .filter((row) => row.table_schema === schema && row.table_name === table)
      .map((row) => row.column_name);
    const discordColumn = findColumn(columns, DISCORD_ID_COLUMN_CANDIDATES);
    const walletColumn = findColumn(columns, WALLET_COLUMN_CANDIDATES);
    const orderColumn = findColumn(columns, ORDER_COLUMN_CANDIDATES);

    if (!discordColumn || !walletColumn) {
      return {
        ok: false,
        reason: `Could not find Discord/wallet columns in ${schema}.${table}`,
        columns,
      };
    }

    return {
      ok: true,
      schema,
      table,
      discordColumn,
      walletColumn,
      orderColumn,
    };
  })().catch((err) => {
    walletLinkColumnsPromise = null;
    return { ok: false, reason: err?.message || String(err) };
  });

  return walletLinkColumnsPromise;
}

async function resolveLinkedWallets(playerIds) {
  const uniquePlayerIds = Array.from(new Set((playerIds || []).map(String).filter(Boolean)));
  const columns = await getWalletLinkColumns();
  if (!columns.ok) {
    return {
      ok: false,
      reason: columns.reason,
      linksByUser: new Map(uniquePlayerIds.map((id) => [id, []])),
    };
  }

  const pool = getLinksPool();
  const tableRef = `${quoteIdent(columns.schema)}.${quoteIdent(columns.table)}`;
  const orderSql = columns.orderColumn
    ? ` ORDER BY ${quoteIdent(columns.orderColumn)} DESC NULLS LAST`
    : "";
  const result = await pool.query(
    `
      SELECT
        ${quoteIdent(columns.discordColumn)}::text AS discord_user_id,
        ${quoteIdent(columns.walletColumn)}::text AS wallet_address
      FROM ${tableRef}
      WHERE ${quoteIdent(columns.discordColumn)}::text = ANY($1::text[])
      ${orderSql}
    `,
    [uniquePlayerIds]
  );

  const linksByUser = new Map(uniquePlayerIds.map((id) => [id, []]));
  for (const row of result.rows || []) {
    const discordUserId = String(row.discord_user_id || "").trim();
    const wallet = normalizeAddress(row.wallet_address);
    if (!discordUserId || !wallet) continue;
    const wallets = linksByUser.get(discordUserId) || [];
    if (!wallets.includes(wallet)) wallets.push(wallet);
    linksByUser.set(discordUserId, wallets);
  }

  return { ok: true, linksByUser };
}

function getOpenSeaHeaders() {
  return {
    Accept: "application/json",
    "X-API-KEY": OPENSEA_API_KEY,
  };
}

async function openseaGet(path, params = {}) {
  if (!OPENSEA_API_KEY) {
    throw new Error("OPENSEA_API_KEY is not set");
  }
  const url = new URL(`https://api.opensea.io/api/v2${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await axios.get(url.toString(), {
    headers: getOpenSeaHeaders(),
    timeout: OPENSEA_TIMEOUT_MS,
  });
  return response.data || {};
}

function getNftContractAddress(nft) {
  if (!nft) return null;
  if (typeof nft.contract === "string") return normalizeAddress(nft.contract);
  return normalizeAddress(
    nft.contract_address ||
      nft.contract?.address ||
      nft.asset_contract?.address ||
      nft.assetContract?.address
  );
}

function getNftIdentifier(nft) {
  return String(
    nft?.identifier ||
      nft?.token_id ||
      nft?.tokenId ||
      nft?.tokenID ||
      nft?.id ||
      ""
  ).trim();
}

function normalizeTraits(rawTraits) {
  if (Array.isArray(rawTraits)) {
    return rawTraits
      .map((trait) => {
        const traitType = String(
          trait?.trait_type || trait?.traitType || trait?.type || trait?.name || ""
        ).trim();
        const value =
          trait?.value === null || trait?.value === undefined
            ? ""
            : String(trait.value).trim();
        if (!traitType && !value) return null;
        return {
          trait_type: traitType || "Trait",
          value,
        };
      })
      .filter(Boolean);
  }

  if (rawTraits && typeof rawTraits === "object") {
    return Object.entries(rawTraits)
      .map(([traitType, value]) => ({
        trait_type: String(traitType || "").trim() || "Trait",
        value:
          value === null || value === undefined ? "" : String(value).trim(),
      }))
      .filter((trait) => trait.trait_type || trait.value);
  }

  return [];
}

function normalizeNft(raw) {
  const nft = raw?.nft || raw || {};
  const tokenId = getNftIdentifier(nft);
  return {
    tokenId,
    name: nft.name || (tokenId ? `Squig #${tokenId}` : "Squig"),
    contract: getNftContractAddress(nft) || SQUIGS_CONTRACT_ADDRESS,
    imageUrl: nft.image_url || nft.imageUrl || null,
    openseaUrl: nft.opensea_url || nft.openseaUrl || null,
    traits: normalizeTraits(nft.traits || nft.attributes),
  };
}

async function fetchNftDetail(tokenId) {
  const cacheKey = `${OPENSEA_CHAIN}:${SQUIGS_CONTRACT_ADDRESS}:${tokenId}`;
  const cached = nftDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const data = await openseaGet(
    `/chain/${encodeURIComponent(OPENSEA_CHAIN)}/contract/${encodeURIComponent(
      SQUIGS_CONTRACT_ADDRESS
    )}/nfts/${encodeURIComponent(tokenId)}`
  );
  const normalized = normalizeNft(data.nft || data);
  if (SQUIG_TRAIT_CACHE_TTL_MS > 0) {
    nftDetailCache.set(cacheKey, {
      expiresAt: Date.now() + SQUIG_TRAIT_CACHE_TTL_MS,
      value: normalized,
    });
  }
  return normalized;
}

async function fetchWalletSquigs(wallet) {
  const cleanWallet = normalizeAddress(wallet);
  if (!cleanWallet) return { ok: false, reason: "invalid_wallet", squigs: [] };

  const cacheKey = [
    OPENSEA_CHAIN,
    SQUIGS_CONTRACT_ADDRESS,
    cleanWallet,
    OPENSEA_SQUIG_COLLECTION || "all",
  ].join(":");
  const cached = walletSquigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const byTokenId = new Map();
  const warnings = [];
  let next = null;
  let page = 0;

  do {
    page += 1;
    const data = await openseaGet(
      `/chain/${encodeURIComponent(OPENSEA_CHAIN)}/account/${encodeURIComponent(
        cleanWallet
      )}/nfts`,
      {
        limit: OPENSEA_ACCOUNT_PAGE_LIMIT,
        next,
        collection: OPENSEA_SQUIG_COLLECTION,
      }
    );
    const nfts = Array.isArray(data.nfts)
      ? data.nfts
      : Array.isArray(data.assets)
      ? data.assets
      : [];

    for (const rawNft of nfts) {
      const contract = getNftContractAddress(rawNft);
      if (!OPENSEA_SQUIG_COLLECTION && contract !== SQUIGS_CONTRACT_ADDRESS) {
        continue;
      }
      const normalized = normalizeNft(rawNft);
      if (!normalized.tokenId) continue;
      byTokenId.set(normalized.tokenId, normalized);
    }

    next = data.next || null;
  } while (next && page < OPENSEA_ACCOUNT_MAX_PAGES);

  if (next) {
    warnings.push(
      `OpenSea account NFT pagination stopped after ${OPENSEA_ACCOUNT_MAX_PAGES} pages`
    );
  }

  const squigs = Array.from(byTokenId.values());
  const detailsToFetch = squigs
    .filter((squig) => !squig.traits?.length)
    .slice(0, OPENSEA_MAX_DETAILS_PER_WALLET);
  if (detailsToFetch.length < squigs.filter((squig) => !squig.traits?.length).length) {
    warnings.push(
      `NFT detail lookup capped at ${OPENSEA_MAX_DETAILS_PER_WALLET} tokens`
    );
  }

  for (const squig of detailsToFetch) {
    try {
      const detailed = await fetchNftDetail(squig.tokenId);
      byTokenId.set(squig.tokenId, {
        ...squig,
        ...detailed,
        tokenId: squig.tokenId,
        traits: detailed.traits?.length ? detailed.traits : squig.traits,
      });
    } catch (err) {
      warnings.push(`Trait lookup failed for #${squig.tokenId}: ${err?.message || err}`);
    }
  }

  const value = {
    ok: true,
    wallet: cleanWallet,
    squigs: Array.from(byTokenId.values()).sort(
      (a, b) => Number(a.tokenId) - Number(b.tokenId)
    ),
    warnings,
  };
  if (SQUIG_TRAIT_CACHE_TTL_MS > 0) {
    walletSquigCache.set(cacheKey, {
      expiresAt: Date.now() + SQUIG_TRAIT_CACHE_TTL_MS,
      value,
    });
  }
  return value;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runNext())
  );
  return results;
}

function formatTraitList(traits) {
  const cleanTraits = (traits || []).filter((trait) => trait.trait_type || trait.value);
  if (!cleanTraits.length) return "No traits returned";
  return cleanTraits
    .slice(0, 8)
    .map((trait) => `${trait.trait_type}: ${trait.value || "none"}`)
    .join(", ");
}

function formatPlayerSnapshot(playerId, playerSnapshot) {
  const walletText = playerSnapshot.wallets.length
    ? playerSnapshot.wallets.map(maskWallet).join(", ")
    : "No linked wallet";
  if (!playerSnapshot.wallets.length) return walletText;
  if (!playerSnapshot.squigs.length) return `${walletText}\nNo Squigs found.`;

  const lines = playerSnapshot.squigs.slice(0, 3).map((squig) => {
    return `#${squig.tokenId}: ${formatTraitList(squig.traits)}`;
  });
  if (playerSnapshot.squigs.length > 3) {
    lines.push(`+${playerSnapshot.squigs.length - 3} more Squig(s)`);
  }
  return `${walletText}\n${lines.join("\n")}`;
}

async function sendSnapshotLog(client, snapshot) {
  if (!client || !SQUIG_TRAIT_LOG_CHANNEL_ID) return;

  let channel = null;
  try {
    channel =
      client.channels.cache.get(SQUIG_TRAIT_LOG_CHANNEL_ID) ||
      (await client.channels.fetch(SQUIG_TRAIT_LOG_CHANNEL_ID));
  } catch (err) {
    warn("Could not fetch trait log channel:", err?.message || err);
    return;
  }
  if (!channel?.send) return;

  const color = snapshot.ok ? 0x3498db : 0xe67e22;
  const embed = new EmbedBuilder()
    .setTitle("Squig Survival Trait Snapshot")
    .setColor(color)
    .setTimestamp(new Date())
    .setDescription(
      [
        `Players: **${snapshot.playerCount}**`,
        `Linked players: **${snapshot.linkedPlayerCount}**`,
        `Wallets checked: **${snapshot.walletsChecked}**`,
        `Squigs found: **${snapshot.squigCount}**`,
        `Source: OpenSea \`${OPENSEA_CHAIN}\` / \`${SQUIGS_CONTRACT_ADDRESS}\``,
      ].join("\n")
    );

  if (snapshot.reason) {
    embed.addFields({
      name: "Neutral fallback",
      value: truncate(snapshot.reason, 1000),
    });
  }

  for (const player of snapshot.players.slice(0, 10)) {
    embed.addFields({
      name: `Discord ${player.userId} - ${player.squigs.length} Squig(s)`,
      value: truncate(formatPlayerSnapshot(player.userId, player), 1000),
    });
  }

  if (snapshot.players.length > 10) {
    embed.addFields({
      name: "Additional players",
      value: `${snapshot.players.length - 10} player(s) omitted from this log embed.`,
    });
  }

  if (snapshot.warnings.length) {
    embed.addFields({
      name: "Warnings",
      value: truncate(snapshot.warnings.slice(0, 8).join("\n"), 1000),
    });
  }

  try {
    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    warn("Could not send trait snapshot log:", err?.message || err);
  }
}

async function snapshotSurvivalSquigTraits({ client, playerIds }) {
  const uniquePlayerIds = Array.from(
    new Set((playerIds || []).map(String).filter(Boolean))
  );
  const emptyPlayers = uniquePlayerIds.map((userId) => ({
    userId,
    wallets: [],
    squigs: [],
    warnings: [],
  }));

  const neutral = async (reason) => {
    const snapshot = {
      ok: false,
      reason,
      playerCount: uniquePlayerIds.length,
      linkedPlayerCount: 0,
      walletsChecked: 0,
      squigCount: 0,
      players: emptyPlayers,
      warnings: reason ? [reason] : [],
    };
    await sendSnapshotLog(client, snapshot);
    return snapshot;
  };

  if (!uniquePlayerIds.length) return neutral("No players to check");
  if (!LINKS_DATABASE_URL) return neutral("DATABASE_URL_LINKS is not set");
  if (!OPENSEA_API_KEY) return neutral("OPENSEA_API_KEY is not set");

  try {
    const linkResult = await resolveLinkedWallets(uniquePlayerIds);
    if (!linkResult.ok) return neutral(linkResult.reason);

    const walletSet = new Set();
    for (const wallets of linkResult.linksByUser.values()) {
      for (const wallet of wallets) walletSet.add(wallet);
    }
    const wallets = Array.from(walletSet);

    const walletResults = new Map();
    const warnings = [];
    await mapLimit(wallets, 2, async (wallet) => {
      try {
        const result = await fetchWalletSquigs(wallet);
        walletResults.set(wallet, result);
        for (const warning of result.warnings || []) {
          warnings.push(`${maskWallet(wallet)}: ${warning}`);
        }
      } catch (err) {
        const reason = err?.response?.status
          ? `OpenSea HTTP ${err.response.status}`
          : err?.message || String(err);
        walletResults.set(wallet, {
          ok: false,
          wallet,
          squigs: [],
          warnings: [reason],
        });
        warnings.push(`${maskWallet(wallet)}: ${reason}`);
      }
    });

    const players = uniquePlayerIds.map((userId) => {
      const playerWallets = linkResult.linksByUser.get(userId) || [];
      const byTokenId = new Map();
      const playerWarnings = [];
      for (const wallet of playerWallets) {
        const result = walletResults.get(wallet);
        for (const squig of result?.squigs || []) {
          byTokenId.set(squig.tokenId, squig);
        }
        for (const warning of result?.warnings || []) {
          playerWarnings.push(`${maskWallet(wallet)}: ${warning}`);
        }
      }
      return {
        userId,
        wallets: playerWallets,
        squigs: Array.from(byTokenId.values()).sort(
          (a, b) => Number(a.tokenId) - Number(b.tokenId)
        ),
        warnings: playerWarnings,
      };
    });

    const snapshot = {
      ok: true,
      playerCount: uniquePlayerIds.length,
      linkedPlayerCount: players.filter((player) => player.wallets.length).length,
      walletsChecked: wallets.length,
      squigCount: players.reduce((sum, player) => sum + player.squigs.length, 0),
      players,
      warnings,
    };
    await sendSnapshotLog(client, snapshot);
    log(
      `snapshot complete players=${snapshot.playerCount} linked=${snapshot.linkedPlayerCount} wallets=${snapshot.walletsChecked} squigs=${snapshot.squigCount}`
    );
    return snapshot;
  } catch (err) {
    const reason = err?.message || String(err);
    warn("snapshot failed:", reason);
    return neutral(reason);
  }
}

module.exports = {
  snapshotSurvivalSquigTraits,
};
