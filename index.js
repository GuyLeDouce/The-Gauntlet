require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let gauntletEntrants = [];
let gauntletActive = false;
let joinTimeout = null;
let gauntletChannel = null;
let gauntletMessage = null;
let activeBoons = {};
let activeCurses = {};
let roundImmunity = {};
let fateRolls = {};
let mutationDefenseClicks = new Set();
let eliminatedPlayers = [];
let remaining = [];
let rematchClicks = 0;
let rematchLimitResetTime = Date.now();
let rematchesThisHour = 0;
let lastGameEntrantCount = 0;
let currentDelay = 0;

const trialNames = [ /* your list of trials */ ];
const eliminationEvents = [ /* your elimination lines */ ];
const specialEliminations = [ /* your special elim lines */ ];
const revivalEvents = [ /* your revival lines */ ];

const playerCommands = {};
const tauntTargets = {};
const dodgeAttempts = {};
const hideAttempts = {};
async function startGauntlet(channel, delay) {
  if (gauntletActive) return;

  gauntletEntrants = [];
  gauntletActive = true;
  eliminatedPlayers = [];
  gauntletChannel = channel;
  currentDelay = delay;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Ugly Gauntlet')
      .setStyle(ButtonStyle.Primary)
  );

  gauntletMessage = await channel.send({
    embeds: [{
      title: '🏁 The Ugly Gauntlet Has Begun!',
      description: `Click to enter. You have ${delay} minutes.\n🧟 Entrants so far: 0`,
      color: 0x6e40c9
    }],
    components: [joinButton]
  });

  const totalMs = delay * 60 * 1000;
  joinTimeout = setTimeout(() => {
    if (gauntletEntrants.length < 1) {
      channel.send('Not enough entrants joined. Try again later.');
      gauntletActive = false;
    } else {
      runGauntlet(channel);
    }
  }, totalMs);

  const intervalMs = totalMs / 3;

  setTimeout(() => {
    channel.send(`⏳ One third of the time has passed. **${Math.round((delay * 2) / 3)} minutes left** to join the Gauntlet...`);
  }, intervalMs);

  setTimeout(() => {
    channel.send(`⚠️ Two thirds of the countdown are gone. Only **${Math.round(delay / 3)} minutes** remain to join!`);
  }, intervalMs * 2);

  setTimeout(() => {
    channel.send(`🕰️ Final moment! The Gauntlet will begin **any second now...**`);
  }, intervalMs * 3 - 5000);
}
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();
  const userId = message.author.id;

  if (content === '!gauntlet') return startGauntlet(message.channel, 10);
  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }

  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
    return;
  }

  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
    gauntletActive = true;
    eliminatedPlayers = [];
    gauntletChannel = message.channel;
    await message.channel.send('🧪 Trial Mode Activated — 20 mock players have entered. Starting...');
    return runGauntlet(message.channel);
  }

  if (content === '!testreward') {
    const allowedUsers = ['your_discord_id_here']; // Replace with your actual Discord ID
    if (!allowedUsers.includes(userId)) {
      return message.reply("⛔ You are not authorized to use this test command.");
    }
    await sendCharmToUser(userId, 5, message.channel);
    return;
  }

  // ✅ Revive Command
  if (content === '!revive') {
    const isAlive = remaining.find(p => p.id === userId);
    if (isAlive) return message.channel.send(`🧟 <@${userId}> You're already among the living.`);

    const wasEliminated = eliminatedPlayers.find(p => p.id === userId);
    if (!wasEliminated) return message.channel.send(`👻 <@${userId}> You haven’t been eliminated yet.`);

    if (wasEliminated.attemptedRevive) {
      return message.channel.send(`🔁 <@${userId}> already tried to cheat death. Fate isn’t amused.`);
    }

    wasEliminated.attemptedRevive = true;

    if (Math.random() < 0.02) {
      remaining.push(wasEliminated);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      return message.channel.send(`💫 <@${userId}> defied all odds!\n${reviveMsg}`);
    } else {
      const failMsg = [
        "🪦 You wiggle in the dirt… but you're still dead.",
        "👁 The malformed forces laugh and turn away.",
        "☠️ You reached out… and got ghosted."
      ][Math.floor(Math.random() * 3)];
      return message.channel.send(`${failMsg} <@${userId}> remains dead.`);
    }
  }

  if (playerCommands[userId]) return;

  if (content === '!dodge') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      dodgeAttempts[userId] = true;
      message.reply("🌀 You prepare to dodge fate...");
    } else {
      message.reply("😬 You braced... but nothing happened.");
    }
  }

  if (content === '!taunt') {
    playerCommands[userId] = true;
    const alive = gauntletEntrants.filter(p => p.id !== userId);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      tauntTargets[target.id] = true;
      message.reply(`🔥 You mocked your enemies... **<@${target.id}>** is marked!`);
    }
  }

  if (content === '!hide') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      hideAttempts[userId] = true;
      message.reply("👻 You vanish into the shadows...");
    } else {
      message.reply("😶 You tried to hide, but the shadows rejected you.");
    }
  }
});
async function runGauntlet(channel) {
  gauntletActive = false;
  remaining = [...gauntletEntrants];
  let roundCounter = 1;
  activeBoons = {};
  activeCurses = {};
  roundImmunity = {};
  fateRolls = {};
  mutationDefenseClicks = new Set();

  const boss = remaining[Math.floor(Math.random() * remaining.length)];
  await channel.send(`👹 A foul stench rises... <@${boss.id}> has been chosen as the **UGLY BOSS**! If they make it to the podium, they earn **double $CHARM**...`);

  while (remaining.length > 3) {
    const eliminations = Math.min(2, remaining.length - 3);
    const eliminated = [];
    roundImmunity = {};
    activeBoons = {};
    activeCurses = {};
    mutationDefenseClicks = new Set();

    let cursedPlayerId = null;
    if (Math.random() < 0.4 && remaining.length >= 3) {
      const pollPlayers = remaining.slice(0, 3);
      const playerList = pollPlayers.map(p => `- <@${p.id}>`).join('\n');

      await channel.send({
        embeds: [{
          title: '👁️ Audience Vote Incoming...',
          description: `The malformed crowd stirs...\n\nThe following players are up for a curse:\n\n${playerList}`,
          color: 0xff6666
        }]
      });

      // ✅ Fixed Countdown Messaging (1 minute)
      await channel.send(`🗣️ Discuss who you want to vote out… you have **1 minute**!`);
      await new Promise(r => setTimeout(r, 20000));
      await channel.send(`⏳ 40 seconds remaining...`);
      await new Promise(r => setTimeout(r, 20000));
      await channel.send(`⚠️ Final 20 seconds to plot your curse!`);
      await new Promise(r => setTimeout(r, 20000));

      const voteRow = new ActionRowBuilder().addComponents(
        ...pollPlayers.map((p) =>
          new ButtonBuilder()
            .setCustomId(`vote_${p.id}`)
            .setLabel(`Curse ${p.username}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const voteMsg = await channel.send({
        embeds: [{
          title: '🗳️ Cast Your Curse',
          description: 'Click a button below to curse one of the nominated players.',
          color: 0x880808
        }],
        components: [voteRow]
      });

      const voteCounts = {};
      const voteCollector = voteMsg.createMessageComponentCollector({ time: 15000 });

      voteCollector.on('collect', interaction => {
        if (!remaining.find(p => p.id === interaction.user.id)) {
          return interaction.reply({ content: '🛑 Only players still in the game can vote!', ephemeral: true });
        }

        const targetId = interaction.customId.split('_')[1];
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        interaction.reply({ content: 'Vote registered!', ephemeral: true });
      });

      await new Promise(r => setTimeout(r, 15000));

      const maxVotes = Math.max(...Object.values(voteCounts));
      const cursedIds = Object.entries(voteCounts)
        .filter(([_, count]) => count === maxVotes)
        .map(([id]) => id);
      cursedPlayerId = cursedIds[Math.floor(Math.random() * cursedIds.length)];

      await channel.send(`😨 The audience cursed <@${cursedPlayerId}>!`);
    }

    // ⚔️ Elimination logic follows...
    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    let eliminationDescriptions = [];

    for (let i = 0; i < eliminations; i++) {
      let player = null;

      if (i === 0 && cursedPlayerId) {
        const cursed = remaining.find(p => p.id === cursedPlayerId);
        if (cursed) {
          player = cursed;
          remaining = remaining.filter(p => p.id !== cursedPlayerId);
        }
      }

      if (!player) {
        player = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      }

      if (roundImmunity[player.id]) {
        eliminationDescriptions.push(`🛡️ <@${player.id}> avoided elimination with quick reflexes!`);
        continue;
      }

      if (activeBoons[player.id]) {
        eliminationDescriptions.push(`✨ <@${player.id}> was protected by a boon and dodged elimination!`);
        continue;
      }

      if (activeCurses[player.id]) {
        eliminationDescriptions.push(`💀 <@${player.id}> succumbed to their curse!`);
      }

      if (player.id === boss.id && Math.random() < 0.5) {
        eliminationDescriptions.push(`🛑 <@${player.id}> is the Boss — and shrugged off the attack!`);
        remaining.push(player);
        continue;
      }

      eliminated.push(player);
      eliminatedPlayers.push(player);

      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      const style = Math.floor(Math.random() * 3);
      if (useSpecial) {
        if (style === 0) {
          eliminationDescriptions.push(`━━━━━━━━━━ 👁‍🗨 THE MALFORMED STRIKE 👁‍🗨 ━━━━━━━━━━\n❌ <@${player.id}> ${reason}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        } else if (style === 1) {
          eliminationDescriptions.push(`⚠️💀⚠️ SPECIAL FATE ⚠️💀⚠️\n❌ <@${player.id}> ${reason}\n🩸🧟‍♂️😈👁🔥👣🪦🧠👃`);
        } else {
          eliminationDescriptions.push(`**💥 Cursed Spotlight: <@${player.id}> 💥**\n_${reason}_`);
        }
      } else {
        eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);
      }
    }

    if (eliminated.length && Math.random() < 0.15) {
      const reviveIndex = Math.floor(Math.random() * eliminated.length);
      const revived = eliminated.splice(reviveIndex, 1)[0];
      if (revived) {
        remaining.push(revived);
        const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
        eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
      }
    }

    const tokenId = Math.floor(Math.random() * 530) + 1;
    const nftImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}.jpg`;

    await channel.send({
      embeds: [{
        title: `⚔️ Round ${roundCounter} — ${trial}`,
        description: eliminationDescriptions.join('\n'),
        color: 0x8b0000,
        image: { url: nftImage }
      }]
    });

    roundCounter++;
    await new Promise(r => setTimeout(r, 10000));
  }

  const [first, second, third] = remaining;
  let firstReward = 50;
  let secondReward = 25;
  let thirdReward = 10;

  if (first.id === boss.id) firstReward *= 2;
  if (second.id === boss.id) secondReward *= 2;
  if (third.id === boss.id) thirdReward *= 2;

  await sendCharmToUser(first.id, firstReward, channel);
  await sendCharmToUser(second.id, secondReward, channel);
  await sendCharmToUser(third.id, thirdReward, channel);

  if ([first.id, second.id, third.id].includes(boss.id)) {
    await channel.send(`👑 The **Ugly Boss** <@${boss.id}> survived to the end. Their reward is **doubled**!`);
  }

  await channel.send({
    embeds: [{
      title: '🏆 Champions of the Ugly Gauntlet!',
      description: [
        `**1st Place:** <@${first.id}> — **${firstReward} $CHARM**`,
        `**2nd Place:** <@${second.id}> — **${secondReward} $CHARM**`,
        `**3rd Place:** <@${third.id}> — **${thirdReward} $CHARM**`,
        ``,
        `The Gauntlet has spoken. Well fought, Champions!`
      ].join('\n'),
      color: 0xdaa520
    }]
  });

  // 🔁 Rematch Prompt (with 1-minute fix)
  lastGameEntrantCount = gauntletEntrants.length;

  if (Date.now() - rematchLimitResetTime > 60 * 60 * 1000) {
    rematchesThisHour = 0;
    rematchLimitResetTime = Date.now();
  }

  if (rematchesThisHour >= 3) {
    await channel.send(`🚫 Max of 3 rematches reached for this hour. The Gauntlet rests... for now.`);
    return;
  }

  rematchClicks = 0;
  const neededClicks = lastGameEntrantCount + 1;

  const rematchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_gauntlet')
      .setLabel(`🔁 Rematch? (${neededClicks} clicks required)`)
      .setStyle(ButtonStyle.Primary)
  );

  const rematchMsg = await channel.send({
    content: `The blood is still warm... **${neededClicks} souls** must choose to rematch or the ritual ends.`,
    components: [rematchRow]
  });

  await channel.send(`🕐 You have **1 minute** to vote for a rematch...`);

  const rematchCollector = rematchMsg.createMessageComponentCollector({ time: 60000 });
  const rematchVoters = new Set();

  rematchCollector.on('collect', async (interaction) => {
    if (rematchVoters.has(interaction.user.id)) {
      await interaction.reply({ content: '⛔ You’ve already voted for a rematch.', ephemeral: true });
      return;
    }

    rematchVoters.add(interaction.user.id);
    rematchClicks++;

    await interaction.reply({ content: '🩸 Your vote for the rematch is cast...', ephemeral: true });

    if (rematchClicks >= neededClicks) {
      rematchesThisHour++;
      await channel.send(`🔁 The Gauntlet begins again — summoned by ${rematchClicks} brave (or foolish) souls!`);
      setTimeout(() => startGauntlet(channel, 3), 2000);
      rematchCollector.stop();
    }
  });

  rematchCollector.on('end', async () => {
    if (rematchClicks < neededClicks) {
      await channel.send(`☠️ Not enough votes for a rematch. The Gauntlet sleeps... for now.`);
    }
  });
}
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
