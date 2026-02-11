// survival.js
// Core RNG story engine for Squig Survival.

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { rewardCharmAmount, logCharmReward } = require("./drip");
const stories = require("./survivalStories");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
];
const RANDOM_STAGE_IMAGES = [...new Set(FALLBACK_STAGE_IMAGES)];
const SURVIVAL_ART_REWARDS = {
  "https://i.imgur.com/Tlf4elV.jpeg": {
    userId: "836389642885398530",
    amount: 10,
    reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
  },
  "https://i.imgur.com/K1BMD1e.jpeg": {
    userId: "836389642885398530",
    amount: 10,
    reason: "Squig Survival art bonus (image used) — thanks for your creativity!",
  },
};

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

  const uniquePlayers = Array.from(new Set(playerIds));
  let alive = [...uniquePlayers];
  const eliminated = [];

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
      Math.random() < 0.1 // 10% chance per milestone
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

      // ✨ Revival line
      lines.push(`✨ ${resurrectionText}`);
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

    const imageUrl =
      milestone === 1
        ? LOCKED_FIRST_IMAGE
        : RANDOM_STAGE_IMAGES.length
          ? pick(RANDOM_STAGE_IMAGES)
          : null;
    if (imageUrl) embed.setImage(imageUrl);
    const artReward = imageUrl ? SURVIVAL_ART_REWARDS[imageUrl] : null;
    if (artReward) {
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

    const descriptionParts = [];

    if (stage.flavor) {
      descriptionParts.push(`_${stage.flavor}_\n`);
    }

    if (lines.length > 0) {
      descriptionParts.push(lines.join("\n"));
    }

    embed.setDescription(descriptionParts.join("\n"));

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

    await channel.send({ embeds: [embed] });
    milestone += 1;

    // Short breather between milestones
    await sleep(8000);
  }

  // Winner + standings
  const winnerId = alive[0];
  const placements = [winnerId, ...eliminated.reverse()];

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


