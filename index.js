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
  {
    title: "🌪️ Vortex of Options",
    lore: "The wind howls with malice. Choose a button and face the storm.",
    buttons: ["Step into the gale", "Anchor to stone", "Whisper to the wind", "Leap toward the eye"]
  },
  {
    title: "🕯️ Candle of Fate",
    lore: "Each flame flickers with a different destiny. Which light do you trust?",
    buttons: ["Snuff the tall wick", "Light the blue flame", "Shield the flicker", "Blow gently"]
  },
  {
    title: "🎭 Masked Choices",
    lore: "Behind each mask lies your fate. Will it smile or snuff you out?",
    buttons: ["Put on the grin", "Don the blank face", "Hide behind sorrow", "Try the gold mask"]
  },
  {
    title: "🧪 Potions of Peril",
    lore: "Four vials shimmer before you. Sip one... if you dare.",
    buttons: ["Drink the red vial", "Smell the green fizz", "Lick the black ooze", "Swirl the gold dust"]
  },
  {
    title: "📜 Scrolls of the Unknown",
    lore: "Ancient scrolls rustle with secrets. One holds salvation.",
    buttons: ["Read the blood-stained scroll", "Unravel the burning one", "Touch the invisible ink", "Seal the parchment"]
  },
  {
    title: "🔮 Crystal Collapse",
    lore: "The orb pulses. You must touch one facet. One will shatter you.",
    buttons: ["Tap the violet shard", "Crack the green gleam", "Polish the smooth blue", "Peer into the cracked one"]
  },
  {
    title: "🎁 Ugly Gift Bags",
    lore: "They jiggle ominously. That’s probably fine.",
    buttons: ["Open the spotted sack", "Shake the slimy gift", "Reach in blind", "Sniff it first"]
  },
  {
    title: "🍀 Misfortune Cookies",
    lore: "Crack one open. Let’s hope it’s dessert and not doom.",
    buttons: ["Eat the broken one", "Crack the largest", "Pick the burnt edge", "Snap the clean shell"]
  },
  {
    title: "🧲 Magnetic Mayhem",
    lore: "Each choice draws you to a different end. Or beginning.",
    buttons: ["Choose north pull", "Align with chaos", "Countercharge fate", "Invert polarity"]
  },
  {
    title: "🕳️ Charmholes",
    lore: "Jump into one. Guess what’s on the other side.",
    buttons: ["Dive into the swirl", "Step into shadows", "Slide into the green glow", "Fall with eyes closed"]
  }
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

    const joinButton = new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Primary);

    const joinRow = new ActionRowBuilder().addComponents(joinButton);

