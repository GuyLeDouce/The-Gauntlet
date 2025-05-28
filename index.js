require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  Collection
} = require('discord.js');
const axios = require('axios');
const { Client: PgClient } = require('pg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const db = new PgClient({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.connect()
  .then(async () => {
    console.log('✅ Connected to PostgreSQL!');
    await db.query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT,
        year INT,
        month INT,
        wins INT DEFAULT 0,
        revives INT DEFAULT 0,
        games_played INT DEFAULT 0,
        duel_wins INT DEFAULT 0
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS monthly_champions (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        year INT,
        month INT,
        category TEXT,
        value INT
      );
    `);
    console.log('📊 Tables are ready!');
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

// Utility
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const shuffleArray = array => array.sort(() => Math.random() - 0.5);

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
let gameInProgress = false;
let autoRestartCount = 0;

let currentPlayers = [];
let eliminatedPlayers = [];
let eliminatedPlayerMap = new Map();
let playerLives = new Map();
let bossPlayer = null;
let activeGameChannel = null;
let previousGamePlayers = [];
let rematchVotes = new Set();
let consecutiveRestarts = 0;
const MAX_RESTARTS = 4;

// Lore and message arrays
const eliminationReasons = [
  "tried to reason with a Fungus Pope and got spored.",
  "drank from the wrong goblet at the Melted Banquet.",
  "slipped on a screaming tile and vanished into the floor.",
  "picked a fight with a mirror... and lost.",
  "woke the Toe King from his itchy slumber.",
  "tried to pet a Void Dog. Rookie mistake.",
  "whispered back to the Whispers and was instantly shushed... permanently.",
  "laughed during the Mourning Chant. The chorus responded.",
  "accidentally sat in the Chair of Eternal Regret. Still sitting.",
  "asked the forbidden question: 'What’s under the flap?'",
  "stepped on a crack and got dragged into Mom's Realm.",
  "tried to use logic in a place built on dreams. Bye-bye.",
  "missed the vibe-check from the Sentient Fog.",
  "opened a cursed lunchbox and choked on despair.",
  "rolled a natural 1 against the Goblin Bureaucrat.",
  "slipped into a puddle of soul-leak. Easy come, easy go.",
  "licked the teleporting mushroom. Who could resist?",
  "called the Ugly Dog a 'good boy' at the wrong time.",
  "played fetch with a ghost and got possessed.",
  "ate the marshmallow that was screaming 'DON'T EAT ME!'",
  "tried to out-fart the Fart Spirit. Big mistake.",
  "forgot the safety word during the Ritual of Mild Peril.",
  "touched the cursed doorknob and got yanked into The Between.",
  "took a selfie in front of the Wailing Wall of Teeth.",
  "tried to cheat death using Uno rules. Didn’t work.",
  "challenged the swamp to a duel and got devoured by mud manners.",
  "chose the 'mystery option' and got mystery eliminated.",
  "failed to answer the Sphinx’s riddle: 'What is Ugly?'",
  "walked into the Disappointment Zone and faded out of relevance.",
  "stole from the Goblet of Goblins. Now goblins live inside them.",
  "got eliminated by audience vote. Harsh, but fair.",
  "thought they could hide under a Cone of Shame.",
  "tried to flex on the Horrible. Got flexed off instead.",
  "stepped on the stage trapdoor during karaoke night.",
  "opened the wrong cursed chest. Got turned into glitter. Sad, sticky glitter.",
  "disrespected the Elder Wart and got flicked into orbit.",
  "missed their step during the Dance of Survival.",
  "called the boss 'mid' and got boss-slapped out of existence.",
  "failed to scream at the correct frequency when required.",
  "lost a staring contest with an eye on a stick.",
  "accidentally selected 'permadeath' in the charm settings menu.",
];
const specialEliminationLines = [
  "🩸 In a spectacular display of hubris, **{player}** was obliterated by the Wrath of the Wiggly One.",
  "🎭 The curtains closed on **{player}**, whose final act was… not well received.",
  "🌪️ A howling wind called **{player}** by name. They stepped outside and were never seen again.",
  "🐌 **{player}** challenged the Grand Slime to a race and lost in every way imaginable.",
  "👁️ The All-Seeing Eye blinked once. When it opened, **{player}** was gone.",
  "⛓️ Chains rattled in the deep. One name was whispered: **{player}**.",
  "🎲 The dice were rolled. **{player}** came up snake eyes.",
  "💔 In a tragic twist of fate, **{player}** was betrayed by their imaginary friend.",
  "📖 The chapter of **{player}** has been closed. The story continues without them.",
  "🎯 The universe spun the wheel of fate. It landed on **{player}**.",
  "🦴 The bones have spoken. They did not favor **{player}**.",
  "👄 A thousand voices sang, and **{player}** was harmonized into the void.",
  "🪞 Mirror, mirror on the wall... said **{player}** was the next to fall.",
  "🔥 A burst of reality folded, and **{player}** folded with it.",
  "🐾 The Ugly Dog sniffed **{player}**... and judged them unworthy.",
  "🌌 The stars aligned to eliminate **{player}**. Cosmic bullying at its finest.",
  "🗝️ **{player}** found the door marked 'DO NOT OPEN'. Naturally, they opened it.",
  "🧼 **{player}** tried to cleanse their sins. The soap was sentient and vengeful.",
  "🫧 A bubble rose from the swamp, whispered '**{player}**', and popped them into goo.",
];

const reviveSuccessLines = [
  "✨ Against all odds, **{player}** claws their way back into the realm of the Ugly.",
  "🧠 **{player}** outwitted death with nothing but a toothpick and raw charisma.",
  "🔮 The Gauntlet whispered, and **{player}** answered. Welcome back, glitch.",
  "⚡ A jolt of cursed energy surged through the arena. **{player}** rises!",
  "🪦 Just when you thought they were gone, **{player}** emerges from the dirt grinning.",
  "🍳 **{player}** was cooked medium-dead, but flipped themselves back into play.",
  "🎩 The hat of fate spun wildly and spat out **{player}** like an expired trick.",
  "🪙 A coin was flipped for **{player}**'s soul. They won. Barely.",
  "🐛 **{player}** cocooned in despair… and burst forth a little bit worse.",
  "💉 A syringe labeled ‘💀?’ brought **{player}** back, twitchier than ever.",
  "🎮 Someone pressed UP UP DOWN DOWN and **{player}** respawned.",
  "🧃 One sip from the Forbidden Juice and **{player}** is ALIVE again.",
  "🗿 The ancient idol blinked twice. **{player}** was standing there, confused.",
  "🧤 A rubber glove reached out of nowhere and slapped **{player}** back to life.",
  "🎻 A haunting tune echoed… and **{player}** rose, humming the last note.",
  "🌀 From within the Gauntlet’s gut, **{player}** vomits themselves back out.",
  "🫀 **{player}**'s heart restarted due to spite alone.",
  "🦴 **{player}** rebuilt themselves out of leftover bones and rage.",
  "🪬 Some say it was luck. Others say the Gauntlet just likes **{player}**'s vibes.",
];


const reviveFailureLines = [
  "💀 The gods rolled their eyes at **{player}**. Denied.",
  "🚪 The door back into the game slammed shut on **{player}**’s fingers.",
  "🧂 **{player}** tried to bribe the Gauntlet with salt. It got offended.",
  "🕳️ **{player}** fell into a hole labeled ‘Nope’.",
  "🧼 Revival attempt denied. **{player}** has been scrubbed from the timeline.",
  "🎲 **{player}** rolled a natural 1. Resurrection failed spectacularly.",
  "🧀 **{player}** stepped in something weird and lost their revival privileges.",
  "🐐 A goat screamed in **{player}**’s face. That’s a no.",
  "🛸 Aliens intercepted **{player}**'s soul. They weren’t impressed.",
  "🩹 **{player}** applied a band-aid to their spirit. Not enough.",
  "🥴 **{player}** tried to look alive. The Gauntlet laughed and walked away.",
  "🔒 The gates of revival were locked... and **{player}** forgot the password.",
  "☕ A revival was brewing, but **{player}** sneezed in the cup. Ew. No.",
  "🎯 Missed the comeback by *that* much, **{player}**.",
  "🍌 Slipped on a banana peel mid-respawn. RIP again, **{player}**.",
  "👻 Even ghosts said 'nah' to **{player}**.",
  "📵 **{player}** tried to revive during a firmware update. Bricked.",
  "🪞 **{player}** looked into the mirror of resurrection. Mirror cracked. Ouch.",
  "🫠 **{player}** melted under pressure. Try harder next time.",
  "🍄 Ate the wrong mushroom. **{player}** will not be returning.",
];

const mutationEvents = [
  "🧬 A spore cloud fills the arena. **{player}** inhales deeply and begins to twitch… but survives. For now.",
  "🕷️ A swarm of spectral spiders crawls over **{player}**. They scream, flail, and vanish.",
  "🧟 A mutated clone of **{player}** appears… and devours the original.",
  "🌪️ A vortex opens and **{player}** is sucked into a swirling realm of teeth and shadows. No return.",
  "🐍 **{player}** grows a second head… it’s mean, and it votes to eject them.",
  "🔥 Lava pours from the ceiling, but **{player}** dances through like a beast. SURVIVES.",
  "👁️ A giant blinking eye stares at **{player}**. Judgment is passed. They are gone.",
  "💉 An infected syringe stabs **{player}**. They mutate into… something worse, and stay alive.",
  "⛓️ Chains burst from the floor and try to drag **{player}** down. They narrowly escape.",
  "🧠 A psychic pulse knocks **{player}** unconscious. When they wake, they’re in the game again. REVIVED.",
  "⚗️ A strange mist causes **{player}** to split in two. Only one survives. Guess which.",
  "🍄 Mutated fungi sprout from **{player}**’s limbs. They shriek in horror… and are eliminated.",
  "🦴 Bones rearrange themselves. **{player}** survives, but something is… off now.",
  "🔮 A warped prophecy declares **{player}** a chosen one. They are brought back to life!",
  "🪚 The walls close in. **{player}** finds a hidden crevice and squeezes out alive.",
  "🧊 An icy tendril wraps around **{player}**’s throat. Frozen. Eliminated.",
  "🎭 **{player}** finds a mask and puts it on. It fuses to their face. They return… different. REVIVED.",
  "🩻 A radiation surge hits the arena. **{player}** glows briefly… and pops.",
  "💥 An explosion throws **{player}** across the map. They land, still breathing. Lucky.",
  "🩸 The Gauntlet demands a sacrifice. **{player}** steps forward. Accepted… and eliminated.",
];

 const mutationMiniGames = [
    {
      title: 'Mirror of the Maw',
      description: 'A twisted mirror appears. You see a distorted reflection of yourself, whispering secrets. Do you break it or embrace it?',
      choices: ['🪞 Break it', '👁️ Embrace it'],
      outcomes: {
        '🪞 Break it': { result: 'revive', text: 'You shatter the mirror, and your true self bursts forth. You are revived!' },
        '👁️ Embrace it': { result: 'eliminated', text: 'You are consumed by your reflection. You vanish from existence.' }
      }
    },
    {
      title: 'The Spinning Bone Wheel',
      description: 'An ancient bone wheel spins before you. You must stop it with a slap.',
      choices: ['✋ SLAP THE WHEEL'],
      outcomes: {
        '✋ SLAP THE WHEEL': { result: 'extra_life', text: 'You land the perfect slap. +1 life. Fortune favours the bold!' }
      }
    },
    {
      title: 'Elixir Roulette',
      description: 'A masked figure offers you two vials: one glows green, the other red. Choose wisely.',
      choices: ['🧪 Green Elixir', '🧪 Red Elixir'],
      outcomes: {
        '🧪 Green Elixir': { result: 'revive', text: 'The elixir surges through you. You’re back in the game!' },
        '🧪 Red Elixir': { result: 'remove_life', text: 'You double over. A life vanishes from your soul...' }
      }
    },
    {
      title: 'Hanging by a Thread',
      description: 'You’re hanging over the abyss, held by a single thread. You must call for help.',
      choices: ['🗣️ Call for help'],
      outcomes: {
        '🗣️ Call for help': { result: 'random', text: 'Someone answers… or do they? Your fate is determined by chance.' }
      }
    }
  ];

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Standard game with optional custom countdown
  if (content.startsWith('!gauntlet')) {
    if (gameInProgress) return message.reply('⚠️ A Gauntlet is already running!');
    let countdown = 180;
    const args = content.split(' ');
    if (args.length > 1 && !isNaN(args[1])) countdown = parseInt(args[1]) * 60;
    startJoinPhase(message.channel, countdown);
  }

  // Trial mode
  if (content === '!gauntlettrial') {
    if (gameInProgress) return message.reply('⚠️ A Gauntlet is already running!');
    currentPlayers = [];
    for (let i = 1; i <= 20; i++) {
      const name = `Trial${i}`;
      currentPlayers.push({ id: `trial_${i}`, username: name });
      playerLives.set(`trial_${i}`, 1);
    }
    activeGameChannel = message.channel;
    message.channel.send('🎮 Starting Gauntlet Trial Mode with 20 randomly generated test players...');
    await runBossVotePhase(message.channel);
  }

  // Dev test mode (no auto-tagging)
  if (content === '!gauntletdev') {
    if (gameInProgress) return message.reply('⚠️ A Gauntlet is already running!');
    let countdown = 180;
    const args = content.split(' ');
    if (args.length > 1 && !isNaN(args[1])) countdown = parseInt(args[1]) * 60;
    startJoinPhase(message.channel, countdown, false);
  }
});

async function startJoinPhase(channel, countdownSeconds, tagEveryone = true) {
  gameInProgress = true;
  activeGameChannel = channel;
  currentPlayers = [];
  eliminatedPlayers = [];
  eliminatedPlayerMap.clear();
  playerLives.clear();
  bossPlayer = null;

  let joinCount = 0;

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_button').setLabel('Join the Gauntlet').setStyle(ButtonStyle.Success)
  );

  const joinEmbed = new EmbedBuilder()
    .setTitle('🩸 The Gauntlet Begins')
    .setDescription(`A new Gauntlet is forming. Click below to join.\n\nTime until start: <t:${Math.floor(Date.now() / 1000) + countdownSeconds}:R>`)
    .setColor('Red');

  const msg = await channel.send({ content: tagEveryone ? '@everyone' : '', embeds: [joinEmbed], components: [joinRow] });

  const collector = msg.createMessageComponentCollector({ time: countdownSeconds * 1000 });

  collector.on('collect', async interaction => {
    if (interaction.customId === 'join_button') {
      if (!currentPlayers.find(p => p.id === interaction.user.id)) {
        currentPlayers.push({ id: interaction.user.id, username: interaction.user.username });
        playerLives.set(interaction.user.id, 1);
        joinCount++;
        await interaction.reply({ content: `✅ You’ve entered the Gauntlet! (${joinCount} total)`, ephemeral: true });
      } else {
        await interaction.reply({ content: '🛑 You’re already in the game.', ephemeral: true });
      }
    }
  });

  let thirds = [Math.floor(countdownSeconds / 3), Math.floor((countdownSeconds * 2) / 3)];
  for (const t of thirds) {
    setTimeout(() => {
      if (tagEveryone && gameInProgress) {
        channel.send(`⏳ The Gauntlet starts soon! <t:${Math.floor(Date.now() / 1000) + countdownSeconds - t}:R> remaining...`);
      }
    }, (countdownSeconds - t) * 1000);
  }

  collector.on('end', async () => {
    if (currentPlayers.length < 2) {
      gameInProgress = false;
      return channel.send('⚠️ Not enough players joined. The Gauntlet has been cancelled.');
    }
    await runBossVotePhase(channel);
  });
}
async function runBossVotePhase(channel) {
  const shuffled = shuffleArray([...currentPlayers]);
  const voteCandidates = shuffled.slice(0, 5);

  const voteRow = new ActionRowBuilder();
  voteCandidates.forEach(p => {
    voteRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('👑 Boss Selection Phase')
    .setDescription(`Choose who should become the Boss of this Gauntlet.\nClick a name below to cast your vote!`)
    .setColor('Purple');

  const voteMsg = await channel.send({ embeds: [embed], components: [voteRow] });
  const voteCounts = new Map();

  const collector = voteMsg.createMessageComponentCollector({ time: 10000 });

  collector.on('collect', async interaction => {
    if (!currentPlayers.find(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: '❌ You’re not in this Gauntlet.', ephemeral: true });
    }

    if (voteCounts.has(interaction.user.id)) {
      return interaction.reply({ content: '🛑 You already voted!', ephemeral: true });
    }

    const votedId = interaction.customId.replace('vote_', '');
    voteCounts.set(interaction.user.id, votedId);
    await interaction.reply({ content: '✅ Vote received!', ephemeral: true });
  });

  collector.on('end', async () => {
    const tally = {};
    voteCounts.forEach(v => {
      tally[v] = (tally[v] || 0) + 1;
    });

    const winnerId = Object.keys(tally).reduce((a, b) => (tally[a] > tally[b] ? a : b));
    const boss = currentPlayers.find(p => p.id === winnerId);

    if (boss) {
      playerLives.set(boss.id, 2);
      bossPlayer = boss;
      channel.send(`👑 ${boss.username} has been chosen as the Boss Level Ugly and starts with **2 lives**!`);
    } else {
      const randomBoss = voteCandidates[Math.floor(Math.random() * voteCandidates.length)];
      playerLives.set(randomBoss.id, 2);
      bossPlayer = randomBoss;
      channel.send(`⚠️ No valid votes. Randomly selecting ${randomBoss.username} as the Boss Level Ugly with **2 lives**.`);
    }

    startGameRounds(channel);
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
async function startGameRounds(channel) {
  while (currentPlayers.length > 1) {
    await new Promise(resolve => setTimeout(resolve, 8000));

    if (currentPlayers.length <= originalEntrantCount / 2 && !massRevivalTriggered) {
      massRevivalTriggered = true;
      await handleMassRevival(channel);
      continue;
    }

    const roundType = Math.floor(Math.random() * 4);
    if (roundType < 2) {
      await eliminatePlayers(channel);
    } else if (roundType === 2) {
      await runMutationEvent(channel);
    } else {
      await runMutationMiniGame(channel);
    }

    if (currentPlayers.length === 0) break;
  }

  await announceWinners(channel);
}
async function eliminatePlayers(channel) {
  const numToEliminate = Math.min(currentPlayers.length, Math.floor(Math.random() * 2) + 2);
  const eliminatedThisRound = [];

  for (let i = 0; i < numToEliminate; i++) {
    const unluckyIndex = Math.floor(Math.random() * currentPlayers.length);
    const unlucky = currentPlayers.splice(unluckyIndex, 1)[0];
    eliminatedPlayers.push(unlucky);
    eliminatedThisRound.push(unlucky);
  }

  const lines = eliminatedThisRound.map(p => {
    const line = eliminationReasons[Math.floor(Math.random() * eliminationReasons.length)];
    return `💀 <@${p.id}> ${line}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Gauntlet Round Results')
    .setDescription(lines.join('\n'))
    .setColor(0xff0000);

  await channel.send({ embeds: [embed] });
}

async function runMutationEvent(channel) {
  const mutation = mutationEvents[Math.floor(Math.random() * mutationEvents.length)];

  const embed = new EmbedBuilder()
    .setTitle('🧬 Mutation Event')
    .setDescription(`**${mutation.name}**\n${mutation.description}`)
    .setColor(0x8e44ad);

  await channel.send({ embeds: [embed] });

  await mutation.effect(channel);
}

async function runMutationMiniGame(channel) {
  const game = mutationMiniGames[Math.floor(Math.random() * mutationMiniGames.length)];

  const embed = new EmbedBuilder()
    .setTitle('🎮 Mutation Mini-Game')
    .setDescription(`**${game.name}**\n${game.description}`)
    .setColor(0xf1c40f);

  await channel.send({ embeds: [embed] });

  await game.effect(channel);
}

async function handleMassRevival(channel) {
  const eliminatedPool = [...eliminatedPlayers];
  const potentialNew = [];

  const members = await channel.guild.members.fetch();
  members.forEach(m => {
    if (!m.user.bot && !currentPlayers.find(p => p.id === m.user.id) && !eliminatedPlayers.find(p => p.id === m.user.id)) {
      potentialNew.push({ id: m.user.id, username: m.user.username });
    }
  });

  const revived = [];
  const failed = [];

  for (const p of eliminatedPool) {
    if (Math.random() < 0.6) {
      currentPlayers.push(p);
      revived.push(`<@${p.id}>`);
    } else {
      failed.push(`<@${p.id}>`);
    }
  }

  for (const p of potentialNew) {
    if (Math.random() < 0.4) {
      currentPlayers.push(p);
      revived.push(`<@${p.id}>`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🌀 Totem of Lost Souls')
    .setDescription(`The Totem shimmered and chose its warriors:\n\n✅ Revived:\n${revived.join('\n') || 'None'}\n\n❌ Ignored:\n${failed.join('\n') || 'None'}`)
    .setColor(0x3498db);

  await channel.send({ embeds: [embed] });

  if (revived.length >= 2) {
    await runDuelRound(channel);
  }
}
async function runDuelRound(channel) {
  if (currentPlayers.length < 2) return;

  const [p1, p2] = shuffleArray([...currentPlayers]).slice(0, 2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_${p1.id}`).setLabel(p1.username).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_${p2.id}`).setLabel(p2.username).setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Duel of Fates')
    .setDescription(`Two challengers rise!\nClick your name to strike first.\nLoser is eliminated, winner gains an extra life.`)
    .addFields(
      { name: '👤 Fighter 1', value: `<@${p1.id}>`, inline: true },
      { name: '👤 Fighter 2', value: `<@${p2.id}>`, inline: true }
    )
    .setColor(0xe74c3c);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 8000 });
  collector.on('collect', async interaction => {
    const winnerId = interaction.customId.split('_')[1];
    const loserId = winnerId === p1.id ? p2.id : p1.id;

    const winner = currentPlayers.find(p => p.id === winnerId);
    const loser = currentPlayers.find(p => p.id === loserId);

    if (!winner || !loser) return;

    winner.lives = (winner.lives || 1) + 1;
    currentPlayers = currentPlayers.filter(p => p.id !== loserId);
    eliminatedPlayers.push(loser);

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle('🏆 Duel Concluded')
        .setDescription(`**<@${winner.id}>** wins the duel and gains +1 life!\n**<@${loser.id}>** has been eliminated.`)
        .setColor(0x2ecc71)],
      components: []
    });

    collector.stop();
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      msg.edit({
        embeds: [embed.setDescription('⚠️ No one clicked — both duelists vanished into obscurity.')],
        components: []
      });
    }
  });
}

