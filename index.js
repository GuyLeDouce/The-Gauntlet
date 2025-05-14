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

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// DRIP send function
async function sendCharmToUser(discordUserId, amount, channel = null) {
  const DRIP_API_TOKEN = process.env.DRIP_API_TOKEN;
  const DRIP_ACCOUNT_ID = '676d81ee502cd15c9c983d81'; // your account ID
  const CURRENCY_ID = '1047256251320520705'; // $CHARM currency ID

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
    const response = await axios.post(`https://api.drip.re/v2/send`, data, { headers });

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
      await channel.send(`⚠️ Could not send $CHARM to <@${discordUserId}>. Please contact the team.`);
    }
  }
}

// === Gauntlet game state ===
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

const trialNames = [
  "Trial of the Screaming Mire", "The Eldritch Scramble", "Trial of the Shattered Bones",
  "The Maw's Hunger", "Dance of the Ugly Reflection", "Trial of the Crooked Path",
  "Storm of the Severed Sky", "Gauntlet of Broken Dreams", "The Echoing Crawl",
  "The Wretched Spiral"
];

const eliminationEvents = [
  "was dragged into the swamp by unseen claws.",
  "tried to pet a malformed dog. It bit back... with ten mouths.",
  "got yeeted off the platform by a sentient fart cloud.",
  "exploded after lighting a fart too close to a rune circle.",
  "was judged too handsome and instantly vaporized.",
  "spoke in rhymes one too many times.",
  "was too ugly. Even for the Malformed.",
  "turned into a rubber duck and floated away.",
  "got tangled in the Lore Scrolls and suffocated.",
  "joined the wrong Discord and disappeared forever.",
  "ate the wrong mushroom and became sentient wallpaper.",
  "laughed at the wrong joke and got obliterated by cringe.",
  "tripped over an imaginary rock and fell into the void.",
  "summoned their own shadow. It won the duel.",
  "took a selfie during the ritual. The flash was fatal.",
  "got banned by the council of malformed ethics.",
  "forgot the safe word during a summoning.",
  "got memed into another dimension.",
  "mislabeled an artifact as ‘mid’. The artifact retaliated."
];

const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "rolled a 1 and summoned their ex instead.",
  "flexed too hard and imploded with style.",
  "said ‘GM’ too late and was banished to Shadow Realm.",
  "was cursed by a malformed meme and vaporized in shame.",
  "drew a red card. From a black deck. Gone.",
  "used Comic Sans in a summoning circle.",
  "forgot to use dark mode and burned alive.",
  "glitched into another chain. Nobody followed.",
  "was outed as an undercover Handsome and disqualified."
];

const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "refused to die and bribed fate with $CHARM.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "glitched through the floor, then glitched back.",
  "slapped a demon and respawned out of spite.",
  "screamed so loud the timeline flinched.",
  "burned their death certificate in a candle made of shame.",
  "found a continue screen hidden in the clouds.",
  "got revived by a lonely necromancer for company.",
  "played a revival song on a bone flute they found in their ribcage."
];

const playerCommands = {};
const tauntTargets = {};
const dodgeAttempts = {};
const hideAttempts = {};
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    if (!gauntletEntrants.find(e => e.id === interaction.user.id)) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });
      await interaction.reply({ content: 'You have joined the Ugly Gauntlet! Prepare yourself…', flags: 64 });

      if (gauntletMessage && gauntletMessage.editable) {
  const embed = EmbedBuilder.from(gauntletMessage.embeds[0])
    .setDescription(`Click to enter. You have ${delay} minutes.\n🧟 Entrants so far: ${gauntletEntrants.length}`);
  await gauntletMessage.edit({ embeds: [embed] });
}
    } else {
      await interaction.reply({ content: 'You have already joined this round!', flags: 64 });
    }
  }
});

