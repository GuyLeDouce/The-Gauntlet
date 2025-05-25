const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { trialNames, eliminationEvents, specialEliminations, revivalEvents, reviveFailLines } = require('./gauntletData');

// Placeholder for state variables which will be passed from the main index.js
let client, channel, gauntletEntrants, remaining, eliminatedPlayers, roundImmunity, activeBoons, activeCurses, mutationDefenseClicks, fateRolls, tauntTargets, dodgeAttempts, hideAttempts;

// === Initialization Function ===
function initLogic(dependencies) {
  client = dependencies.client;
  channel = dependencies.channel;
  gauntletEntrants = dependencies.gauntletEntrants;
  remaining = dependencies.remaining;
  eliminatedPlayers = dependencies.eliminatedPlayers;
  roundImmunity = dependencies.roundImmunity;
  activeBoons = dependencies.activeBoons;
  activeCurses = dependencies.activeCurses;
  mutationDefenseClicks = dependencies.mutationDefenseClicks;
  fateRolls = dependencies.fateRolls;
  tauntTargets = dependencies.tauntTargets;
  dodgeAttempts = dependencies.dodgeAttempts;
  hideAttempts = dependencies.hideAttempts;
}
// === Mass Resurrection Totem Event ===
async function massRevivalEvent(channel) {
  const resurrectionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('resurrection_click')
      .setLabel('💀 Touch the Totem')
      .setStyle(ButtonStyle.Danger)
  );

  const prompt = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('☠️ The Totem of Lost Souls Appears...')
        .setDescription(
          'A twisted totem hums with malformed energy. Click below for a **chance** at resurrection.\n\n' +
          'Eliminated players: 60%\nNew players: 40%\n\n' +
          'You have **7 seconds**. Touch it... or stay forgotten.'
        )
        .setColor(0x910000)
    ],
    components: [resurrectionRow]
  });

  const collector = prompt.createMessageComponentCollector({ time: 7000 });
  const braveFools = new Set();

  collector.on('collect', async i => {
    if (remaining.find(p => p.id === i.user.id)) {
      return i.reply({ content: '🧟 You’re already alive. Back off the totem.', ephemeral: true });
    }
    braveFools.add(i.user.id);
    i.reply({ content: '💫 The totem accepts your touch...', ephemeral: true });
  });

  collector.on('end', async () => {
    await prompt.edit({ components: [] });

    if (braveFools.size === 0) {
      await channel.send('🪦 No souls were bold enough to risk the totem.');
      return;
    }

    const names = [...braveFools].map(id => `<@${id}>`).join('\n');
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏳ The Totem Judged Them...')
          .setDescription(`These brave fools reached for resurrection:\n\n${names}\n\nBut the Totem shows no mercy...`)
          .setColor(0xffcc00)
      ]
    });

    for (const count of ['3', '2', '1']) {
      await channel.send(`🕒 ${count}...`);
      await new Promise(r => setTimeout(r, 1000));
    }

    const revivedLines = [];
    const failedLines = [];

    for (const id of braveFools) {
      const wasEliminated = eliminatedPlayers.find(p => p.id === id);
      const odds = wasEliminated ? 0.6 : 0.4;
      const passed = Math.random() < odds;

      if (passed) {
        if (wasEliminated) {
          remaining.push(wasEliminated);
          eliminatedPlayers = eliminatedPlayers.filter(p => p.id !== id);
          revivedLines.push(`💀 <@${id}> **rose again from the ashes**.`);
        } else {
          const user = await client.users.fetch(id);
          const newPlayer = { id, username: user.username };
          remaining.push(newPlayer);
          gauntletEntrants.push(newPlayer);
          revivedLines.push(`🆕 <@${id}> **was pulled into The Gauntlet by the Totem’s will**.`);
        }
      } else {
        const failLine = wasEliminated
          ? `☠️ <@${id}> reached for life... and was denied.`
          : `🚫 <@${id}> was rejected — a new soul not worthy... yet.`;
        failedLines.push(failLine);
      }
    }

    if (revivedLines.length > 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('💥 The Totem Showed Mercy')
            .setDescription(revivedLines.join('\n'))
            .setColor(0x00cc66)
        ]
      });
    }

    if (failedLines.length > 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('💨 The Totem Ignored Their Pleas')
            .setDescription(failedLines.join('\n'))
            .setColor(0xbb0000)
        ]
      });
    }
  });
}
// === DRIP $CHARM Reward Sender ===
async function sendCharmToUser(discordUserId, amount, channel = null) {
  const DRIP_API_TOKEN = process.env.DRIP_API_TOKEN;
  const DRIP_ACCOUNT_ID = process.env.DRIP_ACCOUNT_ID;
  const CURRENCY_ID = process.env.CURRENCY_ID;

  const headers = {
    Authorization: `Bearer ${DRIP_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const data = {
    recipient: {
      id: discordUserId,
      id_type: "discord_id"
    },
    amount: amount,
    reason: "Victory in The Gauntlet",
    currency_id: CURRENCY_ID,
    account_id: DRIP_ACCOUNT_ID
  };

  try {
    await axios.post(`https://api.drip.re/v2/send`, data, { headers });
    console.log(`✅ Sent ${amount} $CHARM to ${discordUserId}`);
    if (channel) {
      await channel.send(`🪙 <@${discordUserId}> received **${amount} $CHARM** from the Malformed Vault.`);
    }
  } catch (error) {
    console.error(`❌ Failed to send $CHARM to ${discordUserId}`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    if (channel) {
      await channel.send(`⚠️ <@${discordUserId}> was supposed to get **${amount} $CHARM**, but something went wrong. Please contact support.`);
    }
  }
}
// === Export Functions ===
module.exports = {
  startGauntlet,
  runGauntlet,
  massRevivalEvent,
  triggerRematchPrompt,
  sendCharmToUser
};
