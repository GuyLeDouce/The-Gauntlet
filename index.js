require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const axios = require('axios');

async function sendCharmToUser(discordUserId, amount) {
  const DRIP_API_TOKEN = process.env.DRIP_API_TOKEN;
  const DRIP_ACCOUNT_ID = '676d81ee502cd15c9c983d81';
  const CURRENCY_ID = '1047256251320520705';

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
    currency_id: CURRENCY_ID
  };

  try {
    const response = await axios.post(
      `https://api.drip.re/v2/${DRIP_ACCOUNT_ID}/send`,
      data,
      { headers }
    );
    console.log(`✅ Sent ${amount} $CHARM to ${discordUserId}`);
  } catch (error) {
    console.error(`❌ Error sending $CHARM to ${discordUserId}:`, error.response?.data || error.message);
  }
}


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
let eliminatedPlayers = []; // Tracks eliminated players for revive attempts
let remaining = []; // Global: players still alive in the Gauntlet
remaining = [...gauntletEntrants]; // Reassign the global variable


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
  "joined the wrong Discord and disappeared forever."
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
  "emerged from the swamp, covered in mud and vengeance.",
  "refused to die and bribed fate with $CHARM.",
  "sacrificed a toe and was reborn in pixelated agony.",
  "got patched in a hotfix and returned.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "was pulled back by the chants of the community.",
  "glitched through the floor, then glitched back.",
  "got spit out by a mimic. Again."
];
const playerCommands = {}; // Tracks who has used a command
const tauntTargets = {};   // Stores taunt targets
const dodgeAttempts = {};  // Tracks dodge attempts
const hideAttempts = {};   // Tracks hide attempts

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    if (!gauntletEntrants.find(e => e.id === interaction.user.id)) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });
      await interaction.reply({ content: 'You have joined the Ugly Gauntlet! Prepare yourself…', flags: 64 });

      if (gauntletMessage && gauntletMessage.editable) {
        const embed = gauntletMessage.embeds[0];
        const updatedEmbed = {
          ...embed.data,
          description: embed.description.replace(/🧟 Entrants so far: \d+/, `🧟 Entrants so far: ${gauntletEntrants.length}`)
        };
        await gauntletMessage.edit({ embeds: [updatedEmbed] });
      }
    } else {
      await interaction.reply({ content: 'You have already joined this round!', flags: 64 });
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (content === '!gauntlet') startGauntlet(message.channel, 10);
  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }
  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
  }
  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
    gauntletActive = true;
    gauntletChannel = message.channel;
    await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
    await new Promise(r => setTimeout(r, 1000));
    runGauntlet(message.channel);
  }
});
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const command = message.content.toLowerCase().trim();

  // ✅ GAUNTLET START COMMANDS
  if (command === '!gauntlet') return startGauntlet(message.channel, 10);
  if (command.startsWith('!gauntlet ')) {
    const delay = parseInt(command.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }
  if (command === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
    return;
  }
  if (command === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
    gauntletActive = true;
    gauntletChannel = message.channel;
    await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
    await new Promise(r => setTimeout(r, 1000));
    return runGauntlet(message.channel);
  }

  // ✅ SKIP IF GAME NOT ACTIVE
  if (!gauntletActive) return;

  // ✅ !REVIVE COMMAND
  if (command === '!revive') {
  if (!gauntletActive) return message.reply("⚠️ The Gauntlet isn't running right now.");

  const alreadyAlive = remaining.find(p => p.id === userId);
  if (alreadyAlive) return message.reply("🧟 You're already back in the game!");

  const wasEliminated = eliminatedPlayers.find(p => p.id === userId);
  if (!wasEliminated) return message.reply("👻 You haven’t been eliminated... yet.");

  // Optional: one attempt per game (per user)
  if (wasEliminated.attemptedRevive) {
    return message.reply("🔁 You've already tried to revive this game. The malformed don’t give second chances...");
  }

  wasEliminated.attemptedRevive = true; // Mark as attempted

  if (Math.random() < 0.02) {
    remaining.push(wasEliminated);
    const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
    await message.channel.send(`💫 <@${userId}> defied all odds!\n${reviveMsg}`);
  } else {
    const fails = [
      "🪦 You wiggle in the dirt… but you're still dead.",
      "😵 You whispered to the void. It blocked you.",
      "👁️ The malformed forces laughed and turned away.",
      "🔮 Your bones creaked… then cracked. Nope.",
      "☠️ You reached out… and got ghosted."
    ];
    const failMsg = fails[Math.floor(Math.random() * fails.length)];
    await message.reply(failMsg);
  }
}

  // ✅ INTERACTIVE COMMANDS (1-time use)
  if (playerCommands[userId]) {
    return message.reply("🛑 You’ve already used your command for this Gauntlet.");
  }

  if (command === '!dodge') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      dodgeAttempts[userId] = true;
      message.reply("🌀 You prepare to dodge fate...");
    } else {
      message.reply("😬 You braced... but nothing happened.");
    }
  }

  if (command === '!taunt') {
    playerCommands[userId] = true;
    const alive = gauntletEntrants.filter(p => p.id !== userId);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      tauntTargets[target.id] = true;
      message.reply(`🔥 You mocked your enemies... and now **<@${target.id}>** is marked!`);
    }
  }

  if (command === '!hide') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      hideAttempts[userId] = true;
      message.reply("👻 You vanish into the shadows...");
    } else {
      message.reply("😶 You tried to hide, but the shadows rejected you.");
    }
  }
});