async function startGauntlet(channel, delay) {
  if (gauntletActive) return;
  gauntletEntrants = [];
  gauntletActive = true;
  eliminatedPlayers = [];
  gauntletChannel = channel;

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
    const allowedUsers = ['your_discord_id_here']; // Replace this with your actual Discord ID
    if (!allowedUsers.includes(userId)) {
      return message.reply("⛔ You are not authorized to use this test command.");
    }
    await sendCharmToUser(userId, 5);
    await message.channel.send(`🧪 Sent 5 $CHARM to <@${userId}>`);
    return;
  }

  if (!gauntletActive) return;

  if (content === '!revive') {
    const alreadyAlive = remaining.find(p => p.id === userId);
    if (alreadyAlive) return message.channel.send(`🧟 <@${userId}> You're already among the living.`);

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

    // ✋ Survival Button
    if (Math.random() < 0.1) {
      const survivalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('survival_click').setLabel('Grab the Rope!').setStyle(ButtonStyle.Danger)
      );
      const survivalMsg = await channel.send({
        content: '⏳ A trap is triggered! First 3 to click are protected...',
        components: [survivalRow]
      });

      const survivalCollector = survivalMsg.createMessageComponentCollector({ time: 10000 });
      let saved = 0;
      survivalCollector.on('collect', i => {
        if (saved < 3 && remaining.find(p => p.id === i.user.id)) {
          roundImmunity[i.user.id] = true;
          saved++;
          i.reply({ content: '🪢 You are protected!', ephemeral: true });
        } else {
          i.reply({ content: '⛔ You were too late.', ephemeral: true });
        }
      });
    }

    // 🛡️ Reaction Trap
    if (Math.random() < 0.1) {
      const trapMsg = await channel.send('🪨 A boulder is falling! React with 🛡️ in 10 seconds!');
      await trapMsg.react('🛡️');
      await new Promise(r => setTimeout(r, 10000));
      const trapReact = trapMsg.reactions.cache.get('🛡️');
      const reactors = trapReact ? await trapReact.users.fetch() : new Map();
      reactors.forEach(user => {
        if (!user.bot && remaining.find(p => p.id === user.id)) {
          roundImmunity[user.id] = true;
        }
      });
    }

    // 🧬 Mutation Defense
    if (Math.random() < 0.2) {
      mutationDefenseClicks = new Set();
      const mutateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('resist_mutation').setLabel('Resist Mutation').setStyle(ButtonStyle.Danger)
      );
      const mutateMsg = await channel.send({
        embeds: [{
          title: "🧬 Mutation Threat Detected!",
          description: "Click below to resist mutation. If 3 or more resist, it is suppressed.",
          color: 0xff4500
        }],
        components: [mutateRow]
      });

      const mutateCollector = mutateMsg.createMessageComponentCollector({ time: 15000 });
      mutateCollector.on('collect', interaction => {
        if (!remaining.find(p => p.id === interaction.user.id)) {
          return interaction.reply({ content: '🛑 Only players still in the game can resist mutation.', ephemeral: true });
        }

        mutationDefenseClicks.add(interaction.user.id);
        interaction.reply({ content: '🧬 Your resistance is noted...', ephemeral: true });
      });

      await new Promise(r => setTimeout(r, 15000));
      const mutationSuppressed = mutationDefenseClicks.size >= 3;
      await channel.send(mutationSuppressed
        ? '🧬 Enough resistance! The mutation has been suppressed.'
        : '💥 Not enough resistance. The mutation begins...');
    }

    // 🔮 Random Boons & Curses (15% chance)
    if (Math.random() < 0.15 && remaining.length > 2) {
      const shuffled = remaining.sort(() => 0.5 - Math.random());
      const affectedPlayers = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);
      const fateLines = [];

      for (const player of affectedPlayers) {
        const fate = Math.random();
        if (fate < 0.5) {
          activeCurses[player.id] = true;
          fateLines.push(`👿 <@${player.id}> has been **cursed** by the malformed forces.`);
        } else {
          activeBoons[player.id] = true;
          fateLines.push(`🕊️ <@${player.id}> has been **blessed** with a strange protection.`);
        }
      }

      await channel.send({
        embeds: [{
          title: "🔮 Twisted Fates Unfold...",
          description: fateLines.join('\\n'),
          color: 0x6a0dad
        }]
      });
    }
    // 🎲 Fate Button
    if (Math.random() < 0.1) {
      const fateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('roll_fate').setLabel('🎲 Tempt Fate').setStyle(ButtonStyle.Primary)
      );
      const fateMsg = await channel.send({
        content: '🎲 Do you dare tempt the malformed fate?',
        components: [fateRow]
      });

      const fateCollector = fateMsg.createMessageComponentCollector({ time: 15000 });
      fateCollector.on('collect', i => {
        if (!remaining.find(p => p.id === i.user.id)) {
          return i.reply({ content: '🛑 Only players still in the game can roll for fate.', ephemeral: true });
        }

        if (fateRolls[i.user.id]) {
          return i.reply({ content: '🛑 You already rolled this game.', ephemeral: true });
        }

        const rng = Math.random();
        let result = '';
        if (rng < 0.33) {
          roundImmunity[i.user.id] = true;
          result = '🕊️ You were blessed with temporary protection.';
        } else if (rng < 0.66) {
          activeCurses[i.user.id] = true;
          result = '👿 You were cursed! Beware the next round...';
        } else {
          result = '🌫️ Nothing happens.';
        }
        fateRolls[i.user.id] = true;
        i.reply({ content: result, ephemeral: true });
      });
    }

    // 🗳️ Audience Vote
