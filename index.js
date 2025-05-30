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
// === Configurable Defaults ===
const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';
const MONSTER_COLLECTION = 'ugly-monsters';
const UGLY_COLLECTION = 'charm-of-the-ugly';

// === Game State ===
let currentGame = null;
let gauntletActive = false;
let joinMessageLink = '';
let consecutiveRematches = 0;
const MAX_REMATCHES = 4;

// === Utility ===
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);
const getRandom = arr => arr[Math.floor(Math.random() * arr.length)];

function formatRatio(current, total) {
  return `**${current}** remain out of **${total}**`;
}

function getImageUrl(tokenId, isMonster = false) {
  return `https://opensea.io/assets/ethereum/${isMonster ? '0xMONSTER_CONTRACT' : '0x9492505633D74451bDF3079c09ccc979588Bc309'}/${tokenId}`;
}

// === Lore Arrays ===
const eliminationReasons = [
  "👟 tripped over a cursed shoelace and was never seen again.",
  "👁️‍🗨️ challenged the charm to a staring contest. Lost. Badly.",
  "🕺 mistook the ritual circle for a dance floor. The charm was not amused.",
  "🪞 stepped into a mirror and got stuck arguing with their prettier self.",
  "🔮 asked the Oracle too many questions. Was swallowed by punctuation.",
  "📧 accidentally hit 'Reply All' to the voices in their head.",
  "🪨 licked a glowing rock labeled 'Do Not Lick.'",
  "💪 tried to flex mid-round and tore reality (and themselves).",
  "🔴 pressed the charm’s big red button. Instantly gone.",
  "📊 was voted 'Most Likely to Die Next' — statistically accurate.",
  "🎲 rolled a one and met a gruesome fate.",
  "🦴 got gnawed by something that used to be a pet.",
  "🚪 opened a forbidden door and vanished with a shriek.",
  "🌪️ was caught in a spontaneous charmstorm.",
  "📜 read the Gauntlet’s fine print and disappeared in legalese.",
  "🧼 slipped on a bar of cursed soap. Comically fatal.",
  "🐔 challenged the Chicken Oracle. It did not end well.",
  "🎭 was mistaken for the Boss and eliminated ceremoniously.",
  "🕳️ fell into the lorehole and never climbed back out.",
  "👻 blinked. The charm didn’t."
];

const reviveSuccessLines = [
  "💫 A rift tears open, and you're spat back into the world — alive!",
  "🌿 You feel the malformed magic course through you. Welcome back.",
  "🪄 The Oracle’s gamble pays off. You return... changed.",
  "⚡ A bolt of CHARM energy jolts your soul. You’re back!",
  "🎉 Against all odds, you're back on your grotesque little feet."
];

const reviveFailLines = [
  "☠️ The charm laughs. You're not worthy — not yet.",
  "🪦 Nothing happens. Just the sound of your own desperation.",
  "⏳ The Oracle ignores you. Maybe next time.",
  "🫥 You dissolve into vibes and disappointment.",
  "🔕 The ritual fizzles. The crowd shrugs. Brutal."
];

const warpEchoes = [
  "🌀 *“Not all who wander are lost… some are just very, very twisted.”*",
  "🌫️ *“The charm remembers everything. Even you.”*",
  "🌙 *“A shadow passed over the moon. Something changed.”*",
  "📯 *“The call goes out. Few answer. Fewer return.”*",
  "🧬 *“Blood remembers. Bones echo. The Gauntlet listens.”*"
];

const uglychants = [
  "🔊 *“Ugly in, Ugly out. The malformed route.”*",
  "📢 *“One CHARM to burn, one CHARM to break, one CHARM to lure the fake.”*",
  "🎶 *“They chanted ‘Flex or Die.’ They died.”*",
  "📜 *“Winners write lore. Losers become it.”*",
  "🥁 *“Beat the charm. Or it beats you.”*"
];

