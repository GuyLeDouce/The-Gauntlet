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
        games_played INT DEFAULT 0
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
const PREFIX = '!';
const entrants = [];
let gameInProgress = false;
let eliminated = [];
let roundNumber = 0;
let bossLives = {};
let activeWarpEvent = false;
let revivalPool = [];
let fakeUsers = [];
let gauntletChannel = null;
let bossVotes = {};
let trialMode = false;

// Image URL
const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Shuffle helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random item
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}
const walletLinks = new Map(); // Maps userId to wallet
const playerStats = new Map(); // Tracks local game stats

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'linkwallet') {
    const wallet = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return message.reply('❌ Please enter a valid wallet address.');
    }
    walletLinks.set(message.author.id, wallet);
    return message.reply(`✅ Wallet linked to ${wallet}`);
  }
});
const eliminationEvents = [
  "tripped over a malformed meme and fell into the void.",
  "challenged the Gauntlet to a duel — and got ratio’d.",
  "was seen by the Eye of Ugly… and instantly combusted.",
  "pressed the wrong button. It said DO NOT PRESS.",
  "got caught trying to steal $CHARM from the boss chest.",
  "fell asleep mid-turn and got trampled by lore beasts.",
  "activated the cursed NFT and vanished into JPEG dust.",
  "got rugged by a fake revival totem.",
  "said 'it’s just a game' — the Gauntlet heard.",
  "bragged about surviving… then got instant karma’d.",
  "was eliminated by a dramatic flashback sequence.",
  "called the Gauntlet ‘just RNG’ and exploded.",
  "took a wrong turn at the Warp Gate and got glitched.",
  "put their trust in a Model. Rookie mistake.",
  "got meme’d so hard they respawned in a different timeline.",
  "stepped on a lore trap labeled ‘Definitely Safe.’",
  "offered friendship to the boss and got KO'd mid-hug.",
  "ate the last Monster Snack™ and was hunted for it.",
  "volunteered to check out the ‘Secret Round’… never returned.",
  "got distracted flexing in General Chat. Fatal."
];
const specialEliminations = [
  "was cursed by 🔮THE FORGOTTEN WHEEL🔮 — fate sealed.",
  "became a live poll. Lost the vote. 💔",
  "flexed their ugliest NFT… then combusted from admiration.",
  "was chosen as the sacrifice by a spectral $CHARM merchant.",
  "got booed off stage by ghosts of past holders 👻",
  "accidentally hit ‘Reply All’ on the death scroll 📜",
  "wore the forbidden skin combo. Banned by lore enforcement.",
  "got outed as a sleeper agent and eliminated in shame.",
  "challenged the audience to a 1v1. Got clapped. 🎮",
  "tried to gaslight the Boss. Got gaslit harder. 🔥",
  "opened a suspicious treasure chest. It was full of bees 🐝",
  "accidentally revived a cursed companion and got eaten.",
  "forgot the lore password and triggered the defense turrets.",
  "was deemed too sexy for survival 😩💅"
];
const revivalEvents = [
  "emerged from the Charmhole… dripping with vengeance.",
  "played dead for 3 rounds. It worked.",
  "offered a cursed NFT in trade… and it was accepted.",
  "was reassembled by malfunctioning lore robots.",
  "dreamed of winning, and it changed the code.",
  "was spotted by an ancient Ugly Dog and rescued.",
  "got pulled back by a sympathy vote from chat.",
  "said the magic phrase: ‘Stay Ugly.’",
  "traded 7 memes and 1 vibe. A fair deal.",
  "escaped limbo by drawing a perfect Squiggle.",
  "won a coin flip against the Gauntlet gods.",
  "tapped into forbidden Flex Energy and surged back online.",
  "was revived by a mysterious admin using backdoor lore.",
  "hijacked a rematch ritual and respawned early."
];
const reviveFailLines = [
  "tried to use a revival coupon… it was expired.",
  "rolled the dice of fate… and crit-failed.",
  "offered $CHARM… but it wasn’t enough. Not even close.",
  "shouted 'I still believe!' and got silence.",
  "was this close to revival… then sneezed and fell off.",
  "chose the fake totem and got absolutely baited.",
  "typed !revive in the wrong channel and died of shame.",
  "begged the Boss for mercy. Got roasted in lore instead.",
  "followed a revival tutorial from YouTube. Classic mistake.",
  "got rugged by a Ugly pretending to be a mod.",
  "mistook the Gauntlet for Goblintown. Perished instantly.",
  "insulted a meme god mid-revival chant.",
  "hit the button. Nothing happened. Then everything happened.",
  "unplugged their router during the ritual.",
  "accidentally revived someone else. Whoops.",
  "got confused by the UI and ragequit the afterlife.",
  "missed the timer by one second. The saddest second.",
  "called the game 'mid.' The code heard them."
];
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
if (command === 'gauntlettrial') {
    if (gameInProgress) {
      return message.reply('⚔️ A game is already in progress!');
    }

    trialMode = true;
    entrants.length = 0;
    eliminated.length = 0;
    roundNumber = 0;
    revivalPool.length = 0;
    bossLives = {};
    gauntletChannel = message.channel;
    gameInProgress = true;

    for (let i = 1; i <= 20; i++) {
      const fakeUser = {
        id: `Trial${i}`,
        username: `Trial${i}`,
        fake: true
      };
      fakeUsers.push(fakeUser);
      entrants.push(fakeUser);
    }

    await runBossVotePhase(message.channel);
    await delay(5000);
    await message.channel.send('🧪 Trial mode complete. No eliminations will be run.');
    gameInProgress = false;
  }
   if (message.content.toLowerCase() === '!gauntletdev' && message.author.id === process.env.OWNER_ID) {
    const devRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('dev_warp')
          .setLabel('Run WARP Event 🌌')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('dev_curse')
          .setLabel('Run Curse ⚠️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('dev_boon')
          .setLabel('Run Boon 🍀')
          .setStyle(ButtonStyle.Success)
      );

    const devEmbed = new EmbedBuilder()
      .setTitle('🔧 Gauntlet Dev Panel')
      .setDescription('Select an event to test.')
      .setColor(0x5555ff);

    await message.channel.send({ embeds: [devEmbed], components: [devRow] });
  }
});

});
  if (command === 'gauntletdev') {
    if (gameInProgress) {
      return message.reply('⚔️ A game is already in progress!');
    }

    trialMode = false;
    entrants.length = 0;
    eliminated.length = 0;
    roundNumber = 0;
    revivalPool.length = 0;
    fakeUsers = [];
    bossLives = {};
    gauntletChannel = message.channel;
    gameInProgress = true;

    for (let i = 1; i <= 20; i++) {
      const fakeUser = {
        id: `Dev${i}`,
        username: `Dev${i}`,
        fake: true
      };
      fakeUsers.push(fakeUser);
      entrants.push(fakeUser);
    }

    await runBossVotePhase(message.channel);
    await delay(5000);
    await startGauntlet(message.channel);
  }
  if (command === 'gauntlet') {
    if (gameInProgress) {
      return message.reply('⚔️ A game is already in progress!');
    }

    trialMode = false;
    entrants.length = 0;
    eliminated.length = 0;
    roundNumber = 0;
    revivalPool.length = 0;
    fakeUsers = [];
    bossLives = {};
    gauntletChannel = message.channel;
    gameInProgress = true;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle('The Ugly Gauntlet Begins!')
      .setDescription(`${message.author} has summoned the Gauntlet!\nClick below to enter the arena.\n⏳ Game starts in 45 seconds...`)
      .setColor(0xff0000);

    await message.channel.send({ embeds: [embed], components: [row] });

    setTimeout(() => startGauntlet(message.channel), 45000);
  }
