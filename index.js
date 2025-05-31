// index.js
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
const TOKEN = process.env.BOT_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// === PostgreSQL Setup ===
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
        duels_won INT DEFAULT 0,
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
  })
  .catch(err => console.error('❌ DB Connection Error:', err));
// === Global Game State ===
let activeGame = null;
let rematchCount = 0;
const maxRematches = 4;
const currentPlayers = new Map(); // userId => { username, lives }
const eliminatedPlayers = new Map(); // userId => { username, eliminatedAt }
const trialMode = false;
let gameChannel = null;
let joinMessageLink = null;

// === Lore Arrays ===
const funnyEliminations = [
  "tried to moonwalk into the void. It worked too well.",
  "thought the CHARM was edible. It wasn’t.",
  "answered the riddle with ‘42’. Classic mistake.",
  "insisted they could out-stare the Oracle. They lost.",
  "chose option D. There was no option D.",
  "called the Monster ‘cute’. It took offense.",
  "rolled a nat 1 and faceplanted into nonexistence.",
  "flexed too hard and broke their reality bubble.",
  "tried to revive by unplugging the bot. Banished.",
  "pressed every button at once. The Gauntlet chose violence.",
  "ignored the warnings. Ignored the signs. Got yeeted.",
  "offered CHARM to the Oracle. The Oracle was allergic.",
  "tried to cast a spell with the wrong emoji.",
  "thought it was trivia night. It wasn’t.",
  "accidentally opened a portal to customer support."
];
// === Mini-Game Lore Pool (20 Variants) ===
const miniGameLorePool = [
  { title: "🌪️ Vortex of Options", lore: "The wind howls with malice. Choose a button and face the storm." },
  { title: "🕯️ Candle of Fate", lore: "Each flame flickers with a different destiny. Which light do you trust?" },
  { title: "🎭 Masked Choices", lore: "Behind each mask lies your fate. Will it smile or snuff you out?" },
  { title: "🧪 Potions of Peril", lore: "Four vials shimmer before you. Sip one... if you dare." },
  { title: "📜 Scrolls of the Unknown", lore: "Ancient scrolls rustle with secrets. One holds salvation." },
  { title: "🧲 Magnetic Mayhem", lore: "Each choice draws you to a different end. Or beginning." },
  { title: "🔮 Crystal Collapse", lore: "The orb pulses. You must touch one facet. One will shatter you." },
  { title: "🧃 Sip or Suffer", lore: "A thirst only fate can quench. Which bottle will burn?" },
  { title: "📦 Boxes from Beyond", lore: "Each box hums softly. One hums... wrongly." },
  { title: "🕰️ Echoes of Time", lore: "Your choice echoes backward and forward. But mostly... downward." },
  { title: "🛸 Alien Algorithm", lore: "The pattern is unclear. So is survival." },
  { title: "🧵 Threads of Reality", lore: "Pluck a thread. One unravels your mind." },
  { title: "📍 Pins of Probability", lore: "Four pins. Only one will not explode." },
  { title: "🍳 Breakfast of Doom", lore: "One of these is eggs. One is... not eggs." },
  { title: "🎈 Balloon Trial", lore: "Pop one. Pray it’s not yours." },
  { title: "🪤 Trap Teasers", lore: "One option is safe. The others... definitely not." },
  { title: "🕳️ Charmholes", lore: "Jump into one. Guess what’s on the other side." },
  { title: "🐌 Slime Slalom", lore: "Touch a trail. Not all are harmless." },
  { title: "🎁 Ugly Gift Bags", lore: "They jiggle ominously. That’s probably fine." },
  { title: "🍀 Misfortune Cookies", lore: "Crack one open. Let’s hope it’s dessert and not doom." }
];
// === Fate Lore Intros ===
const miniGameFateDescriptions = [
  "The charm stirs. Only one choice uplifts, the rest consume.",
  "Fate is sealed by your fingertip. Pick wrong and be erased.",
  "One button saves. The rest… echo with screams.",
  "The Oracle whispers: ‘Only one path leads back.’",
  "Choose quickly. The floor is melting.",
  "Pick a glyph. The charm decides who returns and who burns.",
  "Some paths heal. Others hex. All shimmer with deceit.",
  "Every option beckons. Not all forgive.",
  "Whispers curl around your ear: 'Click... and suffer.'",
  "A hum builds behind the buttons. One pulses with power."
];

