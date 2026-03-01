// survival.js
// Core RNG story engine for Squig Survival.

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { rewardCharmAmount, logCharmReward } = require("./drip");
const { imageStore } = require("./imageStore");
const { survivalStore } = require("./survivalStore");
const { getSurvivalEraDefinition } = require("./survivalEras");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const REVEAL_DELAY_MS = 2000;
const MILESTONE_PAUSE_MS = 20000;
const SHARED_LOCKED_FIRST_IMAGE = "https://i.imgur.com/jfVffAW.jpeg";
const SHARED_FALLBACK_STAGE_IMAGES = [
  "https://i.imgur.com/jYNKD3d.jpeg",
  "https://i.imgur.com/8hJ6XEE.jpeg",
  "https://i.imgur.com/yBmAjMh.jpeg",
  "https://i.imgur.com/fiNkaTa.jpeg",
  "https://i.imgur.com/r5Nysp5.jpeg",
  "https://i.imgur.com/oDDwiXk.jpeg",
  "https://i.imgur.com/1NTPdp2.jpeg",
  "https://i.imgur.com/R4wlJ1q.jpeg",
  "https://i.imgur.com/RJwmxm4.jpeg",
  "https://i.imgur.com/atw2YPn.jpeg",
  "https://i.imgur.com/9RY06vL.jpeg",
  "https://i.imgur.com/dnTGhgl.jpeg",
  "https://i.imgur.com/whAJaka.jpeg",
  "https://i.imgur.com/njckQiQ.jpeg",
  "https://i.imgur.com/szOnMxN.jpeg",
  "https://i.imgur.com/K4x6Dgk.jpeg",
  "https://i.imgur.com/Nmc9UPb.jpeg",
  "https://i.imgur.com/bZwvi5J.jpeg",
  "https://i.imgur.com/Tlf4elV.jpeg",
  "https://i.imgur.com/K1BMD1e.jpeg",
  "https://i.imgur.com/eDAkAOV.png",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildDisplayNameMap(client, guildId, userIds) {
  const map = new Map();
  const unique = Array.from(new Set(userIds || [])).filter(Boolean);
  if (!unique.length) return map;

  let guild = null;
  if (guildId) {
    try {
      guild = await client.guilds.fetch(guildId);
    } catch {
      guild = null;
    }
  }

  if (guild) {
    try {
      const members = await guild.members.fetch({ user: unique });
      for (const [id, member] of members) {
        const name =
          member.nickname ||
          member.user.displayName ||
          member.user.globalName ||
          member.user.username ||
          `User-${id}`;
        map.set(id, name);
      }
    } catch {
      for (const id of unique) {
        if (map.has(id)) continue;
        try {
          const member = await guild.members.fetch(id);
          const name =
            member.nickname ||
            member.user.displayName ||
            member.user.globalName ||
            member.user.username ||
            `User-${id}`;
          map.set(id, name);
        } catch {}
      }
    }
  }

  for (const id of unique) {
    if (map.has(id)) continue;
    try {
      const user = await client.users.fetch(id);
      const name =
        user.displayName || user.globalName || user.username || `User-${id}`;
      map.set(id, name);
    } catch {
      map.set(id, `User-${id}`);
    }
  }

  return map;
}

const SURVIVAL_ART_PAYOUT = 100;
const SURVIVAL_ART_REWARDS = {
  "https://i.imgur.com/Tlf4elV.jpeg": {
    userId: "836389642885398530",
    amount: SURVIVAL_ART_PAYOUT,
    reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
  },
  "https://i.imgur.com/K1BMD1e.jpeg": {
    userId: "836389642885398530",
    amount: SURVIVAL_ART_PAYOUT,
    reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
  },
  "https://i.imgur.com/eDAkAOV.png": {
    userId: "833502268137144330",
    amount: SURVIVAL_ART_PAYOUT,
    reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
  },
};

const PODIUM_RINGS = [
  { color: "#d4af37", label: "1st" }, // gold
  { color: "#c0c0c0", label: "2nd" }, // silver
  { color: "#cd7f32", label: "3rd" }, // bronze
];

async function buildPodiumImage(client, placements, guildId) {
  try {
    const topThree = [];
    for (const id of placements || []) {
      if (!topThree.includes(id)) topThree.push(id);
      if (topThree.length >= 3) break;
    }
    if (!topThree.length) return null;

    const width = 900;
    const height = 520;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background image
    try {
      const bgImg = await loadImage("https://i.imgur.com/xjpLTnF.jpeg");
      ctx.drawImage(bgImg, 0, 0, width, height);
    } catch {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1b1f2a");
      bg.addColorStop(1, "#0f1117");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    // Subtle darken for contrast
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, width, height);

    // Draw avatars
    const avatarSize = 144;
    const podiumY = height - 120;
    const blockW = 200;
    const blockGap = 30;
    const centerX = width / 2;
    const raiseBy = avatarSize / 2;
    const avatarCenters = [
      { x: centerX, y: podiumY - 180 - 20 - raiseBy },
      { x: centerX - blockW - blockGap, y: podiumY - 130 - 10 - raiseBy },
      { x: centerX + blockW + blockGap, y: podiumY - 110 - 10 - raiseBy },
    ];

    let guild = null;
    if (guildId) {
      try {
        guild = await client.guilds.fetch(guildId);
      } catch {
        guild = null;
      }
    }

    for (let i = 0; i < 3; i++) {
      const userId = topThree[i];
      if (!userId) continue;
      let avatarUrl;
      try {
        if (guild) {
          const member = await guild.members.fetch(userId);
          avatarUrl = member.displayAvatarURL({ extension: "png", size: 256 });
        } else {
          const user = await client.users.fetch(userId);
          avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
        }
      } catch {
        try {
          const user = await client.users.fetch(userId);
          avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
        } catch {
          avatarUrl = null;
        }
      }

      const center = avatarCenters[i];
      const radius = avatarSize / 2;
      const ring = PODIUM_RINGS[i];

      if (avatarUrl) {
        const img = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, center.x - radius, center.y - radius, avatarSize, avatarSize);
        ctx.restore();
      } else {
        ctx.fillStyle = "#2b3242";
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ring
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      // Rank label
      ctx.fillStyle = ring.color;
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ring.label, center.x, center.y + radius + 28);
    }

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[GAUNTLET] Podium image failed:", err?.message || err);
    return null;
  }
}