// Handle join button interaction
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet') {
    const userId = interaction.user.id;
    if (gameInProgress && !trialMode && !entrants.some(p => p.id === userId)) {
      entrants.push({ id: userId, username: interaction.user.username });
      await interaction.reply({ content: `🛡️ <@${userId}> has joined The Gauntlet!`, ephemeral: true });
    } else {
      await interaction.reply({ content: `⚠️ You’re already in, or game hasn't started.`, ephemeral: true });
    }
  }

  if (interaction.customId.startsWith('vote_boss_')) {
    const targetId = interaction.customId.split('vote_boss_')[1];
    const voterId = interaction.user.id;
    bossVotes[voterId] = targetId;
    await interaction.reply({ content: `Your vote for <@${targetId}> has been counted.`, ephemeral: true });
  }

  if (interaction.customId === 'dev_warp') {
    await interaction.deferReply({ ephemeral: true });
    await runWarpEvent(interaction.channel);
    await interaction.editReply('🌌 WARP Event completed.');
  }

  if (interaction.customId === 'dev_curse') {
    await interaction.deferReply({ ephemeral: true });
    await curseRandomPlayer(interaction.channel);
    await interaction.editReply('⚠️ Random player cursed.');
  }

  if (interaction.customId === 'dev_boon') {
    await interaction.deferReply({ ephemeral: true });
    await boonRandomPlayer(interaction.channel);
    await interaction.editReply('🍀 Random player blessed.');
  }
});

});

