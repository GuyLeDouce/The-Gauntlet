// survival.js
// Core RNG story engine for Squig Survival.

const { EmbedBuilder } = require("discord.js");
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
    title: "Landing Day 1 – First Impact",
    flavor:
      "Fresh from the portal, the Squigs splatter into Earth's atmosphere like confused cosmic confetti.",
  },
  {
    title: "Month 1 on Earth – First Confusion",
    flavor:
      "The Squigs are still learning gravity, weather, and why humans keep putting pineapple on pizza.",
  },
  {
    title: "Month 2 on Earth – Bad Influences",
    flavor:
      "They discover social media, NFTs, and the horrifying power of quote-tweets.",
  },
  {
    title: "Month 3 on Earth – Questionable Hobbies",
    flavor:
      "Some Squigs start side hustles. Others become professional lurkers. All of them are still extremely weird.",
  },
  {
    title: "Month 4 on Earth – Full Degeneracy",
    flavor:
      "Sleep schedules are gone. Caffeine is up. Decisions are… not always good ones.",
  },
  {
    title: "Month 5 on Earth – The Great Overthink",
    flavor:
      "The Squigs begin to wonder if humans actually know what they’re doing. Signs point to ‘no’.",
  },
  {
    title: "Month 6 on Earth – Vanishing Acts",
    flavor:
      "One by one, Squigs disappear into strange side quests, mysterious DMs, and badly-timed adventures.",
  },
  {
    title: "Last Known Squig Presence on Earth",
    flavor:
      "The portals flicker. Transmission logs corrupt. Only a handful of Squigs remain to tell the tale.",
  },
];

function format(template, victimId, killerId) {
  // Victim is always eliminated → crossed out.
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
    await sendSurvivalPayouts(channel, payouts);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Squig Survival – Default Victory")
          .setDescription(
            `<@${alive[0]}> is the only Squig who dared the portal.\nThey survive by technicality… the portal is unimpressed.`
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
        // Sabotage – needs a killer if possible
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
      .setTitle(`Squig Life – ${stage.title}`)
      .setColor(0x9b59b6);

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
        text: `${eraLabel} • ${remainingText}`,
      });
    } else {
      embed.setFooter({
        text: remainingText,
      });
    }

    await channel.send({ embeds: [embed] });
    milestone += 1;

    // Short breather between milestones
    await sleep(6000);
  }

  // Winner + standings
  const winnerId = alive[0];
  const placements = [winnerId, ...eliminated.reverse()];

  const lbLines = placements.map((id, index) => {
    const rank = index + 1;
    let prefix;
    if (rank === 1) prefix = "👑 1st";
    else if (rank === 2) prefix = "🥈 2nd";
    else if (rank === 3) prefix = "🥉 3rd";
    else prefix = `${rank}.`;
    return `${prefix} — <@${id}>`;
  });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("Squig Survival – Final Standings")
        .setDescription(lbLines.join("\n"))
        .setColor(0xf1c40f)
        .setFooter({ text: "Only one Squig ever really makes it…" }),
    ],
  });

  const payouts = calculateSurvivalPayouts(uniquePlayers, placements);
  await sendSurvivalPayouts(channel, payouts);
}

function calculateSurvivalPayouts(playerIds, placements) {
  const uniquePlayers = Array.from(new Set(playerIds || []));
  const prizePool = 25 * uniquePlayers.length;

  const uniquePlacements = [];
  for (const id of placements || []) {
    if (!uniquePlacements.includes(id)) uniquePlacements.push(id);
    if (uniquePlacements.length >= 3) break;
  }

  const shares = [0.5, 0.3, 0.2];
  const payouts = {};
  let allocated = 0;

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

  return payouts;
}

async function sendSurvivalPayouts(channel, payouts) {
  try {
    const entries = Object.entries(payouts || {});
    if (!entries.length) return;

    await Promise.all(
      entries.map(async ([userId, amount]) => {
        if (!amount || amount <= 0) return;
        const reward = await rewardCharmAmount({
          userId,
          username: `Player-${userId}`,
          amount,
          source: "survival",
          guildId: channel.guildId,
          channelId: channel.id,
          metadata: { mode: "survival" },
        });
        if (reward?.ok) {
          await logCharmReward(channel.client, {
            userId,
            amount,
            score: 0,
            source: "survival",
          });
        }
      })
    );
  } catch (err) {
    console.error("[GAUNTLET:DRIP] Survival payouts failed:", err?.message || err);
  }
}

module.exports = { runSurvival, calculateSurvivalPayouts };

