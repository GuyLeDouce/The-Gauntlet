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
// Game State
let gameInProgress = false;
let entrants = [];
let eliminated = [];
let revivable = [];
let round = 0;
let originalCount = 0;
let massRevivalTriggered = false;

// Admin Config Per Server
const serverSettings = new Map();

// Helper Functions
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function formatEntrants() {
  return entrants.map(e => `<@${e.id}>`).join(', ');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function generateNFTImageURL(baseURL) {
  const tokenId = Math.floor(Math.random() * 530) + 1;
  return `${baseURL}${tokenId}.jpg`;
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
  "put their trust in a Squig. Rookie mistake.",
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
  "escaped limbo by drawing a perfect Squig.",
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
  "got rugged by a Squig pretending to be a mod.",
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

  // Join command
  if (content === '!gauntlet') {
    if (gameInProgress) return message.reply("A Gauntlet is already in progress!");

    entrants = [{ id: message.author.id, username: message.author.username }];
    eliminated = [];
    revivable = [];
    round = 0;
    originalCount = 1;
    massRevivalTriggered = false;
    gameInProgress = true;

    const joinEmbed = new EmbedBuilder()
      .setTitle("⚔️ The Ugly Gauntlet Begins!")
      .setDescription(`<@${message.author.id}> has summoned the Gauntlet!\nClick below to enter the arena.`)
      .setColor(0xff0000);

    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Danger)
    );

    const joinMessage = await message.channel.send({ embeds: [joinEmbed], components: [joinRow] });

    // 30-second join window with countdown updates
    let joinSeconds = 30;
    const joinInterval = setInterval(async () => {
      joinSeconds -= 10;
      if (joinSeconds > 0) {
        joinEmbed.setFooter({ text: `⏳ Game starts in ${joinSeconds} seconds...` });
        await joinMessage.edit({ embeds: [joinEmbed] });
      } else {
        clearInterval(joinInterval);
        if (entrants.length < 3) {
          gameInProgress = false;
          return message.channel.send("❌ Not enough players joined the Gauntlet.");
        }
        joinEmbed.setFooter(null);
        await joinMessage.edit({ components: [] });
        runGauntlet(message.channel);
      }
    }, 10000);
  }

  // Trial version
  if (content === '!gauntlettrial') {
    if (gameInProgress) return message.reply("A Gauntlet is already in progress!");

    const trialPlayers = Array.from({ length: 20 }, (_, i) => ({
      id: `Trial${i + 1}`,
      username: `Ugly${Math.floor(Math.random() * 999)}`
    }));

    entrants = trialPlayers;
    eliminated = [];
    revivable = [];
    round = 0;
    originalCount = trialPlayers.length;
    massRevivalTriggered = false;
    gameInProgress = true;

    await message.channel.send("🎮 Starting Gauntlet Trial Mode...");
    runGauntlet(message.channel);
  }
});
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet') {
    const alreadyJoined = entrants.some(e => e.id === interaction.user.id);
    if (alreadyJoined) {
      return interaction.reply({ content: '🌀 You are already in the Gauntlet!', ephemeral: true });
    }

    entrants.push({ id: interaction.user.id, username: interaction.user.username });
    originalCount = entrants.length;

    await interaction.reply({ content: `⚔️ <@${interaction.user.id}> has joined the Gauntlet!`, ephemeral: false });
  }

  if (interaction.customId === 'rematch_gauntlet') {
    const alreadyJoined = entrants.some(e => e.id === interaction.user.id);
    if (alreadyJoined) {
      return interaction.reply({ content: '🌀 You already joined the rematch!', ephemeral: true });
    }

    entrants.push({ id: interaction.user.id, username: interaction.user.username });
    originalCount = entrants.length;

    await interaction.reply({ content: `⚔️ <@${interaction.user.id}> is in for the rematch!`, ephemeral: false });
  }
});
async function runGauntlet(channel) {
  await delay(2000);
  await channel.send("🎲 The Gauntlet is underway... prepare yourselves!");

  while (entrants.length > 1) {
    round++;
    await delay(3000);

    // Mutation Round (25% chance)
    if (Math.random() < 0.25) {
      const mutationEmbed = new EmbedBuilder()
        .setTitle("🧬 Mutation Round!")
        .setDescription("Reality warps... something is not right.")
        .setColor(0x8800ff);
      await channel.send({ embeds: [mutationEmbed] });
      await delay(2000);
    }

    // Boss Round (1 in 8 chance)
    if (Math.floor(Math.random() * 8) === 0) {
      const boss = getRandomItem(entrants);
      await channel.send(`👹 A Boss appears! <@${boss.id}> is chosen to fight!`);
      await delay(2000);
      const survived = Math.random() < 0.5;
      if (!survived) {
        eliminated.push(boss);
        entrants = entrants.filter(p => p.id !== boss.id);
        await channel.send(`💀 <@${boss.id}> was defeated by the Boss and eliminated!`);
      } else {
        await channel.send(`🛡️ <@${boss.id}> survived the Boss encounter!`);
      }
      await delay(2000);
    }

    // 1-in-4 chance of special elimination
    const useSpecial = Math.random() < 0.25;
    const victim = getRandomItem(entrants);
    const eliminationText = useSpecial
      ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
      : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

    entrants = entrants.filter(p => p.id !== victim.id);
    eliminated.push(victim);

    const tokenImage = generateNFTImageURL(serverSettings.get(channel.guildId)?.imageBaseURL || "https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/");

    const elimEmbed = new EmbedBuilder()
      .setTitle(`💀 ELIMINATED`)
      .setDescription(`<@${victim.id}> ${eliminationText}`)
      .setImage(tokenImage)
      .setColor(0xff3333);

    await channel.send({ embeds: [elimEmbed] });

    // Revival Chance (15%)
    if (Math.random() < 0.15 && eliminated.length > 0) {
      const comeback = getRandomItem(eliminated);
      eliminated = eliminated.filter(p => p.id !== comeback.id);
      entrants.push(comeback);

      const revivalEmbed = new EmbedBuilder()
        .setTitle(`🌟 REVIVAL!`)
        .setDescription(`<@${comeback.id}> ${getRandomItem(revivalEvents)}`)
        .setColor(0x00ffcc);
      await delay(1000);
      await channel.send({ embeds: [revivalEmbed] });
    }

    // Mass revival when <= 1/3 remain and hasn't triggered yet
    if (!massRevivalTriggered && entrants.length <= Math.ceil(originalCount / 3)) {
      massRevivalTriggered = true;
      await runMassRevival(channel);
    }

    await delay(4000);
  }

  const winner = entrants[0];
  await channel.send(`🏆 The Gauntlet is over. Our lone survivor: <@${winner.id}>!`);
  await recordWin(winner);
  await runRematchPrompt(channel);
}
async function runMassRevival(channel) {
  const revivalEmbed = new EmbedBuilder()
    .setTitle("🔺 Totem of Lost Souls")
    .setDescription("The Totem trembles... a chance for the fallen to return.")
    .setColor(0xff66cc);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mass_revive')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Primary)
  );

  const revivalMsg = await channel.send({ embeds: [revivalEmbed], components: [row] });

  const filter = i => !entrants.some(p => p.id === i.user.id) && eliminated.some(p => p.id === i.user.id);
  const collector = revivalMsg.createMessageComponentCollector({ filter, time: 4000 });

  const attempted = new Set();

  collector.on('collect', async i => {
    attempted.add(i.user.id);
    await i.reply({ content: '🔮 You have touched the Totem...', ephemeral: true });
  });

  collector.on('end', async () => {
    const tried = [...attempted];
    const survivors = [];
    const failEmbed = new EmbedBuilder()
      .setTitle("💀 Totem Judgment")
      .setColor(0x660000);

    if (Math.random() < 0.5 && tried.length > 0) {
      for (const id of tried) {
        const player = eliminated.find(p => p.id === id);
        if (player) {
          eliminated = eliminated.filter(p => p.id !== id);
          entrants.push(player);
          survivors.push(`<@${id}>`);
        }
      }

      failEmbed.setDescription(`✨ ${survivors.join(', ')} have returned!`);
    } else {
      failEmbed.setDescription("☠️ The Totem rejected all who tried... perhaps next time.");
    }

    await channel.send({ embeds: [failEmbed] });
  });
}