async function showNFTImage(channel) {
  const useMonsters = Math.random() < 0.2;
  const id = useMonsters ? Math.floor(Math.random() * 126) + 1 : Math.floor(Math.random() * 613) + 1;
  const collection = useMonsters ? 'charm-of-the-ugly-monsters-nft' : 'charm-of-the-ugly-nft';

  const embed = new EmbedBuilder()
    .setTitle('👁️ Witness this Ugly')
    .setImage(`https://opensea.io/assets/ethereum/0x${useMonsters ? '1cd7fe72d64f6159775643acedc7d860dfb80348' : '9492505633d74451bdf3079c09ccc979588bc309'}/${id}`)
    .setColor(0x9b59b6);

  await channel.send({ embeds: [embed] });
}

async function showFinalPodium(channel) {
  const podium = currentPlayers.length >= 3
    ? shuffleArray(currentPlayers).slice(0, 3)
    : eliminatedPlayers.slice(-3).reverse();

  const places = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
  const results = podium.map((p, i) => `${places[i]} — <@${p.id}>`);

  const embed = new EmbedBuilder()
    .setTitle('🏁 Final Podium')
    .setDescription(results.join('\n') + `\n\n🎉 Legends rise, legends fall. Stay Ugly.`)
    .setColor(0xf39c12);

  await channel.send({ embeds: [embed] });
}

 
async function runMutationMiniGame(channel, livePlayers, eliminatedPlayers, playerLives) {
  const game = mutationMiniGames[Math.floor(Math.random() * mutationMiniGames.length)];
  const randomPlayerId = livePlayers[Math.floor(Math.random() * livePlayers.length)];

  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation Mini-Game: ${game.title}`)
    .setDescription(`**${game.description}**\n${game.choices.map(c => c).join('  ')}`)
    .setColor('#ff00ff')
    .setFooter({ text: `Player: <@${randomPlayerId}> must choose.` });

  const buttons = new ActionRowBuilder().addComponents(
    game.choices.map(choice =>
      new ButtonBuilder()
        .setCustomId(`mutationChoice_${randomPlayerId}_${choice}`)
        .setLabel(choice)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const gameMessage = await channel.send({ embeds: [embed], components: [buttons] });

  const collector = gameMessage.createMessageComponentCollector({
    time: 10000,
    filter: i => i.user.id === randomPlayerId
  });

  collector.on('collect', async i => {
    const selectedChoice = i.customId.split('_').slice(2).join('_');
    const outcome = game.outcomes[selectedChoice];

    if (!outcome) {
      await i.reply({ content: `😵 Something went wrong with your choice.`, ephemeral: true });
      return;
    }

    let resultText = outcome.text;
    switch (outcome.result) {
      case 'revive':
        if (!livePlayers.includes(i.user.id)) {
          livePlayers.push(i.user.id);
          playerLives[i.user.id] = 1;
        }
        break;
      case 'eliminated':
        livePlayers = livePlayers.filter(p => p !== i.user.id);
        eliminatedPlayers.push(i.user.id);
        break;
      case 'extra_life':
        playerLives[i.user.id] = (playerLives[i.user.id] || 1) + 1;
        break;
      case 'remove_life':
        playerLives[i.user.id] = (playerLives[i.user.id] || 1) - 1;
        if (playerLives[i.user.id] <= 0) {
          livePlayers = livePlayers.filter(p => p !== i.user.id);
          eliminatedPlayers.push(i.user.id);
        }
        break;
      case 'random':
        if (Math.random() < 0.5) {
          livePlayers.push(i.user.id);
          playerLives[i.user.id] = 1;
          resultText = 'A ghostly hand pulls you up. You’re back!';
        } else {
          livePlayers = livePlayers.filter(p => p !== i.user.id);
          eliminatedPlayers.push(i.user.id);
          resultText = 'The thread snaps. You fall into the abyss.';
        }
        break;
    }

    await i.update({
      embeds: [new EmbedBuilder()
        .setTitle('💀 Mutation Mini-Game Complete')
        .setDescription(`${i.user.username} chose **${selectedChoice}**.\n${resultText}`)
        .setColor('#ff00ff')],
      components: []
    });

    collector.stop();
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      await gameMessage.edit({
        embeds: [new EmbedBuilder()
          .setTitle('💀 Mutation Mini-Game Failed')
          .setDescription(`<@${randomPlayerId}> did not respond in time.\nThe mutation passed over... for now.`)
          .setColor('#555555')],
        components: []
      });
    }
  });

  return { livePlayers, eliminatedPlayers, playerLives };
}
async function runMassRevivalPhase(channel, livePlayers, eliminatedPlayers, playerLives, allPlayers) {
  const eligibleEliminated = eliminatedPlayers.filter(id => !livePlayers.includes(id));
  const newJoiners = allPlayers.filter(id => !livePlayers.includes(id) && !eliminatedPlayers.includes(id));

  const revivedEliminated = eligibleEliminated.filter(() => Math.random() < 0.6);
  const revivedNew = newJoiners.filter(() => Math.random() < 0.4);

  revivedEliminated.forEach(id => {
    if (!livePlayers.includes(id)) {
      livePlayers.push(id);
      playerLives[id] = 1;
    }
  });

  revivedNew.forEach(id => {
    if (!livePlayers.includes(id)) {
      livePlayers.push(id);
      playerLives[id] = 1;
    }
  });

  const embed = new EmbedBuilder()
    .setTitle('☠️ Mass Revival Ritual Complete')
    .setDescription(
      `**Returned from the grave:**\n${revivedEliminated.map(id => `<@${id}>`).join(', ') || 'None'}\n\n` +
      `**New challengers who snuck in:**\n${revivedNew.map(id => `<@${id}>`).join(', ') || 'None'}`
    )
    .setColor('#9c27b0');

  await channel.send({ embeds: [embed] });
  return { livePlayers, eliminatedPlayers, playerLives };
}

async function runHeadToHeadDuel(channel, livePlayers, eliminatedPlayers, playerLives) {
  if (livePlayers.length < 2) return { livePlayers, eliminatedPlayers, playerLives };

  const [p1, p2] = shuffleArray(livePlayers).slice(0, 2);
  const duelEmbed = new EmbedBuilder()
    .setTitle('⚔️ Head-to-Head Duel!')
    .setDescription(`<@${p1}> vs <@${p2}> — Click to fight!`)
    .setColor('#e53935');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_${p1}_${p2}`).setLabel('⚔️ Fight!').setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [duelEmbed], components: [row] });

  const collector = msg.createMessageComponentCollector({
    time: 10000,
    filter: i => [p1, p2].includes(i.user.id)
  });

  collector.on('collect', async interaction => {
    const userId = interaction.user.id;
    const opponentId = userId === p1 ? p2 : p1;
    const winner = userId;
    const loser = opponentId;

    playerLives[winner] = (playerLives[winner] || 1) + 1;
    playerLives[loser] = 0;

    livePlayers = livePlayers.filter(p => p !== loser);
    eliminatedPlayers.push(loser);

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle('🏆 Duel Outcome')
        .setDescription(`**<@${winner}>** has triumphed over <@${loser}>!\nThey gain +1 life!`)
        .setColor('#4caf50')],
      components: []
    });

    collector.stop();
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      await msg.edit({
        embeds: [duelEmbed.setDescription('⏳ No one stepped forward. The duel was canceled.')],
        components: []
      });
    }
  });

  return { livePlayers, eliminatedPlayers, playerLives };
}
async function runGameRounds(channel, players, isTrial = false) {
  let livePlayers = [...players];
  let eliminatedPlayers = [];
  let playerLives = {};
  let allPlayers = [...players];
  let roundCount = 0;
  let consecutiveNonElimRounds = 0;

  players.forEach(id => (playerLives[id] = 1));

  while (livePlayers.length > 1 && consecutiveNonElimRounds < 2) {
    roundCount++;
    const roundTypeRoll = Math.random();

    if (roundTypeRoll < 0.25) {
      await runMutationMiniGame(channel, livePlayers, eliminatedPlayers, playerLives);
      consecutiveNonElimRounds++;
    } else if (roundTypeRoll < 0.4) {
      await runMutationEvent(channel, livePlayers, eliminatedPlayers, playerLives);
      consecutiveNonElimRounds++;
    } else if (roundTypeRoll < 0.6 && livePlayers.length <= players.length / 2) {
      const result = await runMassRevivalPhase(channel, livePlayers, eliminatedPlayers, playerLives, allPlayers);
      livePlayers = result.livePlayers;
      eliminatedPlayers = result.eliminatedPlayers;
      playerLives = result.playerLives;

      const duel = await runHeadToHeadDuel(channel, livePlayers, eliminatedPlayers, playerLives);
      livePlayers = duel.livePlayers;
      eliminatedPlayers = duel.eliminatedPlayers;
      playerLives = duel.playerLives;

      consecutiveNonElimRounds = 0;
    } else {
      const eliminations = [];
      const shuffled = shuffleArray([...livePlayers]);
      const elimCount = Math.min(3, Math.max(2, Math.floor(Math.random() * 3)));

      for (let i = 0; i < elimCount && shuffled.length > 0; i++) {
        const player = shuffled.pop();
        if ((playerLives[player] || 1) > 1) {
          playerLives[player]--;
        } else {
          eliminations.push(player);
          livePlayers = livePlayers.filter(p => p !== player);
          eliminatedPlayers.push(player);
        }
      }

      if (eliminations.length > 0) {
        await postEliminationMessage(channel, eliminations);
        consecutiveNonElimRounds = 0;
      } else {
        consecutiveNonElimRounds++;
      }
    }

    await new Promise(r => setTimeout(r, 8000));
  }

  await sendFinalPodium(channel, livePlayers, eliminatedPlayers);
}
async function sendFinalPodium(channel, livePlayers, eliminatedPlayers) {
  let podium = [];

  if (livePlayers.length >= 3) {
    podium = [...livePlayers.slice(-3)];
  } else if (livePlayers.length > 0) {
    podium = [...eliminatedPlayers.slice(-3 + livePlayers.length), ...livePlayers];
  } else {
    podium = eliminatedPlayers.slice(-3);
  }

  podium = podium.reverse(); // So 1st place is first in the embed

  const positions = ['🥇 **Winner**', '🥈 **2nd Place**', '🥉 **3rd Place**'];
  const podiumText = podium
    .map((player, index) => `${positions[index]} — <@${player}>`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎉 Final Podium 🎉')
    .setDescription(`${podiumText}\n\nLegends fall hard. Stay Ugly.`)
    .setColor('Gold');

  await channel.send({ embeds: [embed] });

  // Stat tracking
  for (let i = 0; i < podium.length; i++) {
    const playerId = podium[i];
    const user = await channel.guild.members.fetch(playerId).catch(() => null);
    if (user) {
      await updatePlayerStats(playerId, user.user.username, i === 0 ? 1 : 0, 0, 1); // 1 win only for 1st place
    }
  }
}
// Stat helpers
async function ensurePlayerRecord(userId, username) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    INSERT INTO player_stats (user_id, username, year, month, wins, revives, games_played, duel_wins)
    VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
    ON CONFLICT (user_id, year, month) DO NOTHING;
  `, [userId, username, year, month]);
}

async function updateStat(userId, field, amount = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    UPDATE player_stats
    SET ${field} = ${field} + $1
    WHERE user_id = $2 AND year = $3 AND month = $4;
  `, [amount, userId, year, month]);
}
for (const p of currentPlayers) {
  await ensurePlayerRecord(p.id, p.username);
  await updateStat(p.id, 'games_played');
}
await updateStat(winner.id, 'wins');
await updateStat(reviver.id, 'revives');
await updateStat(winner.id, 'duel_wins');
if (message.content === '!leaderboard') {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { rows: topWins } = await db.query(`
    SELECT username, wins FROM player_stats
    WHERE year = $1 AND month = $2
    ORDER BY wins DESC LIMIT 3;
  `, [year, month]);

  const { rows: topRevives } = await db.query(`
    SELECT username, revives FROM player_stats
    WHERE year = $1 AND month = $2
    ORDER BY revives DESC LIMIT 3;
  `, [year, month]);

  const { rows: topGames } = await db.query(`
    SELECT username, games_played FROM player_stats
    WHERE year = $1 AND month = $2
    ORDER BY games_played DESC LIMIT 3;
  `, [year, month]);

  const { rows: topDuels } = await db.query(`
    SELECT username, duel_wins FROM player_stats
    WHERE year = $1 AND month = $2
    ORDER BY duel_wins DESC LIMIT 3;
  `, [year, month]);

  const embed = new EmbedBuilder()
    .setTitle('📈 Monthly Leaderboard')
    .addFields(
      { name: '🏆 Most Wins', value: topWins.map((r, i) => `${i + 1}. ${r.username} — ${r.wins}`).join('\n') || 'No data', inline: true },
      { name: '🧟‍♂️ Most Revives', value: topRevives.map((r, i) => `${i + 1}. ${r.username} — ${r.revives}`).join('\n') || 'No data', inline: true },
      { name: '🎮 Most Games', value: topGames.map((r, i) => `${i + 1}. ${r.username} — ${r.games_played}`).join('\n') || 'No data', inline: true },
      { name: '⚔️ Duel Victories', value: topDuels.map((r, i) => `${i + 1}. ${r.username} — ${r.duel_wins}`).join('\n') || 'No data', inline: true }
    )
    .setColor(0x3498db);

  await message.channel.send({ embeds: [embed] });
}
previousGamePlayers = [...currentPlayers];
rematchVotes.clear();

