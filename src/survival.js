// survival.js
// Core RNG story engine for Squig Survival.

const { EmbedBuilder } = require("discord.js");
const stories = require("./survivalStories");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function format(template, victimId, killerId) {
  return template
    .replace(/{victim}/g, `<@${victimId}>`)
    .replace(/{killer}/g, killerId ? `<@${killerId}>` : "another Squig");
}

/**
 * Run the Squig Survival story.
 * @param {import('discord.js').TextChannel} channel
 * @param {string[]} playerIds - Array of user IDs
 * @param {string|null} eraLabel
 */
async function runSurvival(channel, playerIds, eraLabel) {
  if (!playerIds || playerIds.length === 0) return;

  let alive = [...playerIds];
  const eliminated = [];

  // One player = instant win embed
  if (alive.length === 1) {
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

      lines.push(`• ${text}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Milestone ${milestone}: Life on Earth`)
      .setDescription(lines.join("\n"))
      .setColor(0x9b59b6);

    if (eraLabel) {
      embed.setFooter({ text: eraLabel });
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
}

module.exports = { runSurvival };