function format(template, victimId, killerId, nameOf) {
  // Victim is always eliminated -> crossed out.
  const victimName = `~~${nameOf(victimId)}~~`;
  const killerName = killerId ? nameOf(killerId) : "another Squig";

  return template
    .replace(/{victim}/g, victimName)
    .replace(/{killer}/g, killerName);
}

/**
 * Run the Squig Survival story.
 * @param {import('discord.js').TextChannel} channel
 * @param {string[]} playerIds - Array of user IDs
 * @param {object} settings
 */
async function runSurvival(channel, playerIds, settings = {}) {
  if (!playerIds || playerIds.length === 0) return;

  const normalizedSettings = {
    era_key: settings?.era_key || "day_one",
    era: settings?.era || null,
    pool_increment: Number(settings?.pool_increment || 50) || 50,
    bonus_active: Boolean(settings?.bonus_active),
    bonus_required_players: Math.max(
      1,
      Number(settings?.bonus_required_players || 0) || 1
    ),
    bonus_multiplier: Math.max(
      1,
      Number(settings?.bonus_multiplier || 1) || 1
    ),
  };
  const defaultEraDefinition = getSurvivalEraDefinition("day_one");
  const eraDefinition = getSurvivalEraDefinition(normalizedSettings.era_key);
  const eraLabel = normalizedSettings.era || eraDefinition.label;

  let dbImageRows = [];
  try {
    dbImageRows = await imageStore.getSurvivalImages();
  } catch (err) {
    console.error(
      "[GAUNTLET:IMGDB] Failed to load survival images:",
      err?.message || err
    );
  }

  const dbImageUrls = dbImageRows.map((r) => r.image_url).filter(Boolean);
  const fallbackStageImages = Array.from(new Set(SHARED_FALLBACK_STAGE_IMAGES));
  const mergedStageImages = [...new Set([...fallbackStageImages, ...dbImageUrls])];
  const dbRewardMap = new Map(
    dbImageRows
      .filter((r) => r.image_url && r.user_id)
      .map((r) => [
        r.image_url,
        {
          userId: r.user_id,
          amount: SURVIVAL_ART_PAYOUT,
          reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
        },
      ])
  );

  const uniquePlayers = Array.from(new Set(playerIds));
  const gameId = await survivalStore.createGame(new Date());
  if (gameId) {
    await Promise.all(
      uniquePlayers.map((id) => survivalStore.recordJoin(gameId, id, new Date()))
    );
  }
  const nameMap = await buildDisplayNameMap(
    channel.client,
    channel.guildId,
    uniquePlayers
  );
  const nameOf = (id) => nameMap.get(id) || `User-${id}`;

  let alive = [...uniquePlayers];
  const eliminated = [];
  let imageBag = shuffle(mergedStageImages);

  const eraStories = eraDefinition.stories || {};
  const defaultStories = defaultEraDefinition.stories || {};
  const hidingSpots = eraStories.hidingSpots?.length
    ? eraStories.hidingSpots
    : defaultStories.hidingSpots || [];
  const clumsiness = eraStories.clumsiness?.length
    ? eraStories.clumsiness
    : defaultStories.clumsiness || [];
  const sabotage = eraStories.sabotage?.length
    ? eraStories.sabotage
    : defaultStories.sabotage || [];
  const resurrections = eraStories.resurrections?.length
    ? eraStories.resurrections
    : defaultStories.resurrections || [];
  const loreLines = eraDefinition.loreLines?.length
    ? eraDefinition.loreLines
    : defaultEraDefinition.loreLines || [];
  const milestoneStages = eraDefinition.milestoneStages?.length
    ? eraDefinition.milestoneStages
    : defaultEraDefinition.milestoneStages || [];

  // One player = instant win embed
  if (alive.length === 1) {
    const payouts = calculateSurvivalPayouts(
      uniquePlayers,
      [alive[0]],
      normalizedSettings
    );
    await sendSurvivalPayouts(
      channel,
      payouts,
      [alive[0]],
      uniquePlayers.length,
      normalizedSettings
    );
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Squig Survival - Default Victory")
          .setDescription(
            `${nameOf(alive[0])} is the only Squig who dared the portal.\nThey survive by technicality... the portal is unimpressed.`
          )
          .setColor(0x2ecc71),
      ],
    });
    return;
  }

  let milestone = 1;

  while (alive.length > 1) {
    const lines = [];
    const killsThisRound = Math.max(1, Math.floor(alive.length / 3));

    // --- ELIMINATIONS ---
    for (let i = 0; i < killsThisRound && alive.length > 1; i++) {
      const victimIndex = Math.floor(Math.random() * alive.length);
      const victimId = alive.splice(victimIndex, 1)[0];
      eliminated.push(victimId);
      if (gameId) {
        await survivalStore.addDeath(gameId, victimId, 1);
      }

      const category = Math.floor(Math.random() * 3);
      let text;

      if (category === 0) {
        // Hiding spot
        text = format(pick(hidingSpots), victimId, null, nameOf);
      } else if (category === 1) {
        // Clumsiness
        text = format(pick(clumsiness), victimId, null, nameOf);
      } else {
        // Sabotage - needs a killer if possible
        if (alive.length === 0) {
          text = format(pick(clumsiness), victimId, null, nameOf);
        } else {
          const killerId = alive[Math.floor(Math.random() * alive.length)];
          text = format(pick(sabotage), victimId, killerId, nameOf);
          if (gameId) {
            await survivalStore.addElimination(gameId, killerId, 1);
          }
        }
      }

      // 💀 Death line
      lines.push(`💀 ${text}`);
    }

    // --- RESURRECTION CHANCE ---
    if (
      eliminated.length > 0 &&
      resurrections.length > 0 &&
      Math.random() < 0.18 // ~18% chance per milestone
    ) {
      const revivedIndex = Math.floor(Math.random() * eliminated.length);
      const revivedId = eliminated.splice(revivedIndex, 1)[0];
      alive.push(revivedId);

      const resurrectionTemplate = pick(resurrections);
      // Revived Squig should appear normally (no strikethrough)
      const resurrectionText = resurrectionTemplate.replace(
        /{victim}/g,
        nameOf(revivedId)
      );

      // ✨ Revival line (emphasized)
      lines.push("🌟 **RESURRECTION!**");
      lines.push(`✨ **${resurrectionText}**`);
    }

    // --- LORE-ONLY LINES ---
    const loreCount = randInt(2, 3);
    for (let i = 0; i < loreCount; i++) {
      const who = pick(alive.length ? alive : uniquePlayers);
      const lore = pick(loreLines).replace(/{player}/g, nameOf(who));
      const insertAt = randInt(0, lines.length);
      lines.splice(insertAt, 0, lore);
    }

    // Pick the stage for this milestone
    const stageIndex = Math.min(
      milestone - 1,
      milestoneStages.length - 1
    );
    const stage = milestoneStages[stageIndex];

    const embed = new EmbedBuilder()
      .setTitle(`Squig Life - ${stage.title}`)
      .setColor(0x9b59b6);

    let imageUrl = null;
    if (milestone === 1) {
      imageUrl = SHARED_LOCKED_FIRST_IMAGE;
    } else if (mergedStageImages.length) {
      if (!imageBag.length) imageBag = shuffle(mergedStageImages);
      imageUrl = imageBag.shift() || null;
    }
    if (imageUrl) embed.setImage(imageUrl);
    const artReward = imageUrl
      ? dbRewardMap.get(imageUrl) || SURVIVAL_ART_REWARDS[imageUrl]
      : null;
    if (artReward) {
      if (gameId && artReward.userId) {
        await survivalStore.addImageUse(gameId, artReward.userId, imageUrl);
      }
      try {
        const reward = await rewardCharmAmount({
          userId: artReward.userId,
          username: `Artist-${artReward.userId}`,
          amount: artReward.amount,
          source: "survival-art",
          guildId: channel.guildId,
          channelId: channel.id,
          metadata: { imageUrl },
          logClient: channel.client,
          logReason: artReward.reason,
        });
        if (reward?.ok) {
          try {
            await channel.send(
              `-# 🎨 Art drop! Thanks to <@${artReward.userId}> — your Squig Survival art just got used and earned you **+${artReward.amount} $CHARM**.\n-# Want in? Post your image in <#1334884237727240267> and staff can add it so you earn $CHARM whenever it appears.`
            );
          } catch {}
          await logCharmReward(channel.client, {
            userId: artReward.userId,
            amount: artReward.amount,
            score: 0,
            source: "survival-art",
            channelId: channel.id,
            reason: artReward.reason,
          });
        }
      } catch (err) {
        console.error(
          "[GAUNTLET:DRIP] Survival art reward failed:",
          err?.message || err
        );
      }
    }

    const baseDesc = stage.flavor ? `_${stage.flavor}_\n` : "";
    const buildDesc = (count) => {
      if (!lines.length) return baseDesc.trim();
      const slice = lines.slice(0, count).join("\n");
      return `${baseDesc}${slice}`.trim();
    };

    embed.setDescription(buildDesc(0));

    // --- FOOTER: HOW MANY SQUIGS REMAIN ---
    const remainingText = `${alive.length} Squig${
      alive.length === 1 ? "" : "s"
    } Remain`;

    if (eraLabel) {
      embed.setFooter({
        text: `${eraLabel} - ${remainingText}`,
      });
    } else {
      embed.setFooter({
        text: remainingText,
      });
    }

    const msg = await channel.send({ embeds: [embed] });

    if (lines.length > 0) {
      for (let i = 1; i <= lines.length; i++) {
        await sleep(REVEAL_DELAY_MS);
        try {
          embed.setDescription(buildDesc(i));
          await msg.edit({ embeds: [embed] });
        } catch {
          // If edit fails (deleted or perms), just stop revealing.
          break;
        }
      }
    }
    milestone += 1;

    // Short breather between milestones
    await sleep(MILESTONE_PAUSE_MS);
  }

  // Winner + standings
  const winnerId = alive[0];
  const placements = [winnerId, ...eliminated.reverse()];
  if (gameId) {
    const uniquePlacements = [];
    for (const id of placements) {
      if (!uniquePlacements.includes(id)) uniquePlacements.push(id);
      if (uniquePlacements.length >= 3) break;
    }
    await Promise.all(
      uniquePlacements.map((id, idx) =>
        survivalStore.setPlacement(gameId, id, idx + 1)
      )
    );
  }

  const lbLines = placements.map((id, index) => {
    const rank = index + 1;
    let prefix;
    if (rank === 1) prefix = "🥇 1st";
    else if (rank === 2) prefix = "🥈 2nd";
    else if (rank === 3) prefix = "🥉 3rd";
    else prefix = `${rank}.`;
    return `${prefix} - ${nameOf(id)}`;
  });

  const standingsEmbed = new EmbedBuilder()
    .setTitle("Squig Survival - Final Standings")
    .setDescription(lbLines.join("\n"))
    .setColor(0xf1c40f)
    .setFooter({ text: "Only one Squig ever really makes it..." });

  const podiumBuffer = await buildPodiumImage(
    channel.client,
    placements,
    channel.guildId
  );
  if (podiumBuffer) {
    const podiumAttachment = new AttachmentBuilder(podiumBuffer, {
      name: "podium.png",
    });
    standingsEmbed.setImage("attachment://podium.png");
    await channel.send({
      embeds: [standingsEmbed],
      files: [podiumAttachment],
    });
  } else {
    await channel.send({
      embeds: [standingsEmbed],
    });
  }

  const payouts = calculateSurvivalPayouts(
    uniquePlayers,
    placements,
    normalizedSettings
  );
  await sendSurvivalPayouts(
    channel,
    payouts,
    placements,
    uniquePlayers.length,
    normalizedSettings
  );
}