if (consecutiveRestarts >= MAX_RESTARTS) {
  await channel.send('🛑 Auto-rematch limit reached. Please start a new game manually.');
  return;
}

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('rematch_vote')
    .setLabel('🔁 Rematch!')
    .setStyle(ButtonStyle.Success)
);

await channel.send({
  content: `🔁 Click below to queue a rematch! (${rematchVotes.size}/${Math.ceil(previousGamePlayers.length * 0.75)} needed)`,
  components: [row]
});
if (interaction.customId === 'rematch_vote') {
  if (!previousGamePlayers.find(p => p.id === interaction.user.id)) {
    await interaction.reply({ content: '🛑 Only players from the last game can vote for a rematch.', ephemeral: true });
    return;
  }

  if (rematchVotes.has(interaction.user.id)) {
    await interaction.reply({ content: '⚠️ You already voted to rematch.', ephemeral: true });
    return;
  }

  rematchVotes.add(interaction.user.id);
  await interaction.reply({ content: '✅ Your rematch vote has been counted!', ephemeral: true });

  const requiredVotes = Math.ceil(previousGamePlayers.length * 0.75);
  const voteCount = rematchVotes.size;

  const channel = interaction.channel;
  await channel.send(`🗳️ Rematch votes: ${voteCount}/${requiredVotes}`);

  if (voteCount >= requiredVotes) {
    consecutiveRestarts++;
    await channel.send('🎉 Rematch starting now!');
    setTimeout(() => {
      runGauntlet(channel, 3); // Assumes your main game function is `runGauntlet(channel, minutes)`
    }, 3000);
  }
}
else {
  try {
    await interaction.reply({ content: '❓ Unknown interaction. Please try again or contact the game host.', ephemeral: true });
  } catch (err) {
    console.error('❌ Failed to respond to unknown interaction:', err);
  }
}
currentPlayers = [];
eliminatedPlayers = [];
gameInProgress = false;
roundCount = 0;
mutationUsed = false;
reviveUsed = false;
bossPlayer = null;
activeLives = {};
massRevivalTriggered = false;
client.login(process.env.BOT_TOKEN);
