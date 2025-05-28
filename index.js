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
  SlashCommandBuilder,
  Collection
} = require('discord.js');
const axios = require('axios');
const { Client: PgClient } = require('pg');

// Image fallback URL
const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';
const OPENSEA_BASE_URL = 'https://opensea.io/assets/ethereum/0x9492505633d74451bdf3079c09ccc979588bc309/';

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
let entrants = [];
let eliminatedPlayers = [];
let revivedPlayers = [];
let gameInProgress = false;
let warpRunning = false;
let immunityPlayers = new Set();
let lastWarpRound = -1;
let currentRound = 0;
let bossVotes = {};
let trialMode = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getUglyImage(tokenId) {
  return {
    url: `${DEFAULT_IMAGE_BASE_URL}${tokenId}`,
    fallback: `${OPENSEA_BASE_URL}${tokenId}`
  };
}
// 🔥 Lore-Based Elimination Events
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
async function incrementStat(userId, username, stat, amount = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    INSERT INTO player_stats (user_id, username, year, month, ${stat})
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, year, month)
    DO UPDATE SET ${stat} = player_stats.${stat} + $5;
  `, [userId, username, year, month, amount]);
}

async function getMonthlyStats() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const res = await db.query(`
    SELECT * FROM player_stats WHERE year = $1 AND month = $2
  `, [year, month]);
  return res.rows;
}

async function getAllTimeStats() {
  const res = await db.query(`SELECT user_id, username,
    SUM(wins) AS wins, SUM(revives) AS revives, SUM(games_played) AS games_played
    FROM player_stats
    GROUP BY user_id, username
  `);
  return res.rows;
}

async function recordMonthlyChampion(userId, username, category, value) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    INSERT INTO monthly_champions (user_id, username, year, month, category, value)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, username, year, month, category, value]);
}
let devMode = false;
let eliminated = [];
let revivable = [];
let originalEntrants = [];
let bossPlayerId = null;

// Join system
async function createJoinEmbed(channel) {
  const joinEmbed = new EmbedBuilder()
    .setTitle("🩸 The Ugly Gauntlet Begins!")
    .setDescription(`<@${channel.client.user.id}> has summoned the Gauntlet!\nClick below to enter the arena.\n⏳ Game starts in 45 seconds...`)
    .setColor(0xff0000);

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [joinEmbed], components: [joinRow] });

  // Clear entrants after 45s
  setTimeout(async () => {
    if (entrants.length === 0) {
      await channel.send("⚠️ No one joined the Gauntlet in time. The arena closes.");
      gameInProgress = false;
    }
  }, 45000);
}

// Command triggers
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (content === '!gauntlet' && !gameInProgress) {
    gameInProgress = true;
    trialMode = false;
    devMode = false;
    entrants = [];
    eliminated = [];
    revivable = [];
    originalEntrants = [];
    await createJoinEmbed(message.channel);
  }

  if (content === '!gauntlettrial' && !gameInProgress) {
    gameInProgress = true;
    trialMode = true;
    devMode = false;
    entrants = generateTrialPlayers();
    eliminated = [];
    revivable = [];
    originalEntrants = [...entrants];
    await runBossVotePhase(message.channel);
  }

  if (content === '!gauntletdev' && !gameInProgress) {
    gameInProgress = true;
    trialMode = false;
    devMode = true;
    entrants = generateTrialPlayers();
    eliminated = [];
    revivable = [];
    originalEntrants = [...entrants];
    await runBossVotePhase(message.channel);
  }
});
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet') {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    if (!entrants.find(p => p.id === userId)) {
      entrants.push({ id: userId, username });
      await interaction.reply({ content: `🧟 You have entered the Gauntlet, <@${userId}>. Good luck...`, ephemeral: true });
    } else {
      await interaction.reply({ content: `⚠️ You're already in the Gauntlet.`, ephemeral: true });
    }
  }

  // Handle boss voting
  if (interaction.customId.startsWith('vote_boss_')) {
    const votedId = interaction.customId.replace('vote_boss_', '');
    bossVotes[interaction.user.id] = votedId;
    await interaction.reply({ content: `🗳️ Your vote for <@${votedId}> has been counted.`, ephemeral: true });
  }

  // Start game after join window
  if (interaction.customId === 'start_game' && entrants.length > 1) {
    originalEntrants = [...entrants];
    await runBossVotePhase(interaction.channel);
  }
});