const joinEmbed = new EmbedBuilder()
  .setTitle('⚔️ A New Gauntlet Is Forming...')
  .setDescription(`Click the button below to enter the arena!\n\n⏳ Starts in **${minutes} minute(s)**\n👥 Joined: **0** players`)
  .setImage('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?ex=683bc2ca&is=683a714a&hm=f9ca4a5ebcb5a636b7ce2946fd3c4779f58809b183ea1720a44d04f45c3b8b36&=&format=webp&quality=lossless&width=930&height=930') // ⬅️ Update this URL
  .setColor(0x880088);


    const msg = await message.channel.send({
      content: '@everyone ⚔️ A new Gauntlet is forming!',
      embeds: [joinEmbed],
      components: [joinRow]
    });

    joinMessageLink = msg.url;

    const collector = msg.createMessageComponentCollector({ time: minutes * 60_000 });

    collector.on('collect', async i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });

        const updatedEmbed = EmbedBuilder.from(joinEmbed)
          .setDescription(`Click the button below to enter the arena!\n\n⏳ Starts in **${minutes} minute(s)**\n👥 Joined: **${players.size}** players`);

        await msg.edit({ embeds: [updatedEmbed], components: [joinRow] });

        await i.reply({ content: '⚔️ You’ve joined The Gauntlet!', ephemeral: true });
      } else {
        await i.reply({ content: '🌀 You’re already in!', ephemeral: true });
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

    const joinButton = new ButtonBuilder()
      .setCustomId('join_gauntlet_test')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Primary);

    const joinRow = new ActionRowBuilder().addComponents(joinButton);

    let joinEmbed = new EmbedBuilder()
      .setTitle('⚔️ Test Gauntlet Forming...')
      .setDescription(`Click below to enter!\n\n⏳ Starts in **8 seconds**\n\n**Players Joined: 0**`)
      .setColor(0x0077ff);

    const msg = await message.channel.send({ content: '🧪 Test Gauntlet is forming!', embeds: [joinEmbed], components: [joinRow] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });

    collector.on('collect', async i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });
        await i.reply({ content: `✅ You're in!`, ephemeral: true });

        // Update embed with new player count
        joinEmbed.setDescription(`Click below to enter!\n\n⏳ Starts in **8 seconds**\n\n**Players Joined: ${players.size}**`);
        await msg.edit({ embeds: [joinEmbed] });
      } else {
        await i.reply({ content: `🌀 Already joined.`, ephemeral: true });
      }
    });

    collector.on('end', async () => {
      // Add mock players to hit 20 total
      const needed = 20 - players.size;
      for (let i = 0; i < needed; i++) {
        const id = `mock_${i}`;
        players.set(id, { id, username: `Mock${i + 1}`, lives: 1 });
      }

      activeGame = { players: new Map(players), startTime: Date.now() };
      await message.channel.send(`🎮 Join phase ended. **${players.size}** players are entering The Gauntlet...`);
      await runBossVotePhase(players, message.channel);
    });
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
  let incentiveTriggered = false;
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
// === Incentive Unlock Trigger ===
const originalCount = players.length;
if (!incentiveTriggered && active.length <= Math.floor(originalCount / 2)) {
  incentiveTriggered = true;
  await runIncentiveUnlock(channel);
}
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
  const outcomeTypes = ['lose', 'gain', 'eliminate', 'safe'];
  const randomOutcome = () => outcomeTypes[Math.floor(Math.random() * outcomeTypes.length)];
  const randomStyle = () => [
    ButtonStyle.Primary,
    ButtonStyle.Danger,
    ButtonStyle.Secondary,
    ButtonStyle.Success
  ][Math.floor(Math.random() * 4)];

  const outcomeMap = new Map();
  const resultMap = new Map();

  const chosenLore = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
  const fateLine = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];
  const buttonLabels = chosenLore.buttons;

  // Map label (A, B, C, D) to outcome
  const buttons = ['A', 'B', 'C', 'D'];
  buttons.forEach(label => outcomeMap.set(label, randomOutcome()));

  const row = new ActionRowBuilder();
  buttons.forEach((label, index) => {
    const customId = `mini_${label}_evt${eventNumber}`;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(buttonLabels[index])
        .setStyle(randomStyle())
    );
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎲 Event #${eventNumber}: ${chosenLore.title}`)
    .setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **20 seconds**`)
    .setColor(0xff66cc);

  const message = await channel.send({ embeds: [embed], components: [row] });

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

    const label = i.customId.split('_')[1]; // A, B, C, D
    const outcome = outcomeMap.get(label);
    choiceMap.set(i.user.id, label);
    resultMap.set(i.user.id, outcome);

    let player = players.find(p => p.id === i.user.id);

    // === Outsider or eliminated player revival
    if (!player) {
      if (outcome === 'gain') {
        const revived = { id: i.user.id, username: i.user.username, lives: 1 };
        players.push(revived);
        activeGame.players.set(i.user.id, revived);
        currentPlayers.set(i.user.id, revived);
        await i.reply({ content: `💫 You selected **${buttonLabels[buttons.indexOf(label)]}** and were PULLED INTO THE GAUNTLET!`, ephemeral: true });
      } else {
        return i.reply({ content: `❌ You selected **${buttonLabels[buttons.indexOf(label)]}** but fate denied your re-entry.`, ephemeral: true });
      }
    } else {
      // === Apply result
      if (outcome === 'eliminate') player.lives = 0;
      else if (outcome === 'lose') player.lives -= 1;
      else if (outcome === 'gain') player.lives += 1;

      const emojiMap = {
        gain: '❤️ You gained a life!',
        lose: '💢 You lost a life!',
        eliminate: '💀 You were instantly eliminated!',
        safe: '😶 You survived untouched.'
      };

      await i.reply({ content: `🔘 You selected **${buttonLabels[buttons.indexOf(label)]}** → ${emojiMap[outcome]}`, ephemeral: true });
    }
  });

  await wait(5000);

  // Eliminate 50% of idle players
  for (let player of players) {
    if (!choiceMap.has(player.id)) {
      const eliminated = Math.random() < 0.5;
      resultMap.set(player.id, eliminated ? 'eliminate' : 'ignored');
      if (eliminated) player.lives = 0;
    }
  }

  return resultMap;
}
// === Mint Incentive Ops ===
async function runIncentiveUnlock(channel) {
  const targetNumber = Math.floor(Math.random() * 50) + 1;
  const guesses = new Map(); // user.id => guessed number

  const incentiveRewards = [
    '🎁 Mint 3 Uglys → Get 1 Free!',
    '💸 Every mint earns **double $CHARM**!',
    '👹 Only 2 burns needed to summon a Monster!',
    ];

  const monsterImg = getMonsterImageUrl();

  // --- Initial prompt
  const embed = new EmbedBuilder()
    .setTitle('🧠 Incentive Unlock Challenge')
    .setDescription(
      `An eerie silence falls over the arena... but the air tingles with potential.\n\n` +
      `**Guess a number between 1 and 50.**\n` +
      `If ANYONE gets it right, a global community incentive will be unlocked!\n\n` +
      `⏳ You have 10 seconds...`
    )
    .setImage(monsterImg)
    .setColor(0xff6600)
    .setFooter({ text: 'Type your number in the chat now. Only 1 try!' });

  await channel.send({ embeds: [embed] });

  const filter = m => {
    const guess = parseInt(m.content.trim());
    return !isNaN(guess) && guess >= 1 && guess <= 50 && !guesses.has(m.author.id);
  };

  const collector = channel.createMessageCollector({ filter, time: 10000 });

  collector.on('collect', msg => {
    guesses.set(msg.author.id, parseInt(msg.content.trim()));
  });

  collector.on('end', async () => {
    const winners = [...guesses.entries()].filter(([_, num]) => num === targetNumber).map(([id]) => `<@${id}>`);

    if (winners.length > 0) {
      const incentive = incentiveRewards[Math.floor(Math.random() * incentiveRewards.length)];

      const winEmbed = new EmbedBuilder()
        .setTitle('🎉 Incentive Unlocked!')
        .setDescription(
          `🧠 The magic number was **${targetNumber}**.\n` +
          `✅ ${winners.join(', ')} guessed correctly!\n\n` +
          `🎁 **New Community Incentive Unlocked:**\n${incentive}\n\n` +
          `📩 Open a ticket to claim. This expires in **24 hours** — act fast!`
        )
        .setImage(monsterImg)
        .setColor(0x33ff66)
        .setFooter({ text: 'Unlocked by the power of the malformed minds.' });

      await channel.send({ embeds: [winEmbed] });

    } else {
      const failEmbed = new EmbedBuilder()
        .setTitle('🧤 The Offer Remains Sealed...')
        .setDescription(
          `No one guessed the correct number (**${targetNumber}**).\n\n` +
          `The incentive stays locked, its power fading into the void... for now.`
        )
        .setImage(monsterImg)
        .setColor(0x990000)
        .setFooter({ text: 'The Charm rewards those who dare... and guess well.' });

      await channel.send({ embeds: [failEmbed] });
    }
  });
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

  const correctPlayers = new Set();
  const filter = m => {
    return players.some(p => p.id === m.author.id) && m.content.toLowerCase().includes(answer.toLowerCase());
  };

  const collector = channel.createMessageCollector({ filter, time: countdown * 1000 });

  collector.on('collect', async msg => {
    if (!correctPlayers.has(msg.author.id)) {
      correctPlayers.add(msg.author.id);

      const player = players.find(p => p.id === msg.author.id);
      if (player) player.lives += 1;

      // Delete answer to keep it hidden
      await msg.delete().catch(() => {});

      // Ephemeral confirmation
      await channel.send({
        content: `🔮 You answered correctly — the Oracle grants you **+1 life**.`,
        ephemeral: true,
        allowedMentions: { users: [msg.author.id] },
        embeds: [],
        components: []
      }).catch(() => {});
    } else {
      await msg.delete().catch(() => {});
    }
  });

  // Countdown embed updater
  const countdownIntervals = [25, 20, 15, 10, 5];
  for (const secondsLeft of countdownIntervals) {
    await wait(5000);
    embed.setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${secondsLeft} seconds**`);
    await msg.edit({ embeds: [embed] });
  }

  collector.on('end', async () => {
    if (correctPlayers.size === 0) {
      await channel.send(`⏳ The Oracle received no answer this time...`);
    } else {
      const summary = [...correctPlayers].map(id => `<@${id}>`).join(', ');
      await channel.send(`🌟 The Oracle blesses ${summary} with +1 life.`);
    }
  });

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
  const requiredVotes = Math.ceil(finalPlayers.length * 0.75);
  const votes = new Set();

  const voteButton = new ButtonBuilder()
    .setCustomId('rematch_vote')
    .setLabel(`🔁 Run It Back (0/${requiredVotes})`)
    .setStyle(ButtonStyle.Success);

  const rematchRow = new ActionRowBuilder().addComponents(voteButton);

  const msg = await channel.send({
    content: `🏁 The Gauntlet has ended. Want to play again?\nAt least **75%** of players must vote to rematch.\nFinal players: **${finalPlayers.length}**`,
    components: [rematchRow]
  });

  const collector = msg.createMessageComponentCollector({ time: 30_000 });

  collector.on('collect', async i => {
    if (!finalPlayers.find(p => p.id === i.user.id)) {
      return i.reply({ content: `⛔ Only final players can vote.`, ephemeral: true });
    }

    if (votes.has(i.user.id)) {
      return i.reply({ content: `✅ Already voted!`, ephemeral: true });
    }

    votes.add(i.user.id);
    await i.reply({ content: `🔁 You're in for another round!`, ephemeral: true });

    const newButton = ButtonBuilder.from(voteButton)
      .setLabel(`🔁 Run It Back (${votes.size}/${requiredVotes})`);

    const newRow = new ActionRowBuilder().addComponents(newButton);
    await msg.edit({ components: [newRow] });
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
// === Check Lives Remaining ===
client.on('messageCreate', async (message) => {
  if (message.content === '!life') {
    if (!activeGame || !activeGame.players) {
      return message.reply('⚠️ No Gauntlet is currently running.');
    }

    const player = activeGame.players.get(message.author.id);
    if (!player) {
      return message.reply('💀 You are not currently in the Gauntlet or have been eliminated.');
    }

    return message.reply(`❤️ You currently have **${player.lives}** life${player.lives === 1 ? '' : 's'}.`);
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
