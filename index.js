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

const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// PostgreSQL setup
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
// === GLOBAL STATE ===
let entrants = [];
let eliminated = [];
let trialMode = false;
let revivalUsed = false;
let joinMessage = null;
let bossVotes = {};
let currentGameGuild = null;
let gameInProgress = false;
let originalEntrantCount = 0;

// === HELPER FUNCTIONS ===
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function formatLeaderboardEmbed(title, fields, color = 0xffc300) {
  return new EmbedBuilder().setTitle(title).addFields(fields).setColor(color);
}

function getUglyImageUrl(tokenId) {
  return `${DEFAULT_IMAGE_BASE_URL}${tokenId}.jpg`;
}
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
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (content === '!gauntlet' && !gameInProgress) {
    entrants = [];
    eliminated = [];
    revivalUsed = false;
    trialMode = false;
    currentGameGuild = message.guild;
    gameInProgress = true;
    originalEntrantCount = 0;
    await startJoinPhase(message.channel);
  }

  if (content === '!gauntlettrial' && !gameInProgress) {
    entrants = generateTrialPlayers(20);
    eliminated = [];
    trialMode = true;
    revivalUsed = false;
    gameInProgress = true;
    originalEntrantCount = entrants.length;
    await runBossVotePhase(message.channel);
    await delay(5000);
    await message.channel.send('Trial mode complete. No eliminations will be run.');
    gameInProgress = false;
  }

  if (content === '!revive') {
    const userId = message.author.id;
    if (!eliminated.find(e => e.id === userId)) {
      return message.reply("You're not eliminated... yet.");
    }

    if (Math.random() < 0.01) {
      entrants.push({ id: userId, username: formatUsername(message.author) });
      eliminated = eliminated.filter(e => e.id !== userId);
      return message.reply("💀 Against all odds, you've crawled back from the void...");
    } else {
      return message.reply("😵 Your body twitched... but the Gauntlet rejected your return.");
    }
  }

  if (content === '!leaderboard' || content === '!lb') {
    await sendLeaderboardEmbed(message.channel);
  }

  if (content.startsWith('!stats')) {
    const mention = message.mentions.users.first();
    const target = mention || message.author;
    await sendPlayerStatsEmbed(message.channel, target);
  }

  if (content === '!lockchampions' && message.member.permissions.has("Administrator")) {
    await lockMonthlyChampions(message.channel);
  }
});
async function startJoinPhase(channel) {
  const joinEmbed = new EmbedBuilder()
    .setTitle("The Ugly Gauntlet Begins!")
    .setDescription(`<@${channel.client.user.id}> has summoned the Gauntlet!\nClick below to enter the arena.\n\n⏳ Game starts in 45 seconds...`)
    .setColor(0xff0000);

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Danger)
  );

  joinMessage = await channel.send({ embeds: [joinEmbed], components: [joinButton] });

  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 45000
  });

  collector.on('collect', async i => {
    if (i.customId === 'join_gauntlet') {
      const userId = i.user.id;
      const username = formatUsername(i.user);
      if (!entrants.find(e => e.id === userId)) {
        entrants.push({ id: userId, username });
        await i.reply({ content: `🗡️ ${username} has entered The Gauntlet!`, ephemeral: true });
      } else {
        await i.reply({ content: "You're already in!", ephemeral: true });
      }
    }
  });

  collector.on('end', async () => {
    originalEntrantCount = entrants.length;
    if (entrants.length < 2) {
      await channel.send("⚠️ Not enough players to start the Gauntlet.");
      gameInProgress = false;
      return;
    }
    await runBossVotePhase(channel);
    await delay(3000);
    await runGauntlet(channel);
  });
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

  const voteMessage = await channel.send({ embeds: [voteEmbed], components: [voteRow] });

  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 15000
  });

  collector.on('collect', async i => {
    if (i.customId.startsWith('vote_boss_')) {
      const votedId = i.customId.split('vote_boss_')[1];
      bossVotes[votedId] = (bossVotes[votedId] || 0) + 1;
      await i.reply({ content: `Your vote for <@${votedId}> has been counted.`, ephemeral: true });
    }
  });

  collector.on('end', async () => {
    const sorted = Object.entries(bossVotes).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      await channel.send("⚠️ No votes were cast. No boss was chosen.");
      return;
    }

    const [chosenId] = sorted[0];
    const chosen = entrants.find(e => e.id === chosenId);
    if (chosen) {
      chosen.lives = 2;
      await channel.send(`<@${chosenId}> has been chosen as Boss Level Ugly and now has 2 lives!`);
    }
  });
}
async function runGauntlet(channel) {
  while (entrants.length > 1) {
    // 🔮 Random chance for WARP Event (not always)
    if (Math.random() < 0.2) {
      await runWarpEvent(channel);
      await delay(11000);
    }

    // 🧬 Mutation Round trigger
    if (Math.random() < 0.15) {
      await runMutationRound(channel);
      await delay(10000);
    }

    const eliminatedPlayer = getRandomItem(entrants);
    const imageId = Math.floor(Math.random() * 530) + 1;

    // 📸 NFT Embed
    const embed = new EmbedBuilder()
      .setTitle(`☠️ ${eliminatedPlayer.username} has fallen`)
      .setImage(getUglyImageUrl(imageId))
      .setColor(0x8b0000);

    await channel.send({ embeds: [embed] });

    eliminated.push(eliminatedPlayer);
    entrants = entrants.filter(e => e.id !== eliminatedPlayer.id);

    await delay(6000); // Add time between rounds

    // Totem of Lost Souls revival logic
    if (!revivalUsed && entrants.length <= Math.floor(originalEntrantCount / 3)) {
      revivalUsed = true;
      await triggerTotemOfLostSouls(channel);
      await delay(6000);
    }
  }

  await announceWinners(channel);
  resetGameState();
}
async function triggerTotemOfLostSouls(channel) {
  const eliminatedIds = eliminated.map(e => e.id);
  const nonEntrants = (await channel.guild.members.fetch())
    .filter(m => !m.user.bot && !entrants.find(e => e.id === m.id) && !eliminatedIds.includes(m.id))
    .map(m => m.user);

  const embed = new EmbedBuilder()
    .setTitle("💀 The Totem of Lost Souls has appeared...")
    .setDescription("Eliminated players and outsiders may attempt a revival.\nClick quickly to grasp your second chance.")
    .setColor(0x9932cc);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('totem_attempt')
      .setLabel('Attempt Revival')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const attempts = [];
  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 4000
  });

  collector.on('collect', async i => {
    if (!attempts.find(a => a.id === i.user.id)) {
      attempts.push({ id: i.user.id, username: formatUsername(i.user) });
    }
    await i.deferUpdate();
  });

  collector.on('end', async () => {
    const results = [];
    for (let user of attempts) {
      const alreadyIn = entrants.find(e => e.id === user.id);
      if (alreadyIn) continue;

      const wasEliminated = eliminated.find(e => e.id === user.id);
      const chance = wasEliminated ? 0.5 : 0.4;

      if (Math.random() < chance) {
        entrants.push(user);
        if (wasEliminated) {
          eliminated = eliminated.filter(e => e.id !== user.id);
        }
        results.push(`✅ <@${user.id}> was **revived**!`);
      } else {
        results.push(`❌ <@${user.id}> **failed** to return.`);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("☠️ Totem Judgment")
      .setDescription(results.length > 0 ? results.join("\n") : "No one dared attempt revival.")
      .setColor(0x7f00ff);

    await channel.send({ embeds: [resultEmbed] });
  });
}

async function announceWinners(channel) {
  const top3 = [...entrants].concat(eliminated.slice(-2)).reverse().slice(0, 3);
  const podium = top3.map((p, i) => `🥇🥈🥉`.charAt(i) + ` <@${p.id}> — ${p.username}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏆 The Final Podium")
    .setDescription(podium || "No survivors... The Gauntlet claimed all.")
    .setColor(0x00ff88);

  await channel.send({ embeds: [embed] });

  for (let winner of top3) {
    await updatePlayerStats(winner.id, winner.username, i === 0 ? 1 : 0, 0, 1);
  }
}

function resetGameState() {
  entrants = [];
  eliminated = [];
  gameInProgress = false;
  trialMode = false;
  bossVotes = {};
  joinMessage = null;
  originalEntrantCount = 0;
}
async function runMutationRound(channel) {
  const mutationTypes = [
    {
      title: "🧬 Mutation: Delayed Reflexes",
      description: "Last to click the button is eliminated! You have 10 seconds.",
      buttonLabel: "React Quickly",
      successCondition: (responses) => responses.sort((a, b) => a.timestamp - b.timestamp)
    },
    {
      title: "🧬 Mutation: Hidden Trap",
      description: "Clicking the button triggers a trap. Don't click!",
      buttonLabel: "Click Me",
      successCondition: (responses) => [] // Everyone who clicked is eliminated
    },
    {
      title: "🧬 Mutation: Immunity Serum",
      description: "First 3 to click gain immunity next round.",
      buttonLabel: "Inject Serum",
      successCondition: (responses) => responses.slice(0, 3)
    }
  ];

  const mutation = getRandomItem(mutationTypes);

  const embed = new EmbedBuilder()
    .setTitle(mutation.title)
    .setDescription(mutation.description)
    .setColor(0x33ccff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mutation_click')
      .setLabel(mutation.buttonLabel)
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await channel.send({ embeds: [embed], components: [row] });

  const responses = [];
  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 10000
  });

  collector.on('collect', async i => {
    if (!responses.find(r => r.id === i.user.id)) {
      responses.push({ id: i.user.id, username: formatUsername(i.user), timestamp: Date.now() });
    }
    await i.deferUpdate();
  });

  collector.on('end', async () => {
    const affected = mutation.successCondition(responses);
    const eliminatedIds = [];

    if (mutation.title.includes("Delayed Reflexes") && responses.length > 0) {
      const last = responses[responses.length - 1];
      const player = entrants.find(e => e.id === last.id);
      if (player) {
        entrants = entrants.filter(e => e.id !== player.id);
        eliminated.push(player);
        eliminatedIds.push(player.username);
      }
    }

    if (mutation.title.includes("Hidden Trap")) {
      for (const r of responses) {
        const player = entrants.find(e => e.id === r.id);
        if (player) {
          entrants = entrants.filter(e => e.id !== r.id);
          eliminated.push(player);
          eliminatedIds.push(player.username);
        }
      }
    }

    if (mutation.title.includes("Immunity Serum")) {
      for (const p of affected) {
        const player = entrants.find(e => e.id === p.id);
        if (player) {
          player.immune = true;
        }
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("⚠️ Mutation Round Results")
      .setDescription(eliminatedIds.length
        ? `Eliminated:\n${eliminatedIds.join('\n')}`
        : `No eliminations this round.`)
      .setColor(0xcc3300);

    await channel.send({ embeds: [resultEmbed] });
  });
}

async function runWarpEvent(channel) {
  const warpScenarios = [
    {
      title: "🌀 WARP: The Floor is Lava",
      description: "Jump to safety! First 3 to click survive, the rest face danger.",
      buttonLabel: "Leap Now",
      survivors: 3
    },
    {
      title: "🌀 WARP: Lightning Round",
      description: "Quick! Only the first to click avoids elimination!",
      buttonLabel: "Dodge Lightning",
      survivors: 1
    },
    {
      title: "🌀 WARP: The Great Hide",
      description: "Click to hide. Those who don’t click are spotted and removed!",
      buttonLabel: "Hide",
      inverted: true
    }
  ];

  const event = getRandomItem(warpScenarios);

  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setDescription(event.description)
    .setColor(0x5500cc);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('warp_click')
      .setLabel(event.buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const responses = [];
  const collector = channel.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 8000
  });

  collector.on('collect', async i => {
    if (!responses.find(r => r.id === i.user.id)) {
      responses.push({ id: i.user.id, username: formatUsername(i.user) });
    }
    await i.deferUpdate();
  });

  collector.on('end', async () => {
    let eliminatedIds = [];

    if (event.inverted) {
      const safeIds = responses.map(r => r.id);
      const doomed = entrants.filter(e => !safeIds.includes(e.id));
      eliminatedIds = doomed.map(d => d.username);
      entrants = entrants.filter(e => safeIds.includes(e.id));
      eliminated.push(...doomed);
    } else if (event.survivors) {
      const safe = responses.slice(0, event.survivors).map(r => r.id);
      const doomed = entrants.filter(e => !safe.includes(e.id));
      eliminatedIds = doomed.map(d => d.username);
      entrants = entrants.filter(e => safe.includes(e.id));
      eliminated.push(...doomed);
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("🌪️ WARP Event Results")
      .setDescription(eliminatedIds.length
        ? `Eliminated:\n${eliminatedIds.join('\n')}`
        : `No one was harmed... this time.`)
      .setColor(0xaa00aa);

    await channel.send({ embeds: [resultEmbed] });
  });
}

// 📊 Update player stats in database
async function updatePlayerStats(userId, username, wins = 0, revives = 0, games = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const res = await db.query(
    `SELECT * FROM player_stats WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, year, month]
  );

  if (res.rows.length > 0) {
    await db.query(
      `UPDATE player_stats SET
        wins = wins + $1,
        revives = revives + $2,
        games_played = games_played + $3
       WHERE user_id = $4 AND year = $5 AND month = $6`,
      [wins, revives, games, userId, year, month]
    );
  } else {
    await db.query(
      `INSERT INTO player_stats (user_id, username, year, month, wins, revives, games_played)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, year, month, wins, revives, games]
    );
  }
}
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ✅ Trial Mode (simulate only)
  if (message.content === '!gauntlettrial' && !gameInProgress) {
    gameInProgress = true;
    trialMode = true;

    entrants = Array.from({ length: 20 }).map((_, i) => ({
      id: `Trial${i + 1}`,
      username: `Trial${i + 1}`
    }));

    originalEntrantCount = entrants.length;

    const embed = new EmbedBuilder()
      .setTitle("🎲 Starting Gauntlet Trial Mode")
      .setDescription("20 randomly generated test players have entered the arena.\nThis is a simulated run — no real eliminations.")
      .setColor(0x6699ff);

    await message.channel.send({ embeds: [embed] });

    await runBossVotePhase(message.channel);

    const waitEmbed = new EmbedBuilder()
      .setDescription("✅ Trial mode complete. No eliminations will be run.")
      .setColor(0x999999);
    await message.channel.send({ embeds: [waitEmbed] });

    gameInProgress = false;
    return;
  }

  // 🗡️ Real Game Mode
  if (message.content === '!gauntlet' && !gameInProgress) {
    gameInProgress = true;
    trialMode = false;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🗡️ The Ugly Gauntlet Begins!")
      .setDescription(`<@${message.author.id}> has summoned the Gauntlet!\nClick below to enter the arena.\n⏳ Game starts in 45 seconds...`)
      .setColor(0xff5555);

    joinMessage = await message.channel.send({ embeds: [embed], components: [row] });

    setTimeout(() => startGame(message.channel), 45000);
  }
});
async function startGame(channel) {
  if (trialMode) return; // skip real game logic

  // Store the players from join button
  const messages = await channel.messages.fetch({ limit: 50 });
  const latestJoin = messages.find(m => m.id === joinMessage?.id);
  if (!latestJoin) return;

  const joinCollector = latestJoin.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: 10000 // Short buffer before starting officially
  });

  joinCollector.on('collect', async i => {
    if (!entrants.find(e => e.id === i.user.id)) {
      entrants.push({ id: i.user.id, username: formatUsername(i.user) });
      await i.reply({ content: `✅ You’ve joined the Gauntlet, <@${i.user.id}>!`, ephemeral: true });
    } else {
      await i.reply({ content: `⚔️ You’re already in the Gauntlet.`, ephemeral: true });
    }
  });

  joinCollector.on('end', async () => {
    originalEntrantCount = entrants.length;

    if (entrants.length < 3) {
      await channel.send("🚫 Not enough players to begin the Gauntlet. Try again with at least 3!");
      resetGameState();
      return;
    }

    await channel.send(`🧠 ${entrants.length} players have entered. Let the judgment begin!`);
    await runBossVotePhase(channel);

    await delay(5000);
    await runGauntlet(channel);
  });
}
async function runGauntlet(channel) {
  while (entrants.length > 1) {
    // 🌀 Chance for WARP Event mid-round
    if (Math.random() < 0.2) {
      await runWarpEvent(channel);
      await delay(11000);
    }

    // 🧬 Mutation Round
    if (Math.random() < 0.15) {
      await runMutationRound(channel);
      await delay(10000);
    }

    const eliminatedPlayer = getRandomItem(entrants);
    const imageId = Math.floor(Math.random() * 530) + 1;

    const embed = new EmbedBuilder()
      .setTitle(`☠️ ${eliminatedPlayer.username} has fallen`)
      .setImage(getUglyImageUrl(imageId))
      .setColor(0x8b0000);

    await channel.send({ embeds: [embed] });

    eliminated.push(eliminatedPlayer);
    entrants = entrants.filter(e => e.id !== eliminatedPlayer.id);

    await delay(6000); // Delay between rounds

    // ☠️ Totem mass revival trigger
    if (!revivalUsed && entrants.length <= Math.floor(originalEntrantCount / 3)) {
      revivalUsed = true;
      await triggerTotemOfLostSouls(channel);
      await delay(6000);
    }
  }

  await announceWinners(channel);
  resetGameState();
}
async function triggerTotemOfLostSouls(channel) {
  const imageId = Math.floor(Math.random() * 530) + 1;

  const embed = new EmbedBuilder()
    .setTitle("💀 Totem of Lost Souls Awakens")
    .setDescription("Eliminated and lurking spectators may now **click below** to attempt a cursed revival...\nYou have 10 seconds.")
    .setImage(getUglyImageUrl(imageId))
    .setColor(0xaa00ff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('totem_revive')
      .setLabel('⚡ Touch the Totem')
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await channel.send({ embeds: [embed], components: [row] });

  const collector = message.createMessageComponentCollector({ time: 10000 });

  const attempted = [];

  collector.on('collect', async i => {
    if (!eliminated.find(e => e.id === i.user.id) && !entrants.find(e => e.id === i.user.id)) {
      attempted.push({ user: i.user, eligible: true }); // new player
    } else if (eliminated.find(e => e.id === i.user.id)) {
      attempted.push({ user: i.user, eligible: false }); // eliminated
    }
    await i.deferUpdate();
  });

  collector.on('end', async () => {
    const revived = [];
    const failed = [];

    for (const attempt of attempted) {
      const chance = attempt.eligible ? 0.4 : 0.5;
      const roll = Math.random();
      const name = formatUsername(attempt.user);

      if (roll < chance) {
        entrants.push({ id: attempt.user.id, username: name });
        revived.push(name);
      } else {
        failed.push(name);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("🔮 Totem Judgment")
      .setDescription(`Revived: ${revived.length > 0 ? revived.join(', ') : 'None'}\nFailed: ${failed.length > 0 ? failed.join(', ') : 'None'}`)
      .setColor(0xdd33aa);
    await channel.send({ embeds: [resultEmbed] });
  });
}

async function announceWinners(channel) {
  const top3 = eliminated.slice(-2).concat(entrants[0] ? [entrants[0]] : []);
  const podium = top3.reverse();

  const embed = new EmbedBuilder()
    .setTitle("🏁 Final Standings — Ugly Gauntlet")
    .setDescription(
      `🥇 ${podium[0] ? podium[0].username : "None"}\n` +
      `🥈 ${podium[1] ? podium[1].username : "None"}\n` +
      `🥉 ${podium[2] ? podium[2].username : "None"}`
    )
    .setColor(0xffd700);

  await channel.send({ embeds: [embed] });
}
async function runWarpEvent(channel) {
  const events = [
    {
      title: "⛓️ WARPED ALLIANCE",
      desc: "Two random Uglies form an unlikely pact.\nIf one falls in the next round, the other will follow...",
      effect: async () => {
        const [a, b] = shuffleArray(entrants).slice(0, 2);
        if (!a || !b) return;

        channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🤝 A Pact is Formed")
            .setDescription(`If either <@${a.id}> or <@${b.id}> falls in the next round, the other shall perish too.`)
            .setColor(0x8888ff)]
        });

        // Store pact for next round effect
        activePacts.push([a.id, b.id]);
      }
    },
    {
      title: "🧿 CHAOS PROPHECY",
      desc: "An old Ugly prophecy whispers a cursed name. Will it be self-fulfilling?",
      effect: async () => {
        const cursed = getRandomItem(entrants);
        if (!cursed) return;

        channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🔮 Prophecy Revealed")
            .setDescription(`<@${cursed.id}> was named by the prophecy.\nThey feel the cold hand of fate creeping...`)
            .setColor(0xcc0099)]
        });

        cursedByProphecy = cursed.id;
      }
    },
    {
      title: "📦 RANDOM ITEM DROP",
      desc: "A mysterious crate crashes into the arena. Only one Ugly may open it...",
      effect: async () => {
        const rewarded = getRandomItem(entrants);
        if (!rewarded) return;

        channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("📦 Loot Crate")
            .setDescription(`<@${rewarded.id}> found a glowing charm. They will survive the next elimination!`)
            .setColor(0x00ff99)]
        });

        immunitySet.add(rewarded.id);
      }
    }
  ];

  const event = getRandomItem(events);
  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setDescription(event.desc)
    .setColor(0xff33aa);

  await channel.send({ embeds: [embed] });
  await event.effect();
}

function formatUsername(user) {
  return user.username?.length > 16 ? user.username.slice(0, 16) + '…' : user.username;
}

// 🧪 NFT Image Fallback
function getUglyImageUrl(tokenId) {
  return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}.jpg`;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetGameState() {
  entrants = [];
  eliminated = [];
  revivalUsed = false;
  joinMessage = null;
  trialMode = false;
  activePacts = [];
  immunitySet = new Set();
  cursedByProphecy = null;
}
client.on('messageCreate', async (message) => {
  if (message.content === '!gauntletdev') {
    const allowedUserId = '826581856400179210'; // replace with your ID

    if (message.author.id !== allowedUserId) {
      return message.reply("⛔ This command is restricted.");
    }

    const channel = message.channel;

    // Create 10 mock users
    entrants = Array.from({ length: 10 }, (_, i) => ({
      id: `Dev${i + 1}`,
      username: `Dev${i + 1}`
    }));

    eliminated = [];
    originalEntrantCount = entrants.length;
    revivalUsed = false;
    trialMode = false;
    activePacts = [];
    immunitySet = new Set();
    cursedByProphecy = null;

    await channel.send(`🧪 Developer Gauntlet Starting with 10 mock Uglies...`);
    await runBossVotePhase(channel);

    // Simulate random vote clicks
    await delay(3000);
    const fakeVote = getRandomItem(entrants);
    await channel.send(`🤖 Simulated vote for Boss: ${fakeVote.username}`);
    // Force assign extra life to fakeVote
    entrants = entrants.map(p => ({
      ...p,
      lives: p.id === fakeVote.id ? 2 : 1
    }));

    await delay(3000);
    await channel.send("🎮 Dev Gauntlet begins now...");
    await runGauntlet(channel);
  }
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
