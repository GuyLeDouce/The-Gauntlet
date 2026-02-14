// survival.js
// Core RNG story engine for Squig Survival.

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { rewardCharmAmount, logCharmReward } = require("./drip");
const { imageStore } = require("./imageStore");
const { survivalStore } = require("./survivalStore");
const stories = require("./survivalStories");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const REVEAL_DELAY_MS = 2000;
const MILESTONE_PAUSE_MS = 20000;

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

/**
 * Life stages for each milestone.
 * We clamp to the last stage if the game runs longer than this list.
 */
const LOCKED_FIRST_IMAGE = "https://i.imgur.com/jfVffAW.jpeg";
const FALLBACK_STAGE_IMAGES = [
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
const RANDOM_STAGE_IMAGES = [...new Set(FALLBACK_STAGE_IMAGES)];
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

const LORE_LINES = [
  "🌀 {player} tries coffee for the first time and decides it is \"spicy water.\"",
  "🛒 {player} discovers grocery carts and insists they are \"metal steeds.\"",
  "📱 {player} scrolls for three hours and calls it \"research.\"",
  "🍕 {player} argues pineapple improves portals.",
  "🧦 {player} collects socks and declares them \"Earth skins.\"",
  "🎧 {player} hears lo-fi beats and refuses to stop vibing.",
  "🚌 {player} boards the wrong bus and calls it \"quest mode.\"",
  "🧴 {player} learns sunscreen exists and applies it to a hat.",
  "🧊 {player} meets ice for the first time and distrusts it.",
  "🪙 {player} trades a shiny pebble for a real coin and feels powerful.",
  "🧠 {player} reads a self-help book and still chooses chaos.",
  "🐸 {player} tries to befriend a frog and gets judged.",
  "🕶️ {player} buys sunglasses and claims \"the sun is rude.\"",
  "🍔 {player} believes burgers are a cultural handshake.",
  "🧼 {player} learns \"soap\" and becomes briefly unstoppable.",
  "🚦 {player} stares at traffic lights like they're speaking in riddles.",
  "📦 {player} discovers cardboard boxes are \"cozy portals.\"",
  "💤 {player} naps in public and calls it \"social camouflage.\"",
  "🎢 {player} rides a rollercoaster and rethinks gravity.",
  "📺 {player} watches a sitcom and decides humans are \"strange but funny.\"",
  "The day is calmer when {player} decides to simply people-watch.",
  "A vending machine teaches {player} the meaning of patience.",
  "Someone hands {player} a receipt and they keep it as a trophy.",
  "A pigeon stares back at {player}. They negotiate a truce.",
  "Today, {player} discovers escalators and calls them \"lazy stairs.\"",
  "An elevator stops. {player} bows out of respect.",
  "A hoodie becomes a ceremonial robe for {player}.",
  "The word \"brunch\" confuses {player} for 12 minutes.",
  "At the crosswalk, {player} misreads the tiny person as a warning sprite.",
  "On a walk, {player} decides sidewalks are \"ground rivers.\"",
  "A delivery driver nods at {player}. Diplomatic relations established.",
  "A subway map makes {player} feel briefly omniscient.",
  "A paper clip becomes a relic in {player}'s pocket.",
  "{player} declares socks optional and is immediately corrected by a breeze.",
  "A park bench adopts {player} for a quiet moment.",
  "The moon gets a casual wave from {player}. It does not wave back.",
  "Today, {player} learns the power of a good playlist.",
  "A rainy day turns {player}'s footsteps into percussion.",
  "A QR code confuses {player} and delights them anyway.",
  "A smoothie tastes like \"fruit lightning\" to {player}.",
  "A cat ignores {player}. This is taken as wisdom.",
  "A doorway welcomes {player} with a dramatic swoosh.",
  "A scarf becomes a cape, and {player} takes it seriously.",
  "A bakery aroma convinces {player} that Earth is worth it.",
  "A street musician inspires {player} to hum in Squig.",
  "Today, {player} decides that notebooks are sacred.",
  "A mailbox becomes {player}'s sworn enemy for five minutes.",
  "A carousel makes {player} consider spinning as a lifestyle.",
  "A mirror startles {player} with unexpected handsomeness.",
  "A water fountain teaches {player} to trust buttons.",
];

const MILESTONE_STAGES = [
  {
    title: "Landing Day 1 - First Impact",
    flavor:
      "Fresh from the portal, the Squigs splatter into Earth's atmosphere like confused cosmic confetti.",
    image: LOCKED_FIRST_IMAGE,
  },
  {
    title: "Month 1 on Earth - First Confusion",
    flavor:
      "The Squigs are still learning gravity, weather, and why humans keep putting pineapple on pizza.",
  },
  {
    title: "Month 2 on Earth - Bad Influences",
    flavor:
      "They discover social media, NFTs, and the horrifying power of quote-tweets.",
  },
  {
    title: "Month 3 on Earth - Questionable Hobbies",
    flavor:
      "Some Squigs start side hustles. Others become professional lurkers. All of them are still extremely weird.",
  },
  {
    title: "Month 4 on Earth - Full Degeneracy",
    flavor:
      "Sleep schedules are gone. Caffeine is up. Decisions are... not always good ones.",
  },
  {
    title: "Month 5 on Earth - The Great Overthink",
    flavor:
      "The Squigs begin to wonder if humans actually know what they're doing. Signs point to 'no'.",
  },
  {
    title: "Month 6 on Earth - Vanishing Acts",
    flavor:
      "One by one, Squigs disappear into strange side quests, mysterious DMs, and badly-timed adventures.",
  },
  {
    title: "Last Known Squig Presence on Earth",
    flavor:
      "The portals flicker. Transmission logs corrupt. Only a handful of Squigs remain to tell the tale.",
  },
];

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

function format(template, victimId, killerId) {
  // Victim is always eliminated ? crossed out.
  const victimMention = `~~<@${victimId}>~~`;
  const killerMention = killerId ? `<@${killerId}>` : "another Squig";

  return template
    .replace(/{victim}/g, victimMention)
    .replace(/{killer}/g, killerMention);
}

/**
 * Run the Squig Survival story.
 * @param {import('discord.js').TextChannel} channel
 * @param {string[]} playerIds - Array of user IDs
 * @param {string|null} eraLabel
 */
async function runSurvival(channel, playerIds, eraLabel, poolIncrement = 50) {
  if (!playerIds || playerIds.length === 0) return;

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
  const mergedStageImages = [...new Set([...RANDOM_STAGE_IMAGES, ...dbImageUrls])];
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
  let alive = [...uniquePlayers];
  const eliminated = [];
  let imageBag = shuffle(mergedStageImages);

  // One player = instant win embed
  if (alive.length === 1) {
    const payouts = calculateSurvivalPayouts(
      uniquePlayers,
      [alive[0]],
      poolIncrement
    );
    await sendSurvivalPayouts(
      channel,
      payouts,
      [alive[0]],
      uniquePlayers.length,
      poolIncrement
    );
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Squig Survival - Default Victory")
          .setDescription(
            `<@${alive[0]}> is the only Squig who dared the portal.\nThey survive by technicality... the portal is unimpressed.`
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
        text = format(pick(stories.hidingSpots), victimId);
      } else if (category === 1) {
        // Clumsiness
        text = format(pick(stories.clumsiness), victimId);
      } else {
        // Sabotage - needs a killer if possible
        if (alive.length === 0) {
          text = format(pick(stories.clumsiness), victimId);
        } else {
          const killerId = alive[Math.floor(Math.random() * alive.length)];
          text = format(pick(stories.sabotage), victimId, killerId);
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
      stories.resurrections &&
      stories.resurrections.length > 0 &&
      Math.random() < 0.18 // ~18% chance per milestone
    ) {
      const revivedIndex = Math.floor(Math.random() * eliminated.length);
      const revivedId = eliminated.splice(revivedIndex, 1)[0];
      alive.push(revivedId);

      const resurrectionTemplate = pick(stories.resurrections);
      // Revived Squig should appear normally (no strikethrough)
      const resurrectionText = resurrectionTemplate.replace(
        /{victim}/g,
        `<@${revivedId}>`
      );

      // ✨ Revival line (emphasized)
      lines.push("🌟 **RESURRECTION!**");
      lines.push(`✨ **${resurrectionText}**`);
    }

    // --- LORE-ONLY LINES ---
    const loreCount = randInt(2, 3);
    for (let i = 0; i < loreCount; i++) {
      const who = pick(uniquePlayers);
      const lore = pick(LORE_LINES).replace(/{player}/g, `<@${who}>`);
      const insertAt = randInt(0, lines.length);
      lines.splice(insertAt, 0, lore);
    }

    // Pick the stage for this milestone
    const stageIndex = Math.min(
      milestone - 1,
      MILESTONE_STAGES.length - 1
    );
    const stage = MILESTONE_STAGES[stageIndex];

    const embed = new EmbedBuilder()
      .setTitle(`Squig Life - ${stage.title}`)
      .setColor(0x9b59b6);

    let imageUrl = null;
    if (milestone === 1) {
      imageUrl = LOCKED_FIRST_IMAGE;
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
    return `${prefix} - <@${id}>`;
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
    poolIncrement
  );
  await sendSurvivalPayouts(
    channel,
    payouts,
    placements,
    uniquePlayers.length,
    poolIncrement
  );
}

function calculateSurvivalPayouts(playerIds, placements, poolIncrement = 50) {
  const uniquePlayers = Array.from(new Set(playerIds || []));
  const prizePool = poolIncrement * uniquePlayers.length;

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
  poolIncrement = 50
) {
  try {
    const entries = Object.entries(payouts || {});
    if (!entries.length) return;

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
            reason: `Squig Survival ${rankLabel} (pool ${poolIncrement * totalPlayers})`,
          });
        }
      })
    );
  } catch (err) {
    console.error("[GAUNTLET:DRIP] Survival payouts failed:", err?.message || err);
  }
}

module.exports = { runSurvival, calculateSurvivalPayouts, buildPodiumImage };