// Run a random WARP event during a round (25% chance)
async function maybeRunWarpEvent(channel) {
  const chance = Math.random();
  if (chance < 0.25) {
    await runWarpEvent(channel);
    await delay(10000); // Wait 10s before continuing
  }
}

// Placeholder WARP Event
async function runWarpEvent(channel) {
  const warpMessages = [
    "**🌌 A WARP rift tears open mid-round… past and future collide!**",
    "**🌀 The timeline glitches. Some players feel… *different*.**",
    "**⚠️ WARP anomaly detected. Reality is no longer stable.**"
  ];
  const chosen = warpMessages[Math.floor(Math.random() * warpMessages.length)];

  const warpEmbed = new EmbedBuilder()
    .setTitle("🚨 WARP EVENT TRIGGERED")
    .setDescription(chosen)
    .setColor(0x9932cc);

  await channel.send({ embeds: [warpEmbed] });
}
async function runGauntlet(channel) {
  await delay(5000); // Extra time before first round

  while (entrants.length > 1) {
    await maybeRunWarpEvent(channel); // Chance of mid-game WARP Event

    // Skip if last 2 rounds had no eliminations
    if (skipRoundCount >= 2) break;

    const eliminated = [];

    const roundEmbed = new EmbedBuilder()
      .setTitle(`⚔️ The Gauntlet Round Begins`)
      .setDescription(`Who will survive this time?`)
      .setColor(0xff0000);

    const randomToken = Math.floor(Math.random() * 530) + 1;
    const imageUrl = `${DEFAULT_IMAGE_BASE_URL}${randomToken}.jpg`;

    try {
      await axios.get(imageUrl);
      roundEmbed.setImage(imageUrl);
    } catch {
      roundEmbed.setFooter({ text: "NFT image not found. Continuing round..." });
    }

    await channel.send({ embeds: [roundEmbed] });

    await delay(5000);

    const playersThisRound = [...entrants];
    const cut = Math.max(1, Math.floor(playersThisRound.length * 0.2));

    const unlucky = shuffleArray(playersThisRound).slice(0, cut);
    unlucky.forEach(player => {
      if (!player.lives || player.lives <= 1) {
        eliminated.push(player);
        entrants = entrants.filter(p => p.id !== player.id);
      } else {
        player.lives--;
      }
    });

    if (eliminated.length === 0) {
      skipRoundCount++;
    } else {
      skipRoundCount = 0;

      const eliminationLines = eliminated.map(p => {
        const line = Math.random() < 0.2
          ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
          : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];
        return `💀 <@${p.id}> ${line}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("☠️ Eliminations")
        .setDescription(eliminationLines.join("\n"))
        .setColor(0x8b0000);

      await channel.send({ embeds: [embed] });
    }

    await delay(7000); // Pause between rounds
  }

  await declareWinners(channel);
}
async function declareWinners(channel) {
  const podium = [...entrants].slice(0, 3);

  const embed = new EmbedBuilder()
    .setTitle("🏆 The Gauntlet Has Ended!")
    .setDescription(
      podium.length === 0
        ? "Nobody survived. The Gauntlet claims all."
        : podium.map((p, i) => {
            const medal = ["🥇", "🥈", "🥉"][i] || "🎖️";
            return `${medal} <@${p.id}>`;
          }).join("\n")
    )
    .setColor(0xffcc00);

  await channel.send({ embeds: [embed] });

  if (podium.length > 0) {
    await awardWinners(podium, channel);
  }

  entrants = [];
  skipRoundCount = 0;
}

async function awardWinners(podium, channel) {
  // Placeholder for reward logic if needed
  await delay(2000);
  const shoutout = podium.map((p, i) => `${["🥇", "🥈", "🥉"][i]} <@${p.id}>`).join(" ");
  await channel.send(`🎉 Congratulations to our champions: ${shoutout}`);
}

function revivePlayer(userId) {
  const player = { id: userId, lives: 1 };
  entrants.push(player);
}

function resetGame() {
  entrants = [];
  bossVotes = {};
  skipRoundCount = 0;
}
client.on('messageCreate', async message => {
  if (message.content === '!gauntlet') {
    if (isRunning) return message.reply('⛔ A game is already running.');
    isRunning = true;
    await message.channel.send(`@everyone\n<@${message.author.id}> has summoned the Gauntlet!\nClick below to enter the arena.\n⏳ Game starts in 45 seconds...`);

    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Danger)
    );
    const joinMsg = await message.channel.send({ content: "**Join the Gauntlet**", components: [joinRow] });

    const collector = joinMsg.createMessageComponentCollector({ time: 45000 });
    entrants = [];

    collector.on('collect', async i => {
      if (i.customId === 'join_gauntlet') {
        if (!entrants.find(e => e.id === i.user.id)) {
          entrants.push({ id: i.user.id, lives: 1 });
          await i.reply({ content: `🩸 <@${i.user.id}> has entered the Gauntlet...`, ephemeral: true });
        } else {
          await i.reply({ content: `You're already in, warrior.`, ephemeral: true });
        }
      }
    });

    collector.on('end', async () => {
      if (entrants.length < 2) {
        isRunning = false;
        return message.channel.send('⚠️ Not enough players to begin the Gauntlet.');
      }
      await runBossVotePhase(message.channel);
      await delay(5000);
      await runGauntlet(message.channel);
    });
  }

  if (message.content === '!gauntlettrial') {
    if (isRunning) return message.reply('⛔ A game is already running.');
    isRunning = true;
    entrants = [];
    for (let i = 1; i <= 20; i++) {
      entrants.push({
        id: `Trial${i}`,
        username: `Trial${i}`,
        lives: 1,
        isTrial: true
      });
    }

    await message.channel.send("🧪 Starting Gauntlet Trial Mode with 20 randomly generated test players...");
    await runBossVotePhase(message.channel);
    await delay(3000);
    await message.channel.send("⚠️ Trial mode complete. No eliminations will be run.");
    isRunning = false;
  }

  if (message.content === '!gauntletdev') {
    if (isRunning) return message.reply('⛔ A game is already running.');
    isRunning = true;
    entrants = [
      { id: message.author.id, lives: 1 },
      { id: 'Dev2', username: 'Dev2', lives: 1, isTrial: true },
      { id: 'Dev3', username: 'Dev3', lives: 1, isTrial: true }
    ];

    await message.channel.send("👾 Developer Test Mode Enabled.");
    await runBossVotePhase(message.channel);
    await delay(3000);
    await runGauntlet(message.channel);
  }
});
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const { customId, user } = interaction;

  // Boss Vote Handling
  if (customId.startsWith('vote_boss_')) {
    const votedId = customId.replace('vote_boss_', '');
    if (bossVotes[user.id]) {
      await interaction.reply({ content: '🛑 You already voted!', ephemeral: true });
    } else {
      bossVotes[user.id] = votedId;
      await interaction.reply({ content: `🗳️ Your vote for <@${votedId}> has been counted.`, ephemeral: true });
    }
    return;
  }

  // Example placeholder for future buttons like Curse Vote or Survival Defense
  if (customId.startsWith('vote_curse_')) {
    const voted = customId.replace('vote_curse_', '');
    if (curseVotes[user.id]) {
      await interaction.reply({ content: 'You already voted to curse someone! 😈', ephemeral: true });
    } else {
      curseVotes[user.id] = voted;
      await interaction.reply({ content: `Your curse vote for <@${voted}> has been recorded.`, ephemeral: true });
    }
    return;
  }

  if (customId === 'warp_vote_yes') {
    await interaction.reply({ content: `🌀 You voted YES to embrace the WARP.`, ephemeral: true });
    return;
  }

  if (customId === 'warp_vote_no') {
    await interaction.reply({ content: `🚫 You voted NO to resist the WARP.`, ephemeral: true });
    return;
  }

  // Add more interactive responses here for future buttons like totem revival, fate gambles, etc.
});
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    await db.connect();
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
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
});

// Bot Login
client.login(process.env.BOT_TOKEN);