function resolveSurvivalPrizePool(totalPlayers, settings = {}) {
  const poolIncrement = Math.max(1, Number(settings?.pool_increment || 50) || 50);
  const basePrizePool = poolIncrement * Math.max(0, totalPlayers);
  const bonusActive = Boolean(settings?.bonus_active);
  const bonusRequiredPlayers = Math.max(
    1,
    Number(settings?.bonus_required_players || 0) || 1
  );
  const bonusMultiplier = Math.max(
    1,
    Number(settings?.bonus_multiplier || 1) || 1
  );
  const bonusTriggered = bonusActive && totalPlayers >= bonusRequiredPlayers;
  const finalPrizePool = bonusTriggered
    ? Math.floor(basePrizePool * bonusMultiplier)
    : basePrizePool;

  return {
    poolIncrement,
    basePrizePool,
    bonusActive,
    bonusRequiredPlayers,
    bonusMultiplier,
    bonusTriggered,
    finalPrizePool,
  };
}

function calculateSurvivalPayouts(playerIds, placements, settings = {}) {
  const uniquePlayers = Array.from(new Set(playerIds || []));
  const poolInfo = resolveSurvivalPrizePool(uniquePlayers.length, settings);
  const prizePool = poolInfo.finalPrizePool;

  const uniquePlacements = [];
  for (const id of placements || []) {
    if (!uniquePlacements.includes(id)) uniquePlacements.push(id);
    if (uniquePlacements.length >= 3) break;
  }

  const payouts = {};
  let allocated = 0;

  if (uniquePlayers.length > 5) {
    const shares = [0.5, 0.3, 0.2];
    uniquePlacements.forEach((id, index) => {
      const raw = prizePool * shares[index];
      const amt = Math.floor(raw);
      payouts[id] = amt;
      allocated += amt;
    });

    if (uniquePlacements[0]) {
      const remainder = Math.max(0, prizePool - allocated);
      payouts[uniquePlacements[0]] =
        (payouts[uniquePlacements[0]] || 0) + remainder;
    }
  } else {
    if (uniquePlacements[0]) {
      payouts[uniquePlacements[0]] = prizePool;
    }
  }

  return payouts;
}