async function recordWin(winner) {
  const { month, year } = getMonthYear();

  const result = await db.query(
    `SELECT * FROM player_stats WHERE user_id = $1 AND month = $2 AND year = $3`,
    [winner.id, month, year]
  );

  if (result.rows.length === 0) {
    await db.query(
      `INSERT INTO player_stats (user_id, username, month, year, wins, games_played)
       VALUES ($1, $2, $3, $4, 1, 1)`,
      [winner.id, winner.username, month, year]
    );
  } else {
    await db.query(
      `UPDATE player_stats
       SET wins = wins + 1, games_played = games_played + 1
       WHERE user_id = $1 AND month = $2 AND year = $3`,
      [winner.id, month, year]
    );
  }
}

async function runRematchPrompt(channel) {
  await delay(2000);
  const rematchEmbed = new EmbedBuilder()
    .setTitle("🔁 Gauntlet Rematch?")
    .setDescription("Gather your courage and click below to trigger a new Gauntlet.")
    .setColor(0x3399ff);

  const rematchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_gauntlet')
      .setLabel('Join Rematch')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [rematchEmbed], components: [rematchRow] });

  let rematchCount = 0;
  const collector = msg.createMessageComponentCollector({ time: 30000 });

  collector.on('collect', async i => {
    const already = entrants.some(p => p.id === i.user.id);
    if (!already) {
      entrants.push({ id: i.user.id, username: i.user.username });
      rematchCount++;
      await i.reply({ content: '🔁 You’re in for the rematch!', ephemeral: true });
    }
  });

  collector.on('end', async () => {
    if (entrants.length >= originalCount + 1) {
      await channel.send("⚔️ Enough have joined! Starting rematch...");
      await delay(1000);
      eliminated = [];
      revivable = [];
      round = 0;
      massRevivalTriggered = false;
      originalCount = entrants.length;
      runGauntlet(channel);
    } else {
      await channel.send("⏹️ Not enough joined for a rematch. The Gauntlet rests... for now.");
      gameInProgress = false;
    }
  });
}
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

  if (content === '!leaderboard' || content === '!lb') {
    const { month, year } = getMonthYear();

    const topWins = await db.query(`
      SELECT username, wins FROM player_stats
      WHERE month = $1 AND year = $2
      ORDER BY wins DESC LIMIT 3
    `, [month, year]);

    const topRevives = await db.query(`
      SELECT username, revives FROM player_stats
      WHERE month = $1 AND year = $2
      ORDER BY revives DESC LIMIT 3
    `, [month, year]);

    const topGames = await db.query(`
      SELECT username, games_played FROM player_stats
      WHERE month = $1 AND year = $2
      ORDER BY games_played DESC LIMIT 3
    `, [month, year]);

    const formatList = (label, rows, key) => {
      if (rows.length === 0) return `**${label}**\n_No entries yet._\n`;
      return `**${label}**\n` + rows.map((r, i) => `\`${i + 1}.\` ${r.username} — ${r[key]}`).join('\n') + '\n';
    };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Monthly Gauntlet Leaderboard (${month}/${year})`)
      .setDescription(
        formatList("🏆 Most Wins", topWins.rows, "wins") +
        formatList("🧟‍♂️ Most Revives", topRevives.rows, "revives") +
        formatList("🎮 Most Games Played", topGames.rows, "games_played")
      )
      .setColor(0x00ccff);

    await message.channel.send({ embeds: [embed] });
  }

  if (content.startsWith('!stats')) {
    const target = message.mentions.users.first() || message.author;
    const { month, year } = getMonthYear();

    const result = await db.query(
      `SELECT * FROM player_stats WHERE user_id = $1 AND month = $2 AND year = $3`,
      [target.id, month, year]
    );

    if (result.rows.length === 0) {
      return message.channel.send(`📉 No stats recorded for <@${target.id}> this month.`);
    }

    const stats = result.rows[0];
    const embed = new EmbedBuilder()
      .setTitle(`📈 Stats for ${target.username} (${month}/${year})`)
      .addFields(
        { name: "Wins", value: `${stats.wins}`, inline: true },
        { name: "Revives", value: `${stats.revives}`, inline: true },
        { name: "Games Played", value: `${stats.games_played}`, inline: true }
      )
      .setColor(0x00cc66);

    await message.channel.send({ embeds: [embed] });
  }
});

// Log in bot
client.login(process.env.BOT_TOKEN);