async function startGauntlet(channel, delay) {
  if (gauntletActive) return;
  gauntletEntrants = [];
  gauntletActive = true;
  gauntletChannel = channel;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_gauntlet').setLabel('Join the Ugly Gauntlet').setStyle(ButtonStyle.Primary)
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

// ⏳ Countdown warnings every 1/3 of the time
const intervalMs = totalMs / 3;

setTimeout(() => {
  channel.send(`⏳ One third of the time has passed. **${Math.round((delay * 2) / 3)} minutes left** to join the Gauntlet...`);
}, intervalMs);

setTimeout(() => {
  channel.send(`⚠️ Two thirds of the countdown are gone. Only **${Math.round(delay / 3)} minutes** remain to join!`);
}, intervalMs * 2);

setTimeout(() => {
  channel.send(`🕰️ Final moment! The Gauntlet will begin **any second now...**`);
}, intervalMs * 3 - 5000); // 5 seconds before start

}
async function runGauntlet(channel) {
  gauntletActive = false;
  let remaining = [...gauntletEntrants];
  let roundCounter = 1;
  activeBoons = {};
  activeCurses = {};
  roundImmunity = {};
  fateRolls = {};
  mutationDefenseClicks = new Set();

  // 🦍 Choose the Ugly Boss
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

    // 🧬 Mutation Defense Button
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
  if (mutationSuppressed) {
    await channel.send('🧬 Enough resistance! The mutation has been suppressed.');
  } else {
    await channel.send('💥 Not enough resistance. The mutation begins...');
    // You could trigger special effects here
  }
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
          description: fateLines.join('\n'),
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


    // 🗳️ Audience Vote (40% chance)
    let cursedPlayerId = null;
    if (Math.random() < 0.4 && remaining.length >= 3) {
      const pollPlayers = remaining.slice(0, 3);
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
          title: '👁️ Audience Vote',
          description: `The malformed crowd stirs... Choose who to curse.`,
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

      const max = Math.max(...Object.values(voteCounts));
      const cursedIds = Object.entries(voteCounts).filter(([_, v]) => v === max).map(([id]) => id);
      cursedPlayerId = cursedIds[Math.floor(Math.random() * cursedIds.length)];
      await channel.send(`😨 The audience cursed <@${cursedPlayerId}>!`);
    }
    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    let eliminationDescriptions = [];

    for (let i = 0; i < eliminations; i++) {
      let player;
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

      // 🛡️ Immunity
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
eliminatedPlayers.push(player); // ✅ This is essential


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

    if (remaining.length > 3) {
      eliminationDescriptions.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    }

    const tokenId = Math.floor(Math.random() * 530) + 1;
    const nftImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;

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

await sendCharmToUser(first.id, firstReward);
await sendCharmToUser(second.id, secondReward);
await sendCharmToUser(third.id, thirdReward);

let resultMessage = `**1st Place:** <@${first.id}> — **${firstReward} $CHARM**\n**2nd Place:** <@${second.id}> — **${secondReward} $CHARM**\n**3rd Place:** <@${third.id}> — **${thirdReward} $CHARM**`;

if ([first.id, second.id, third.id].includes(boss.id)) {
  await channel.send(`👑 The **Ugly Boss** <@${boss.id}> survived to the end. Their reward is **doubled**!`);
}

await channel.send({
  embeds: [{
    title: '🏆 Champions of the Ugly Gauntlet!',
    description: resultMessage + `\n\nThe Gauntlet has spoken. Well fought, Champions!`,
    color: 0xdaa520
  }]
});

}


client.login(process.env.DISCORD_TOKEN);