async function sendSurvivalPayouts(
  channel,
  payouts,
  placements,
  totalPlayers,
  settings = {}
) {
  try {
    const entries = Object.entries(payouts || {});
    if (!entries.length) return;
    const poolInfo = resolveSurvivalPrizePool(totalPlayers, settings);

    await Promise.all(
      entries.map(async ([userId, amount]) => {
        if (!amount || amount <= 0) return;
        const rank = placements ? placements.indexOf(userId) + 1 : 0;
        const rankLabel =
          rank === 1 ? "1st place" : rank === 2 ? "2nd place" : rank === 3 ? "3rd place" : "placement";
        const reward = await rewardCharmAmount({
          userId,
          username: `Player-${userId}`,
          amount,
          source: "survival",
          guildId: channel.guildId,
          channelId: channel.id,
          metadata: {
            mode: "survival",
            placement: rank || undefined,
            totalPlayers,
          },
          logClient: channel.client,
          logReason: `Squig Survival ${rankLabel}`,
        });
        if (reward?.ok) {
          await logCharmReward(channel.client, {
            userId,
            amount,
            score: 0,
            source: "survival",
            channelId: channel.id,
            reason: `Squig Survival ${rankLabel} (pool ${poolInfo.finalPrizePool})`,
          });
        }
      })
    );
  } catch (err) {
    console.error("[GAUNTLET:DRIP] Survival payouts failed:", err?.message || err);
  }
}

module.exports = { runSurvival, calculateSurvivalPayouts, buildPodiumImage };