const riddles = [
  { riddle: "I speak without a mouth and hear without ears. What am I?", answer: "echo" },
  { riddle: "The more you take, the more you leave behind. What are they?", answer: "footsteps" },
  { riddle: "What has to be broken before you can use it?", answer: "egg" },
  { riddle: "What runs but never walks, has a bed but never sleeps?", answer: "river" },
  { riddle: "I am always hungry, must always be fed. What am I?", answer: "fire" },
  { riddle: "I shrink smaller every time I take a bath. What am I?", answer: "soap" },
  { riddle: "The more you remove, the bigger I get. What am I?", answer: "hole" },
  { riddle: "I come once in a minute, twice in a moment, but never in a thousand years. What am I?", answer: "m" },
  { riddle: "What invention lets you look through walls?", answer: "window" },
  { riddle: "What can travel around the world while staying in the corner?", answer: "stamp" }
];

// === NFT Image Fetching ===
function getUglyImageUrl() {
  const tokenId = Math.floor(Math.random() * 615) + 1;
  return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
}

function getMonsterImageUrl() {
  const tokenId = Math.floor(Math.random() * 126) + 1;
  return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}

// === Utility ===
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
// === Gauntlet Command: Public Join Phase ===
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!gauntlet')) {
    const minutes = parseFloat(message.content.split(' ')[1]) || 1;
    if (activeGame) return message.reply('⛔ A Gauntlet is already running!');

    const players = new Map();
    gameChannel = message.channel;
    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Primary)
    );

    const joinEmbed = new EmbedBuilder()
      .setTitle('⚔️ A New Gauntlet Is Forming...')
      .setDescription(`Click the button below to enter the arena!\n\n⏳ Starts in **${minutes} minute(s)**`)
      .setColor(0x880088);

    const msg = await message.channel.send({ content: '@everyone ⚔️ A new Gauntlet is forming!', embeds: [joinEmbed], components: [joinRow] });
    joinMessageLink = msg.url;

    const collector = msg.createMessageComponentCollector({ time: minutes * 60_000 });
    collector.on('collect', i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });
        i.reply({ content: '⚔️ You’ve joined The Gauntlet!', ephemeral: true });
      } else {
        i.reply({ content: '🌀 You’re already in!', ephemeral: true });
      }
    });

    const reminderTimes = [1 / 3, 2 / 3].map(f => Math.floor(minutes * 60_000 * f));
    for (const t of reminderTimes) {
      setTimeout(() => {
        message.channel.send(`@everyone ⏳ Still time to join The Gauntlet! ${joinMessageLink}`);
      }, t);
    }

    setTimeout(async () => {
      if (players.size < 3) return message.channel.send('❌ Not enough players to run the Gauntlet.');
      activeGame = { players: new Map(players), startTime: Date.now() };
      message.channel.send(`🎮 Join phase ended. **${players.size}** players are entering The Gauntlet...`);
      await runBossVotePhase(players, message.channel);
    }, minutes * 60_000);
  }
});
client.on('messageCreate', async (message) => {
  if (message.content === '!testgauntlet') {
    if (activeGame) return message.reply('⛔ A Gauntlet is already running!');
    const players = new Map();
    gameChannel = message.channel;

    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet_test')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Primary)
    );

    const joinEmbed = new EmbedBuilder()
      .setTitle('🧪 Test Gauntlet Join Phase')
      .setDescription('Click to join manually before mock players enter!')
      .setColor(0xccccff);

    const msg = await message.channel.send({ embeds: [joinEmbed], components: [joinRow] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });
    collector.on('collect', async i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });
        await i.reply({ content: '✅ You joined the test Gauntlet!', ephemeral: true });
      }
    });

    setTimeout(async () => {
      for (let i = 1; i <= 20; i++) {
        const fakeId = `test_user_${i}`;
        if (!players.has(fakeId)) {
          players.set(fakeId, { id: fakeId, username: `TestUser${i}`, lives: 1 });
        }
      }

      activeGame = { players, trial: true };
      await message.channel.send(`✅ Mock players added. Total: ${players.size}`);
      await runBossVotePhase(players, message.channel);
    }, 8000);
  }
});
async function runBossVotePhase(players, channel) {
  const candidates = [...players.values()].sort(() => 0.5 - Math.random()).slice(0, 5);
  const row = new ActionRowBuilder();
  candidates.forEach(p => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bossvote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('👁️ BOSS VOTE!')
    .setDescription('Choose who should become **Extra Ugly** and earn 1 bonus life.\nVote wisely...')
    .setColor(0xff00ff);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const votes = {};
  const collector = msg.createMessageComponentCollector({ time: 10_000 });
  collector.on('collect', i => {
    if (!votes[i.user.id]) {
      const voted = i.customId.replace('bossvote_', '');
      votes[i.user.id] = voted;
      i.reply({ content: '🗳️ Vote cast!', ephemeral: true });
    } else {
      i.reply({ content: '❌ You already voted!', ephemeral: true });
    }
  });

  collector.on('end', async () => {
    const tally = {};
    Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);
    const winnerId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || candidates[0].id;
    const winner = players.get(winnerId);
    winner.lives += 1;

    const announce = new EmbedBuilder()
      .setTitle('👑 The Extra Ugly Is Chosen!')
      .setDescription(`🎉 **${winner.username}** was voted the Boss and now has **2 lives!**`)
      .setColor(0xff66ff);

    await channel.send({ embeds: [announce] });
    await wait(2000);
    runGauntlet(players, channel);
  });
}
// === Main Gauntlet Game Loop ===
async function runGauntlet(players, channel) {
  const playerMap = new Map(players);
  let eliminated = new Map();
  let eventNumber = 1;
  let active = [...playerMap.values()];
  const maxEvents = 100;

  while (active.length > 3 && eventNumber <= maxEvents) {
    const eventTitle = `⚔️ Event #${eventNumber}`;
    const loreIntro = `🌀 *The warp churns... new horrors rise...*`;
    const nftImg = getUglyImageUrl();

    // === Embed 1: Lore & Ugly Image ===
    const introEmbed = new EmbedBuilder()
      .setTitle(eventTitle)
      .setDescription(loreIntro)
      .setImage(nftImg)
      .setColor(0xaa00ff);

    await channel.send({ embeds: [introEmbed] });
    await wait(2000);

    // === Embed 2: Run Mini-Game (with countdown) ===
    const miniGameResults = await runMiniGameEvent(active, channel, eventNumber);

    // === Embed 3: Show Elimination Results One-by-One ===
    await displayEliminations(miniGameResults, channel);

    // === Riddle Phase with Countdown and Pause ===
    await runRiddleEvent(channel, active);

    // === Remove Dead Players ===
    for (let player of active) {
      if (player.lives <= 0 && !eliminated.has(player.id)) {
        eliminated.set(player.id, player);
        currentPlayers.delete(player.id);
      }
    }

    active = [...playerMap.values()].filter(p => !eliminated.has(p.id));
    eventNumber++;
    await wait(3000);
  }

  await showPodium(channel, [...playerMap.values()]);
  activeGame = null;
  rematchCount++;
  if (rematchCount < maxRematches) await showRematchButton(channel, [...playerMap.values()]);
}
// === Mini-Game Event with Countdown and Secret Outcome ===
async function runMiniGameEvent(players, channel, eventNumber) {
  const buttons = ['A', 'B', 'C', 'D'];
  const outcomes = ['lose', 'gain', 'eliminate', 'safe'];
  const randomOutcome = () => outcomes[Math.floor(Math.random() * outcomes.length)];
  const randomStyle = () => [
    ButtonStyle.Primary,
    ButtonStyle.Danger,
    ButtonStyle.Secondary,
    ButtonStyle.Success
  ][Math.floor(Math.random() * 4)];

  const outcomeMap = new Map();
  buttons.forEach(label => outcomeMap.set(label, randomOutcome()));
  const resultMap = new Map();

  const chosenLore = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
  const fateLine = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];

  const row = new ActionRowBuilder();
  buttons.forEach(label => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mini_${label}`)
        .setLabel(`Option ${label}`)
        .setStyle(randomStyle())
    );
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎲 Event #${eventNumber}: ${chosenLore.title}`)
    .setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **20 seconds**`)
    .setColor(0xff66cc);

  const message = await channel.send({ embeds: [embed], components: [row] });

  // Live countdown
  for (let i of [15, 10, 5]) {
    await wait(5000);
    embed.setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **${i} seconds**`);
    await message.edit({ embeds: [embed] });
  }

  const choiceMap = new Map();
  const collector = message.createMessageComponentCollector({ time: 5000 });

  collector.on('collect', async i => {
    if (choiceMap.has(i.user.id)) {
      return i.reply({ content: '⏳ You already chose.', ephemeral: true });
    }

    const label = i.customId.replace('mini_', '');
    const outcome = outcomeMap.get(label);
    choiceMap.set(i.user.id, label);
    resultMap.set(i.user.id, outcome);

    let player = players.find(p => p.id === i.user.id);

    // === Revival Logic: outsider or eliminated user hits "gain"
    if (!player) {
      if (outcome === 'gain') {
        const revived = { id: i.user.id, username: i.user.username, lives: 1 };
        players.push(revived);
        activeGame.players.set(i.user.id, revived);
        currentPlayers.set(i.user.id, revived);
        await i.reply({ content: `💫 You clicked **${label}** and were PULLED INTO THE GAUNTLET!`, ephemeral: true });
      } else {
        return i.reply({ content: `❌ You clicked **${label}** but fate denied your re-entry.`, ephemeral: true });
      }
    } else {
      // === Outcome for regular players
      if (outcome === 'eliminate') player.lives = 0;
      else if (outcome === 'lose') player.lives -= 1;
      else if (outcome === 'gain') player.lives += 1;

      const emojiMap = {
        gain: '❤️ You gained a life!',
        lose: '💢 You lost a life!',
        eliminate: '💀 You were instantly eliminated!',
        safe: '😶 You survived untouched.'
      };
      await i.reply({ content: `🔘 You chose **${label}** → ${emojiMap[outcome]}`, ephemeral: true });
    }
  });

  // Final 5 seconds wait
  await wait(5000);

  // Eliminate 50% of those who didn’t click
  for (let player of players) {
    if (!choiceMap.has(player.id)) {
      const eliminated = Math.random() < 0.5;
      resultMap.set(player.id, eliminated ? 'eliminate' : 'ignored');
      if (eliminated) player.lives = 0;
    }
  }

  return resultMap;
}
// === Display Eliminations One at a Time ===
async function displayEliminations(resultMap, channel) {
  const eliminatedList = [];
  const revivedList = [];

  for (let [userId, outcome] of resultMap.entries()) {
    if (outcome === 'eliminate') {
      eliminatedList.push(userId);
    }
    if (outcome === 'gain' && !activeGame.players.has(userId)) {
      // User joined from outside or returned from death
      revivedList.push(userId);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('📜 Results Round')
    .setDescription('Processing the outcome of this trial...\n')
    .setColor(0xff5588);

  const msg = await channel.send({ embeds: [embed] });

  for (let i = 0; i < eliminatedList.length; i++) {
    const id = eliminatedList[i];
    const lore = funnyEliminations[Math.floor(Math.random() * funnyEliminations.length)];
    embed.setDescription(embed.data.description + `💀 <@${id}> ${lore}\n`);
    await msg.edit({ embeds: [embed] });
    await wait(1000);
  }

  for (let i = 0; i < revivedList.length; i++) {
    const id = revivedList[i];
    const line = `💫 <@${id}> clawed their way back in! The charm smiled... this time.`;
    embed.setDescription(embed.data.description + `${line}\n`);
    await msg.edit({ embeds: [embed] });
    await wait(1000);
  }

  if (eliminatedList.length === 0 && revivedList.length === 0) {
    embed.setDescription('The charm is silent. No one was claimed, no one returned.');
    await msg.edit({ embeds: [embed] });
  }
}
// === Riddle Phase with Countdown & Monster Image ===
async function runRiddleEvent(channel, players) {
  const { riddle, answer } = riddles[Math.floor(Math.random() * riddles.length)];
  const monsterImg = getMonsterImageUrl();

  let countdown = 30;
  const embed = new EmbedBuilder()
    .setTitle('🧠 Ugly Oracle Riddle')
    .setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${countdown} seconds**`)
    .setImage(monsterImg)
    .setColor(0x00ffaa)
    .setFooter({ text: `Only one may earn the Oracle's favor...` });

  const msg = await channel.send({ embeds: [embed] });

  const filter = m => {
    return players.some(p => p.id === m.author.id) && m.content.toLowerCase().includes(answer.toLowerCase());
  };

  const collector = channel.createMessageCollector({ filter, time: countdown * 1000 });
  let winnerAnnounced = false;

  collector.on('collect', async msg => {
    if (!winnerAnnounced) {
      winnerAnnounced = true;
      try {
        await msg.author.send(`🔮 You answered correctly: **${answer}**\nYou’ve been touched by the Oracle’s favor.`);
      } catch (e) {
        console.warn(`Could not DM ${msg.author.username}`);
      }
      await msg.delete().catch(() => {});
      collector.stop();
    } else {
      await msg.delete().catch(() => {});
    }
  });

  // Update the countdown inside the embed every 5s
  const countdownIntervals = [25, 20, 15, 10, 5];
  for (const secondsLeft of countdownIntervals) {
    await wait(5000);
    embed.setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${secondsLeft} seconds**`);
    await msg.edit({ embeds: [embed] });
  }

  collector.on('end', collected => {
    if (!winnerAnnounced) {
      channel.send(`⏳ The Oracle received no answer...`);
    }
  });

  // Final pause before moving on
  await wait(5000);
}
// === Show Final Podium ===
async function showPodium(channel, players) {
  const alive = players.filter(p => p.lives > 0);
  const ranked = [...alive].sort((a, b) => b.lives - a.lives);

  // Fill up to 3 if fewer than 3 survived
  while (ranked.length < 3) {
    const fillers = players.filter(p => !ranked.includes(p)).slice(0, 3 - ranked.length);
    ranked.push(...fillers);
  }

  // Determine top 3 by lives
  const top3 = ranked.slice(0, 3);
  const maxLives = top3[0]?.lives || 0;
  const tied = top3.filter(p => p.lives === maxLives);

  const medals = ['🥇', '🥈', '🥉'];
  const fields = top3.map((p, i) => ({
    name: `${medals[i]} ${p.username}`,
    value: `Lives remaining: **${p.lives}**`,
    inline: true
  }));

  const embed = new EmbedBuilder()
    .setTitle('🏁 The Gauntlet Has Ended!')
    .setDescription('Here are the Top 3 survivors of the Ugly Trials:')
    .addFields(fields)
    .setColor(0xf5c518);

  await channel.send({ embeds: [embed] });

  // If there’s a full tie for first (2 or 3 players), do a sudden death round
  if (tied.length > 1) {
    await channel.send(`⚖️ Tiebreaker required! ${tied.map(p => p.username).join(', ')} all have ${maxLives} lives!`);
    await runTiebreaker(channel, tied);
  }
}


// === Sudden Death Button Duel ===
async function runTiebreaker(channel, tiedPlayers) {
  const row = new ActionRowBuilder();
  tiedPlayers.forEach((p, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tie_${p.id}`)
        .setLabel(p.username)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Success][i % 3])
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Sudden Death!')
    .setDescription(`All tied players must act! Click your name first to survive.\nOnly one will move on...`)
    .setColor(0xdd2222);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 10_000 });
  const alreadyClicked = new Set();

  collector.on('collect', async i => {
    if (alreadyClicked.has(i.user.id)) {
      return i.reply({ content: '⏳ You already acted!', ephemeral: true });
    }

    const winner = tiedPlayers.find(p => `tie_${p.id}` === i.customId);
    if (winner) {
      alreadyClicked.add(i.user.id);
      await channel.send(`🎉 **${winner.username}** wins the sudden death tiebreaker!`);
      collector.stop();
    }
  });

  collector.on('end', async collected => {
    if (!collected.size) {
      await channel.send(`💤 No one clicked in time. The Gauntlet claims all the tied souls.`);
    }
  });
}
// === Show Rematch Button & Wait for Votes ===
async function showRematchButton(channel, finalPlayers) {
  const rematchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_vote')
      .setLabel('🔁 Run It Back')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    content: `The Gauntlet has ended. Want to play again?\nAt least **75%** must click to rematch. (${finalPlayers.length} total)`,
    components: [rematchRow]
  });

  const collector = msg.createMessageComponentCollector({ time: 30_000 });
  const votes = new Set();

  collector.on('collect', async i => {
    if (finalPlayers.find(p => p.id === i.user.id)) {
      if (!votes.has(i.user.id)) {
        votes.add(i.user.id);
        await i.reply({ content: `🔁 You're in for another round!`, ephemeral: true });
      } else {
        await i.reply({ content: `✅ Already voted!`, ephemeral: true });
      }
    } else {
      await i.reply({ content: `⛔ Only final players can vote.`, ephemeral: true });
    }
  });

  collector.on('end', async () => {
    const percent = (votes.size / finalPlayers.length) * 100;
    if (percent >= 75 && rematchCount < maxRematches) {
      channel.send(`✅ **${votes.size}** voted to restart! The Gauntlet begins anew...`);
      const playerMap = new Map();
      finalPlayers.forEach(p => {
        playerMap.set(p.id, { id: p.id, username: p.username, lives: 1 });
      });
      activeGame = { players: playerMap, rematch: true };
      await runBossVotePhase(playerMap, channel);
    } else {
      rematchCount = 0;
      channel.send(`🛑 Rematch cancelled or max streak reached. Rest well, warriors.`);
    }
  });
}
// === Revive Command (25% chance) ===
client.on('messageCreate', async (message) => {
  if (message.content === '!revive') {
    if (!activeGame || !activeGame.players) return message.reply('⚠️ No Gauntlet is currently running.');
    if (activeGame.players.has(message.author.id)) return message.reply('😎 You’re not eliminated.');

    const chance = Math.random();
    if (chance <= 0.25) {
      const revived = { id: message.author.id, username: message.author.username, lives: 1 };
      activeGame.players.set(message.author.id, revived);
      currentPlayers.set(message.author.id, revived);
      await message.reply(`💫 You’ve returned to The Gauntlet!`);
    } else {
      await message.reply(`💀 The charm rejected your plea. You're still dead.`);
    }
  }
});
// === Leaderboard Command ===
client.on('messageCreate', async (message) => {
  if (message.content === '!leaderboard') {
    const result = await db.query(`
      SELECT username, wins FROM player_stats
      ORDER BY wins DESC
      LIMIT 10;
    `);

    const top = result.rows.map((row, i) => `**#${i + 1}** ${row.username} — ${row.wins} wins`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Gauntlet Leaderboard')
      .setDescription(top || 'No games played yet!')
      .setColor(0x00ccff);

    message.channel.send({ embeds: [embed] });
  }
});

// === Stats Command ===
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!stats')) {
    const target = message.mentions.users.first() || message.author;

    const { rows } = await db.query(`
      SELECT * FROM player_stats
      WHERE user_id = $1
      LIMIT 1;
    `, [target.id]);

    if (!rows.length) {
      return message.reply(`No stats found for ${target.username}.`);
    }

    const stats = rows[0];
    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${stats.username}`)
      .setDescription(`Wins: ${stats.wins}\nRevives: ${stats.revives}\nDuels Won: ${stats.duels_won}\nGames Played: ${stats.games_played}`)
      .setColor(0xdddd00);

    message.channel.send({ embeds: [embed] });
  }
});
// === On Bot Ready ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Start Bot ===
client.login(TOKEN);