// Run boss vote with embedded buttons
async function runBossVotePhase(channel) {
  bossVotes = {};
  const candidates = shuffleArray(entrants).slice(0, 5);

  const voteEmbed = new EmbedBuilder()
    .setTitle("👑 Choose the Boss Level Ugly")
    .setDescription("You have 15 seconds to vote!\nThe chosen one will receive **2 lives** in The Gauntlet.")
    .setColor(0xffaa00);

  const voteRow = new ActionRowBuilder();
  candidates.forEach((c) => {
    voteRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_boss_${c.id}`)
        .setLabel(`Vote ${c.username}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await channel.send({ embeds: [voteEmbed], components: [voteRow] });
  await delay(15000);

  const voteCounts = {};
  Object.values(bossVotes).forEach(id => {
    voteCounts[id] = (voteCounts[id] || 0) + 1;
  });

  const top = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
  const bossId = top ? top[0] : candidates[0].id;
  bossLives[bossId] = 2;

  await channel.send(`👑 <@${bossId}> has been chosen as **Boss Level Ugly** and now has **2 lives**!`);
}
async function startGauntlet(channel) {
  gameInProgress = true;
  trialMode = false;
  eliminated = [];
  bossLives = {};
  playerWins = {};
  currentRound = 0;

  const startEmbed = new EmbedBuilder()
    .setTitle("⚔️ The Ugly Gauntlet Begins!")
    .setDescription(`<@${channel.lastMessage?.mentions.users.first()?.id || 'Host'}> has summoned the Gauntlet!\nClick below to enter the arena.\n\n⏳ Game starts in **45 seconds**...`)
    .setColor(0xff0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Danger)
  );

  const startMsg = await channel.send({ embeds: [startEmbed], components: [row] });

  // Countdown before boss vote
  for (let i = 0; i < 45; i += 5) {
    await delay(5000);
    const remaining = 45 - i - 5;
    if (remaining > 0) {
      await channel.send(`⏳ **${remaining} seconds** left to join!`);
    }
  }

  await startMsg.edit({ components: [] });

  // Skip if no entrants
  if (entrants.length < 2) {
    await channel.send("❌ Not enough players joined to start the Gauntlet.");
    gameInProgress = false;
    return;
  }

  await runBossVotePhase(channel);
  await delay(3000);

  await channel.send(`🔥 **Let the eliminations begin!** Good luck, Uglies.`);

  // Game loop
  while (entrants.length > 1) {
    currentRound++;

    // Random Warped Event chance
    if (Math.random() < 0.25) {
      await runWarpEvent(channel);
      await delay(5000);
    }

    // Mutation Round chance
    if (Math.random() < 0.15) {
      await runMutationRound(channel);
      await delay(5000);
    }

    await delay(3000);
    await eliminateRandomPlayer(channel);
    await delay(3000);
  }

  // Show final podium
  await showFinalPodium(channel);
  gameInProgress = false;
}
async function runTrialGauntlet(channel) {
  gameInProgress = true;
  trialMode = true;
  eliminated = [];
  entrants = [];

  for (let i = 1; i <= 20; i++) {
    entrants.push({
      id: `Trial${i}`,
      username: `Trial${i}`,
      isFake: true
    });
  }

  await channel.send("🧪 Starting Gauntlet Trial Mode with 20 randomly generated test players...");
  await delay(2000);
  await runBossVotePhase(channel);
  await delay(3000);

  await channel.send("✅ Trial mode complete. No eliminations will be run.");
  gameInProgress = false;
}
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'gauntlet') {
    if (gameInProgress) return message.reply('⚔️ A Gauntlet is already in progress.');
    await startGauntlet(message.channel, message.author);
  }

  if (command === 'gauntlettrial') {
    if (gameInProgress) return message.reply('⚔️ A Gauntlet is already in progress.');
    await runTrialGauntlet(message.channel);
  }

  if (command === 'gauntletdev') {
    if (gameInProgress) return message.reply('⚔️ A Gauntlet is already in progress.');
    devMode = true;
    await startGauntlet(message.channel, message.author);
  }
});
async function startGauntlet(channel, hostUser) {
  gameInProgress = true;
  entrants = [];
  eliminated = [];
  currentRound = 0;
  lastEliminated = [];
  revivalsThisRound = 0;

  const joinEmbed = new EmbedBuilder()
    .setTitle('The Ugly Gauntlet Begins!')
    .setDescription(`${hostUser} has summoned the Gauntlet!\nClick below to enter the arena.\n\n⏳ Game starts in 45 seconds...`)
    .setColor(0xff0000);

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Danger)
  );

  const joinMessage = await channel.send({ embeds: [joinEmbed], components: [joinRow] });

  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 45000,
  });

  collector.on('collect', async interaction => {
    if (interaction.customId === 'join_gauntlet') {
      const userId = interaction.user.id;
      if (!entrants.find(e => e.id === userId)) {
        entrants.push({
          id: userId,
          username: interaction.user.username,
          lives: 1,
          revived: 0,
        });
      }
      await interaction.reply({ content: `⚔️ You have entered the Gauntlet!`, ephemeral: true });
    }
  });

  collector.on('end', async () => {
    await channel.send(`🔥 The Gauntlet has begun with **${entrants.length}** players!`);
    await runBossVotePhase(channel);
  });
}
async function runTrialGauntlet(channel) {
  gameInProgress = true;
  entrants = [];
  eliminated = [];
  currentRound = 0;
  lastEliminated = [];
  revivalsThisRound = 0;

  const trialEmbed = new EmbedBuilder()
    .setTitle('Starting Gauntlet Trial Mode')
    .setDescription('🔬 20 randomly generated test players will enter the arena...')
    .setColor(0x00ffcc);
  await channel.send({ embeds: [trialEmbed] });

  // Create 20 fake players
  for (let i = 1; i <= 20; i++) {
    const id = `Trial${i}`;
    entrants.push({
      id,
      username: `Trial${i}`,
      lives: 1,
      revived: 0,
      isFake: true
    });
  }

  await delay(2000);
  await runBossVotePhase(channel);
}
async function runBossVotePhase(channel) {
  bossVotes = {};
  const candidates = shuffleArray(entrants).slice(0, 5);

  const voteEmbed = new EmbedBuilder()
    .setTitle("👑 Choose the Boss Level Ugly")
    .setDescription("You have 15 seconds to vote!\nThe chosen one will receive **2 lives** in The Gauntlet.")
    .setColor(0xffaa00);

  const voteRow = new ActionRowBuilder();
  candidates.forEach((c) => {
    voteRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_boss_${c.id}`)
        .setLabel(`Vote ${c.username}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await channel.send({ embeds: [voteEmbed], components: [voteRow] });

  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 15000
  });

  collector.on('collect', async (interaction) => {
    if (!interaction.customId.startsWith('vote_boss_')) return;
    const votedId = interaction.customId.replace('vote_boss_', '');
    bossVotes[votedId] = (bossVotes[votedId] || 0) + 1;
    await interaction.reply({ content: `🗳️ Your vote for <@${votedId}> has been counted.`, ephemeral: true });
  });

  collector.on('end', async () => {
    const winnerId = Object.keys(bossVotes).reduce((a, b) => bossVotes[a] > bossVotes[b] ? a : b);
    const boss = entrants.find(e => e.id === winnerId);
    if (boss) boss.lives = 2;

    const resultEmbed = new EmbedBuilder()
      .setTitle("👑 Boss Level Ugly Chosen!")
      .setDescription(`<@${boss.id}> has been chosen and now has **2 lives**!`)
      .setColor(0xffcc00);

    await channel.send({ embeds: [resultEmbed] });
    await delay(3000);
    await startGauntlet(channel);
  });
}
async function startGauntlet(channel) {
  isGameRunning = true;
  eliminatedPlayers = [];
  roundNumber = 1;
  let players = [...entrants];

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle("🩸 The Ugly Gauntlet Begins!")
      .setDescription(`Prepare yourselves...\nOnly the ugliest will survive.`)
      .setColor(0xff0000)]
  });

  await delay(5000);

  while (players.length > 1 && isGameRunning) {
    // Random chance to trigger a WARP event
    if (Math.random() < 0.18) {
      await runWarpEvent(channel, players);
      await delay(10000); // pause after WARP
    }

    await runEliminationRound(channel, players);
    await delay(10000); // short pause before next round
    roundNumber++;

    // Trigger Totem of Lost Souls if ≤ 1/3 remain
    if (!revivalTriggered && players.length <= Math.floor(entrants.length / 3)) {
      await triggerMassRevival(channel, players);
    }

    // Edge case: if no players left (all eliminated)
    if (players.length === 0) {
      players = pickTop3FromEliminated();
      break;
    }
  }

  await declareWinners(channel, players);
  isGameRunning = false;
}
async function runEliminationRound(channel, players) {
  const embed = new EmbedBuilder().setColor(0xff5555);

  // Pick how many to eliminate this round (1–3)
  const numToEliminate = Math.min(
    Math.floor(Math.random() * 3) + 1,
    players.length
  );

  const eliminated = [];
  for (let i = 0; i < numToEliminate; i++) {
    const unlucky = players.splice(Math.floor(Math.random() * players.length), 1)[0];
    eliminated.push(unlucky);
    eliminatedPlayers.push(unlucky);
  }

  // Pick a random Ugly NFT image
  const tokenId = Math.floor(Math.random() * 530) + 1;
  const imgUrl = `${IMAGE_BASE_URL}${tokenId}.jpg`;

  embed.setTitle(`⚔️ Round ${roundNumber} Results`);
  embed.setDescription(`💀 **Eliminated this round:**\n${eliminated.map(p => `<@${p.id}>`).join("\n")}`);
  embed.setImage(imgUrl);

  await channel.send({ embeds: [embed] });
}
async function triggerMassRevival(channel, originalCount) {
  if (massRevivalTriggered || entrants.length > Math.floor(originalCount / 2)) return;

  massRevivalTriggered = true;
  const eliminatedIds = eliminatedPlayers.map(p => p.id);
  const allUsers = await channel.guild.members.fetch();
  const nonEntrants = allUsers.filter(m => !entrants.some(e => e.id === m.id) && !eliminatedIds.includes(m.id)).map(m => ({ id: m.user.id, username: m.user.username }));

  const embed = new EmbedBuilder()
    .setTitle("💀 Totem of Lost Souls Appears")
    .setDescription("Eliminated players and wandering souls may attempt revival.\nClick within **10 seconds** to offer your soul.")
    .setColor(0x8f00ff);

  const totemButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('totem_attempt')
      .setLabel('🪦 Attempt Revival')
      .setStyle(ButtonStyle.Danger)
  );

  const message = await channel.send({ embeds: [embed], components: [totemButton] });

  const collector = message.createMessageComponentCollector({ time: 10000 });
  const attempted = new Set();
  const revived = [];

  collector.on('collect', async i => {
    if (!attempted.has(i.user.id)) {
      attempted.add(i.user.id);
      const isEliminated = eliminatedIds.includes(i.user.id);
      const chance = isEliminated ? 0.5 : 0.4;
      const roll = Math.random();
      if (roll < chance) {
        entrants.push({ id: i.user.id, username: i.user.username });
        revived.push(`<@${i.user.id}> ✅`);
      } else {
        revived.push(`<@${i.user.id}> ❌`);
      }
      await i.reply({ content: 'The totem has heard you...', ephemeral: true });
    }
  });

  collector.on('end', async () => {
    const resultEmbed = new EmbedBuilder()
      .setTitle("⚖️ Totem Judgement")
      .setDescription(revived.length > 0 ? revived.join('\n') : "No souls returned...")
      .setColor(0x5500aa);
    await channel.send({ embeds: [resultEmbed] });
  });
}
async function declareWinners(channel) {
  const top3 = entrants.slice(0, 3);

  let podiumDescription = '';
  if (top3.length === 0) {
    podiumDescription = '☠️ No one survived The Gauntlet.\nThe arena claims all.';
  } else {
    podiumDescription = top3.map((player, index) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `${medals[index]} <@${player.id}>`;
    }).join('\n');
  }

  const podiumEmbed = new EmbedBuilder()
    .setTitle('🏆 Final Podium')
    .setDescription(podiumDescription)
    .setColor(0xffd700);

  await channel.send({ embeds: [podiumEmbed] });

  // Record winners in DB
  for (let i = 0; i < top3.length; i++) {
    const player = top3[i];
    await updatePlayerStats(player.id, player.username, { wins: i === 0 ? 1 : 0, games_played: 1 });
  }

  // Reset game state
  entrants = [];
  eliminatedPlayers = [];
  usedTraps.clear();
  trapImmunities.clear();
  mutationImmunities.clear();
  cursedPlayers.clear();
  revivedThisRound.clear();
  audienceVoteActive = false;
  gauntletActive = false;
  currentChannel = null;
  massRevivalTriggered = false;
}
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);