const uglyOracleRiddles = [
  "🧠 *“What walks on four legs in the morning, two legs at noon, and three legs at night?”*",
  "🔮 *“The more you take, the more you leave behind. What am I?”*",
  "🦴 *“I am not alive, but I grow. I have no lungs, but I need air. What am I?”*",
  "🕳️ *“The more you remove from me, the bigger I become. What am I?”*",
  "⚖️ *“I weigh nothing, but you can’t hold me for long. What am I?”*"
];
// === Mutation Events ===
const mutationEvents = [
  {
    name: "The Mirror Maze",
    description: "A twisted hall of reflections appears. Some see their truth. Some vanish into it.",
    async effect(interaction, gamePlayers, eliminatedPlayers) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mirrormaze')
          .setLabel('Enter the Maze')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle("🪞 The Mirror Maze")
        .setDescription("Will you enter the shifting mirrors? Only some return.")
        .setColor(0x6600cc);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      const results = [];

      collector.on('collect', async i => {
        if (i.user.bot || results.includes(i.user.id)) return;
        results.push(i.user.id);
        await i.reply({ content: `🪞 ${i.user.username} stepped into the mirror... we’ll see what returns.` , ephemeral: true });
      });

      collector.on('end', async () => {
        const outcomes = results.map(userId => {
          const revived = Math.random() < 0.4;
          return { userId, revived };
        });

        const summary = outcomes.map(r => `• <@${r.userId}> ${r.revived ? 'found their way back ✨' : 'was lost forever 💀'}`).join('\n');

        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🪞 Mirror Maze Results")
            .setDescription(summary)
            .setColor(0xaa44ff)]
        });
      });
    }
  },
  {
    name: "The Leeching Pool",
    description: "A boiling pool of charm fluid beckons. Touch it to gain power... or pain.",
    async effect(interaction, gamePlayers, eliminatedPlayers) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('leechingpool')
          .setLabel('Touch the Fluid')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle("🩸 The Leeching Pool")
        .setDescription("Some say it grants strength. Others, a slow demise.")
        .setColor(0xdd2222);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      const results = [];

      collector.on('collect', async i => {
        if (i.user.bot || results.includes(i.user.id)) return;
        results.push(i.user.id);
        await i.reply({ content: `🩸 ${i.user.username} reached in... what did they find?`, ephemeral: true });
      });

      collector.on('end', async () => {
        const summary = results.map(id => {
          const blessed = Math.random() < 0.3;
          return `• <@${id}> ${blessed ? 'absorbed power ⚡' : 'was drained to the bone☠️'}`;
        }).join('\n');

        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🩸 Leeching Pool Outcomes")
            .setDescription(summary)
            .setColor(0xcc0000)]
        });
      });
    }
  }
];