let cursedPlayerId = null;
if (Math.random() < 0.4 && remaining.length >= 3) {
  const pollPlayers = remaining.slice(0, 3);

  const playerList = pollPlayers.map(p => `- <@${p.id}>`).join('\n');

  // Step 1: Show who is up for vote
  await channel.send({
    embeds: [{
      title: '👁️ Audience Vote Incoming...',
      description: `The malformed crowd stirs...\n\nThe following players are up for a curse:\n\n${playerList}`,
      color: 0xff6666
    }]
  });

  // Step 2: 1-minute discussion phase
  await channel.send(`🗣️ Discuss who you want to vote out… you have **1 minute**!`);
  await new Promise(r => setTimeout(r, 20000));
  await channel.send(`⏳ 40 seconds remaining...`);
  await new Promise(r => setTimeout(r, 20000));
  await channel.send(`⚠️ Final 20 seconds to plot your curse!`);
  await new Promise(r => setTimeout(r, 20000));

  // Step 3: Vote buttons
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

    // Perform eliminations
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

    // 🌱 Rare Revival
    if (eliminated.length && Math.random() < 0.15) {
      const reviveIndex = Math.floor(Math.random() * eliminated.length);
      const revived = eliminated.splice(reviveIndex, 1)[0];
      if (revived) {
        remaining.push(revived);
        const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
        eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
      }
    }

    if (remaining.length > 3) {
      eliminationDescriptions.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
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
// 🔁 Rematch Prompt
lastGameEntrantCount = gauntletEntrants.length;

// Limit resets every hour
if (Date.now() - rematchLimitResetTime > 60 * 60 * 1000) {
  rematchesThisHour = 0;
  rematchLimitResetTime = Date.now();
}

// Abort if we're at the limit
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

const rematchCollector = rematchMsg.createMessageComponentCollector({ time: 30000 });
const rematchVoters = new Set();

rematchCollector.on('collect', async (interaction) => {
  if (rematchVoters.has(interaction.user.id)) {
    await interaction.reply({ content: '⛔ You’ve already voted for a rematch.', ephemeral: true });
    return;
  }

  rematchVoters.add(interaction.user.id);
  rematchClicks++;

  await interaction.reply({ content: '🩸 Your vote for the rematch is cast...', ephemeral: true });

  // If threshold met
  if (rematchClicks >= neededClicks) {
    rematchesThisHour++;

    await channel.send(`🔁 The Gauntlet begins again — summoned by ${rematchClicks} brave (or foolish) souls!`);
    setTimeout(() => startGauntlet(channel, 3), 2000);
    rematchCollector.stop(); // stop collecting more votes
  }
});

rematchCollector.on('end', async () => {
  if (rematchClicks < neededClicks) {
    await channel.send(`☠️ Not enough votes for a rematch. The Gauntlet sleeps... for now.`);
  }
});

// Close runGauntlet
}

// Ready event
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Login
client.login(process.env.DISCORD_TOKEN);
