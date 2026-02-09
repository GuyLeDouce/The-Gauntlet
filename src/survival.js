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
const MILESTONE_STAGES = [
  {
    title: "Landing Day 1 - First Impact",
    flavor:
      "Fresh from the portal, the Squigs splatter into Earth's atmosphere like confused cosmic confetti.",
    image: "https://i.imgur.com/jfVffAW.jpeg",
  },
  {
    title: "Month 1 on Earth - First Confusion",
    flavor:
      "The Squigs are still learning gravity, weather, and why humans keep putting pineapple on pizza.",
    image: "https://i.imgur.com/jYNKD3d.jpeg",
  },
  {
    title: "Month 2 on Earth - Bad Influences",
    flavor:
      "They discover social media, NFTs, and the horrifying power of quote-tweets.",
    image: "https://i.imgur.com/8hJ6XEE.jpeg",
  },
  {
    title: "Month 3 on Earth - Questionable Hobbies",
    flavor:
      "Some Squigs start side hustles. Others become professional lurkers. All of them are still extremely weird.",
    image: "https://i.imgur.com/yBmAjMh.jpeg",
  },
  {
    title: "Month 4 on Earth - Full Degeneracy",
    flavor:
      "Sleep schedules are gone. Caffeine is up. Decisions are... not always good ones.",
    image: "https://i.imgur.com/fiNkaTa.jpeg",
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

const FALLBACK_STAGE_IMAGES = [
  "https://i.imgur.com/jYNKD3d.jpeg",
  "https://i.imgur.com/8hJ6XEE.jpeg",
  "https://i.imgur.com/yBmAjMh.jpeg",
  "https://i.imgur.com/fiNkaTa.jpeg",
];

const PODIUM_RINGS = [
  { color: "#d4af37", label: "1st" }, // gold
  { color: "#c0c0c0", label: "2nd" }, // silver
  { color: "#cd7f32", label: "3rd" }, // bronze
];

async function buildPodiumImage(client, placements) {
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

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1b1f2a");
    bg.addColorStop(1, "#0f1117");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle stars
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.6;
      const r = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground
    ctx.fillStyle = "#141821";
    ctx.fillRect(0, height - 120, width, 120);

    // Podium blocks
    const podiumY = height - 120;
    const blockW = 200;
    const blockGap = 30;
    const centerX = width / 2;

    const blocks = [
      { x: centerX - blockW / 2, y: podiumY - 180, h: 180 }, // 1st
      { x: centerX - blockW - blockGap - blockW / 2, y: podiumY - 130, h: 130 }, // 2nd
      { x: centerX + blockGap + blockW / 2, y: podiumY - 110, h: 110 }, // 3rd
    ];

    const blockColors = ["#2a313f", "#222835", "#1f2430"];
    blocks.forEach((b, i) => {
      ctx.fillStyle = blockColors[i];
      ctx.fillRect(b.x, b.y, blockW, b.h);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, blockW, b.h);
    });

    // Draw avatars
    const avatarSize = 120;
    const avatarCenters = [
      { x: centerX, y: podiumY - 180 - 20 },
      { x: centerX - blockW - blockGap, y: podiumY - 130 - 10 },
      { x: centerX + blockW + blockGap, y: podiumY - 110 - 10 },
    ];

    for (let i = 0; i < 3; i++) {
      const userId = topThree[i];
      if (!userId) continue;
      let avatarUrl;
      try {
        const user = await client.users.fetch(userId);
        avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
      } catch {
        avatarUrl = null;
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
async function runSurvival(channel, playerIds, eraLabel) {
  if (!playerIds || playerIds.length === 0) return;

  const uniquePlayers = Array.from(new Set(playerIds));
  let alive = [...uniquePlayers];
  const eliminated = [];

  // One player = instant win embed
  if (alive.length === 1) {
    const payouts = calculateSurvivalPayouts(uniquePlayers, [alive[0]]);
    await sendSurvivalPayouts(channel, payouts, [alive[0]], uniquePlayers.length);
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
      stage.image ||
      (milestone >= 5
        ? FALLBACK_STAGE_IMAGES[
            (milestone - 5) % FALLBACK_STAGE_IMAGES.length
          ]
        : null);
    if (imageUrl) embed.setImage(imageUrl);

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

  const podiumBuffer = await buildPodiumImage(channel.client, placements);
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

  const payouts = calculateSurvivalPayouts(uniquePlayers, placements);
  await sendSurvivalPayouts(channel, payouts, placements, uniquePlayers.length);
}

function calculateSurvivalPayouts(playerIds, placements) {
  const uniquePlayers = Array.from(new Set(playerIds || []));
  const prizePool = 50 * uniquePlayers.length;

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

async function sendSurvivalPayouts(channel, payouts, placements, totalPlayers) {
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
            reason: `Squig Survival ${rankLabel} (pool ${50 * totalPlayers})`,
          });
        }
      })
    );
  } catch (err) {
    console.error("[GAUNTLET:DRIP] Survival payouts failed:", err?.message || err);
  }
}

module.exports = { runSurvival, calculateSurvivalPayouts };