// === Mini-Games ===
const mutationMiniGames = [
  {
    name: "Press the Charm",
    description: "A single red button glows. Will you press it? Will you survive?",
    async effect(interaction, gamePlayers, eliminatedPlayers) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('presscharm')
          .setLabel('Press It')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle("🔴 Press the Charm")
        .setDescription("Someone’s gonna blow. Click fast.")
        .setColor(0xdd0000);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      const results = [];

      collector.on('collect', async i => {
        if (i.user.bot || results.includes(i.user.id)) return;
        results.push(i.user.id);
        await i.reply({ content: `💥 ${i.user.username} pressed it. The fuse is lit...`, ephemeral: true });
      });

      collector.on('end', async () => {
        const summary = results.map(id => {
          const survived = Math.random() < 0.5;
          return `• <@${id}> ${survived ? 'survived the blast 😅' : 'was atomized 💀'}`;
        }).join('\n');

        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("💥 Charm Detonation Results")
            .setDescription(summary)
            .setColor(0xcc1111)]
        });
      });
    }
  }
];
// === Gauntlet Starter ===
if (message.content.startsWith('!gauntlet')) {
  if (gauntletActive) return message.reply("⚔️ A Gauntlet is already running!");


  const isTrial = message.content.includes('trial') || message.content.includes('dev');
  const minutes = isTrial ? 0.1 : parseFloat(message.content.split(' ')[1]) || 1;
  const joinDuration = Math.max(1, minutes * 60 * 1000);

  const embed = new EmbedBuilder()
    .setTitle("⚔️ The Gauntlet Begins!")
    .setDescription(`Click below to enter the arena. Only three will survive.\n\n⏳ Game starts in **${minutes} minutes**.`)
    .setColor(0xff0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('joinGauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Primary)
  );

  const joinMsg = await message.channel.send({ content: '@everyone A new Gauntlet is forming!', embeds: [embed], components: [row] });
  joinMessageLink = joinMsg.url;

  currentGame = {
    players: [],
    eliminated: [],
    originalCount: 0,
    lives: new Map(),
    channel: message.channel,
    startTime: Date.now(),
    trial: isTrial
  };

  gauntletActive = true;

  // Auto-fill 20 mock players for trial/dev
  if (isTrial) {
    for (let i = 1; i <= 20; i++) {
      const id = `test${i}`;
      currentGame.players.push({ id, username: `MockPlayer${i}` });
      currentGame.lives.set(id, 1);
    }
    currentGame.originalCount = currentGame.players.length;
    message.channel.send(`🔧 Trial mode: Preloaded 20 mock players.\nStarting The Gauntlet...`);
    return startGauntlet(currentGame.players, message.channel, true);
  }

  // Collector for Join Phase
  const collector = joinMsg.createMessageComponentCollector({ time: joinDuration });
  collector.on('collect', i => {
    if (i.customId === 'joinGauntlet') {
      if (!currentGame.players.find(p => p.id === i.user.id)) {
        currentGame.players.push({ id: i.user.id, username: i.user.username });
        currentGame.lives.set(i.user.id, 1);
      }
      i.reply({ content: `You're in, <@${i.user.id}>!`, ephemeral: true });
    }
  });

  const thirds = [joinDuration / 3, (joinDuration * 2) / 3];
  for (const t of thirds) {
    setTimeout(() => {
      message.channel.send(`<@everyone> Only ${Math.round((joinDuration - t) / 60000)} minutes left to join! [Join here](${joinMessageLink})`);
    }, t);
  }

  collector.on('end', async () => {
    if (!currentGame.players.length) {
      gauntletActive = false;
      return message.channel.send("No players joined. The charm fades.");
    }

    currentGame.originalCount = currentGame.players.length;
    message.channel.send(`Join phase ended. ${currentGame.originalCount} players are entering The Gauntlet...`);
    startGauntlet(currentGame.players, message.channel, false);
  });
}
async function startGauntlet(players, channel, isTrial = false) {
  currentGame.channel = channel;
  currentGame.players = players;
  currentGame.originalCount = players.length;
  currentGame.eliminated = [];
  currentGame.trial = isTrial;

  let roundNumber = 1;

  // === Boss Vote Phase ===
  const bossCandidates = shuffleArray(players).slice(0, 5);
  const row = new ActionRowBuilder().addComponents(
    bossCandidates.map((p, i) =>
      new ButtonBuilder()
        .setCustomId(`bossvote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const bossEmbed = new EmbedBuilder()
    .setTitle("🧟 BOSS VOTE")
    .setDescription("Choose a Boss for this Gauntlet. They will gain an extra life and wear the crown.")
    .setColor(0x8844ee);

  const voteMsg = await channel.send({ embeds: [bossEmbed], components: [row] });

  const voteCollector = voteMsg.createMessageComponentCollector({ time: 10000 });
  const voteTally = new Map();

  voteCollector.on('collect', async i => {
    if (!voteTally.has(i.user.id)) {
      const choice = i.customId.split('_')[1];
      voteTally.set(i.user.id, choice);
      await i.reply({ content: `You voted for <@${choice}> as Boss!`, ephemeral: true });
    }
  });

  voteCollector.on('end', async () => {
    const counts = {};
    for (const vote of voteTally.values()) {
      counts[vote] = (counts[vote] || 0) + 1;
    }

    const winnerId = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
    const winner = players.find(p => p.id === winnerId);

    if (winner) {
      const oldLives = currentGame.lives.get(winner.id) || 1;
      currentGame.lives.set(winner.id, oldLives + 1);

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle("👑 Boss Crowned")
          .setDescription(`<@${winner.id}> has been crowned Boss and now has **${oldLives + 1} lives**.`)
          .setColor(0xff66cc)]
      });
    } else {
      await channel.send("🌀 No Boss crowned. The charm frowns.");
    }

    // Begin the main game loop
    runGauntlet(roundNumber, isTrial);
  });
}
async function runGauntlet(round = 1, isTrial = false) {
  const channel = currentGame.channel;

  while (currentGame.players.length > 3 && gauntletActive) {
    const total = currentGame.originalCount;
    const remaining = currentGame.players.length;

    // === Embed 1: Lore Intro ===
    const loreType = Math.random() < 0.5 ? uglychants : warpEchoes;
    const lore = getRandom(loreType);
    const loreEmbed = new EmbedBuilder()
      .setTitle(`🌀 Event ${round}`)
      .setDescription(lore)
      .setColor(0x663399);
    await channel.send({ embeds: [loreEmbed] });

    await sleep(1500);

    // === Embed 2: Interactive Event ===
    const isMutation = Math.random() < 0.5;
    if (isMutation) {
      const event = getRandom(mutationEvents);
      const mutationEmbed = new EmbedBuilder()
        .setTitle(`🧬 Mutation: ${event.name}`)
        .setDescription(event.description)
        .setColor(0x9933ff);
      await channel.send({ embeds: [mutationEmbed] });
      await sleep(1000);
      await event.effect({ channel }, currentGame.players, currentGame.eliminated);
    } else {
      const miniGame = getRandom(mutationMiniGames);
      const miniEmbed = new EmbedBuilder()
        .setTitle(`🎮 Mini-Game: ${miniGame.name}`)
        .setDescription(miniGame.description)
        .setColor(0x33ccff);
      await channel.send({ embeds: [miniEmbed] });
      await sleep(1000);
      await miniGame.effect({ channel }, currentGame.players, currentGame.eliminated);
    }

    await sleep(2500);

    // === Embed 3: Oracle Riddle + Player Count Ratio ===
    const riddle = getRandom(uglyOracleRiddles);
    const ratioEmbed = new EmbedBuilder()
      .setTitle("🔮 Ugly Oracle Riddle + Status")
      .setDescription(`${riddle}\n\n**${formatRatio(currentGame.players.length, total)}** remain.`)
      .setColor(0xffff66);
    await channel.send({ embeds: [ratioEmbed] });

    await sleep(3000);

    // === Elimination Round ===
    const shuffled = shuffleArray(currentGame.players);
    const deaths = Math.min(2, Math.floor(Math.random() * 2) + 1);
    const eliminated = [];

    for (let i = 0; i < deaths && shuffled[i]; i++) {
      const target = shuffled[i];
      const currentLives = currentGame.lives.get(target.id) || 1;

      if (currentLives > 1) {
        currentGame.lives.set(target.id, currentLives - 1);
      } else {
        currentGame.players = currentGame.players.filter(p => p.id !== target.id);
        currentGame.eliminated.push(target.id);
        eliminated.push(`☠️ <@${target.id}> ${getRandom(eliminationReasons)}`);
      }
    }

    if (eliminated.length) {
      const elimEmbed = new EmbedBuilder()
        .setTitle("💀 Eliminated This Round")
        .setDescription(eliminated.join('\n'))
        .setColor(0xaa0000);
      await channel.send({ embeds: [elimEmbed] });
    }

    // === Mass Revival Phase ===
    const eliminatedRatio = currentGame.eliminated.length / total;
    if (eliminatedRatio >= 0.5 && !currentGame.massRevived) {
      currentGame.massRevived = true;
      await runMassRevivalEvent(channel);
    }

    // === Head-to-Head Duel ===
    if (currentGame.players.length > 3 && Math.random() < 0.3) {
      await runDuel(channel);
    }

    round++;
    await sleep(4000);
  }

  // === Final Podium ===
  await showFinalPodium(channel);
  gauntletActive = false;
}
async function runMassRevivalEvent(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🕯️ Totem of Lost Souls")
    .setDescription("A malformed totem rises. Eliminated souls may now return...\nClick the button within 5 seconds to make your plea.")
    .setColor(0xccccff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('reviveButton')
      .setLabel('Plead for Revival')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const attempted = new Set();
  const revived = [];
  const notChosen = [];

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on('collect', async i => {
    if (i.user.bot || attempted.has(i.user.id)) return;
    attempted.add(i.user.id);

    const wasEliminated = currentGame.eliminated.includes(i.user.id);
    const chance = wasEliminated ? 0.6 : 0.4;

    if (Math.random() < chance) {
      currentGame.players.push({ id: i.user.id, username: i.user.username });
      currentGame.lives.set(i.user.id, 1);
      currentGame.eliminated = currentGame.eliminated.filter(id => id !== i.user.id);
      revived.push(i.user.id);
    } else {
      notChosen.push(i.user.id);
    }

    await i.reply({ content: "⏳ The totem heard you. Judgement falls soon...", ephemeral: true });
  });

  collector.on('end', async () => {
    const lines = [
      ...revived.map(id => `✨ <@${id}> was restored to life.`),
      ...notChosen.map(id => `💀 <@${id}> was rejected by the totem.`)
    ];

    const resultEmbed = new EmbedBuilder()
      .setTitle("🕯️ Totem Judgement")
      .setDescription(lines.length ? lines.join('\n') : "No one dared the totem.")
      .setColor(0x9999ff);

    await channel.send({ embeds: [resultEmbed] });
  });
}

async function runDuel(channel) {
  const shuffled = shuffleArray(currentGame.players);
  const [a, b] = shuffled;

  if (!a || !b || a.id === b.id) return;

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Head-to-Head Duel")
    .setDescription(`<@${a.id}> vs <@${b.id}>\nClick to survive. One wins, one dies.`)
    .setColor(0xff9999);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_${a.id}`).setLabel(`${a.username}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_${b.id}`).setLabel(`${b.username}`).setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const clicked = new Set();
  const collector = msg.createMessageComponentCollector({ time: 8000 });

  collector.on('collect', async i => {
    if (!clicked.has(i.user.id)) {
      clicked.add(i.user.id);
      await i.reply({ content: "⚡ The charm registers your vote.", ephemeral: true });
    }
  });

  collector.on('end', async () => {
    const winner = Math.random() < 0.5 ? a : b;
    const loser = winner.id === a.id ? b : a;

    currentGame.lives.set(winner.id, (currentGame.lives.get(winner.id) || 1) + 1);
    currentGame.players = currentGame.players.filter(p => p.id !== loser.id);
    currentGame.eliminated.push(loser.id);

    const resultEmbed = new EmbedBuilder()
      .setTitle("🏁 Duel Outcome")
      .setDescription(`🛡️ <@${winner.id}> survived and gains +1 life.\n☠️ <@${loser.id}> has been eliminated.`)
      .setColor(0xffccaa);

    await channel.send({ embeds: [resultEmbed] });
  });
}

async function showFinalPodium(channel) {
  const podium = [...currentGame.players]
    .sort((a, b) => (currentGame.lives.get(b.id) || 1) - (currentGame.lives.get(a.id) || 1))
    .slice(0, 3);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = podium.map((p, i) =>
    `${medals[i]} <@${p.id}> — ${currentGame.lives.get(p.id) || 1} lives`
  );

  const embed = new EmbedBuilder()
    .setTitle("🏆 Final Podium")
    .setDescription(lines.join('\n') || "No survivors.")
    .setColor(0xffff00);

  await channel.send({ embeds: [embed] });

  // === Save Stats ===
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  for (const p of currentGame.players) {
    await db.query(`
      INSERT INTO player_stats (user_id, username, year, month, wins, games_played)
      VALUES ($1, $2, $3, $4, 1, 1)
      ON CONFLICT (user_id, year, month) DO UPDATE
      SET wins = player_stats.wins + 1,
          games_played = player_stats.games_played + 1,
          username = EXCLUDED.username
    `, [p.id, p.username, year, month]);
  }

  for (const id of currentGame.eliminated) {
    await db.query(`
      INSERT INTO player_stats (user_id, username, year, month, revives, games_played)
      VALUES ($1, $2, $3, $4, 0, 1)
      ON CONFLICT (user_id, year, month) DO UPDATE
      SET games_played = player_stats.games_played + 1
    `, [id, id.startsWith("test") ? id : "Unknown", year, month]);
  }

  // === Rematch Button ===
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch')
      .setLabel('Run It Back')
      .setStyle(ButtonStyle.Success)
  );

  const rematchMsg = await channel.send({
    content: "Want to go again? Click below! We need 75% to restart.",
    components: [row]
  });

  const needed = Math.ceil(currentGame.players.length * 0.75);
  const clicked = new Set();

  const collector = rematchMsg.createMessageComponentCollector({ time: 20000 });
  collector.on('collect', async i => {
    if (!clicked.has(i.user.id)) {
      clicked.add(i.user.id);
      await i.reply({ content: "You’ve voted to rematch!", ephemeral: true });
    }

    if (clicked.size >= needed && consecutiveRematches < MAX_REMATCHES) {
      consecutiveRematches++;
      await channel.send("🔥 Enough votes! Starting again...");
      return startGauntlet(currentGame.players, channel, false);
    }
  });

  collector.on('end', () => {
    if (clicked.size < needed || consecutiveRematches >= MAX_REMATCHES) {
      channel.send("💤 No rematch this time.");
      consecutiveRematches = 0;
    }
  });
}

// === Client Login ===
client.once('ready', () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
