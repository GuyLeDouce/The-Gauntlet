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
  const tokenId = Math.floor(Math.random() * 613) + 1;
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
 // Join command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();
  if (content.startsWith('!gauntlettrial')) {
  if (gameInProgress) return message.reply("A Gauntlet is already in progress!");

  const args = content.split(' ');
  let count = parseInt(args[1]);
  if (isNaN(count) || count < 5) count = 20;
  if (count > 100) count = 100; // prevent abuse

  const emojiSet = ['😈', '👺', '🤡', '👹', '👻', '🦴', '🧟‍♂️', '💀', '🐷', '🪰'];

  const trialPlayers = Array.from({ length: count }, (_, i) => ({
    id: `Trial${i + 1}`,
    username: `${getRandomItem(emojiSet)} Ugly${Math.floor(Math.random() * 1000)}`,
    lives: 1
  }));

  entrants = trialPlayers;
  eliminated = [];
  revivable = [];
  round = 0;
  originalCount = trialPlayers.length;
  massRevivalTriggered = false;
  gameInProgress = true;

  await message.channel.send(`🧪 Starting Gauntlet Trial Mode with **${count}** randomly generated test players...`);
  await runBossVotePhase(message.channel);
}
    if (content.startsWith('!gauntlet')) {
  if (gameInProgress) return message.reply("A Gauntlet is already in progress!");

  const args = content.split(' ');
  let minutes = parseFloat(args[1]);
  if (isNaN(minutes)) minutes = 3;
  if (minutes < 0.25) minutes = 0.25;
  if (minutes > 10) minutes = 10;
  const joinTime = Math.floor(minutes * 60); // total seconds

  entrants = [{ id: message.author.id, username: message.author.username, lives: 1 }];
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

  let secondsLeft = joinTime;
  const interval = 15;
  const oneThird = Math.floor(joinTime * (1 / 3));
  const twoThirds = Math.floor(joinTime * (2 / 3));
  const countdownMarks = new Set([twoThirds, oneThird, 10]);

  const joinInterval = setInterval(async () => {
    secondsLeft -= interval;

    // Update embed footer
    if (secondsLeft > 0) {
      joinEmbed.setFooter({ text: `⏳ Game starts in ${secondsLeft} seconds...` });
      await joinMessage.edit({ embeds: [joinEmbed] });

      // Post visible countdown messages at 2/3, 1/3, and final 10 seconds
      if (countdownMarks.has(secondsLeft)) {
        await message.channel.send(`@everyone ⏳ **${secondsLeft} seconds left to join The Gauntlet!** Click the button now!`);
      }
    } else {
      clearInterval(joinInterval);
      if (entrants.length < 3) {
        gameInProgress = false;
        return message.channel.send("❌ Not enough players joined the Gauntlet.");
      }
      joinEmbed.setFooter(null);
      await joinMessage.edit({ components: [] });
      await runBossVotePhase(message.channel);
    }
  }, interval * 1000);
}
});

// Join button handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'join_gauntlet') {
    const alreadyJoined = entrants.some(e => e.id === interaction.user.id);
    if (alreadyJoined) {
      return interaction.reply({ content: '🌀 You are already in the Gauntlet!', ephemeral: true });
    }

    entrants.push({ id: interaction.user.id, username: interaction.user.username, lives: 1 });
    originalCount = entrants.length;

    await interaction.reply({ content: `⚔️ <@${interaction.user.id}> has joined the Gauntlet!`, ephemeral: false });
  }

  if (interaction.customId.startsWith('vote_boss_')) {
    const votedId = interaction.customId.split('_')[2];
    const voterId = interaction.user.id;

    if (bossVotes[voterId]) {
      return interaction.reply({ content: "🗳️ You've already voted for Boss Level Ugly!", ephemeral: true });
    }

    bossVotes[voterId] = votedId;
    await interaction.reply({ content: `✅ Your vote for <@${votedId}> has been counted.`, ephemeral: true });
  }

  if (interaction.customId === 'rematch_gauntlet') {
    const alreadyJoined = entrants.some(e => e.id === interaction.user.id);
    if (alreadyJoined) {
      return interaction.reply({ content: '🌀 You already joined the rematch!', ephemeral: true });
    }

    entrants.push({ id: interaction.user.id, username: interaction.user.username, lives: 1 });
    originalCount = entrants.length;

    await interaction.reply({ content: `⚔️ <@${interaction.user.id}> is in for the rematch!`, ephemeral: false });
  }

  if (interaction.customId === 'mass_revive') {
    if (!massReviveOpen) return interaction.reply({ content: "⛔ The Totem is not active right now!", ephemeral: true });

    const alreadyTried = massReviveAttempts.has(interaction.user.id);
    if (alreadyTried) {
      return interaction.reply({ content: "☠️ You already attempted to touch the Totem!", ephemeral: true });
    }

    const isValid = !entrants.some(p => p.id === interaction.user.id);
    if (isValid) {
      massReviveAttempts.add(interaction.user.id);
      await interaction.reply({ content: "🔮 You have touched the Totem of Lost Souls...", ephemeral: true });
    } else {
      await interaction.reply({ content: "❌ You're still alive in the Gauntlet!", ephemeral: true });
    }
  }
});

let bossVotes = {};

async function runBossVotePhase(channel) {
  bossVotes = {}; // reset votes
  const candidates = shuffleArray(entrants).slice(0, 5);

  const voteEmbed = new EmbedBuilder()
    .setTitle("👑 Choose the Boss Level Ugly")
    .setDescription("You have 15 seconds to vote!\nThe chosen one will receive **2 lives** in The Gauntlet.")
    .addFields(candidates.map((c, i) => ({
      name: `Option ${i + 1}`,
      value: `<@${c.id}>`,
      inline: true
    })))
    .setColor(0xffaa00);

  const voteRow = new ActionRowBuilder();
  candidates.forEach((c, i) => {
    voteRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_boss_${c.id}`)
        .setLabel(`Vote ${c.username}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const voteMsg = await channel.send({ embeds: [voteEmbed], components: [voteRow] });

  await delay(15000);

  // Tally votes
  const voteCounts = {};
  for (const voter in bossVotes) {
    const voted = bossVotes[voter];
    voteCounts[voted] = (voteCounts[voted] || 0) + 1;
  }

  const winnerId = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || candidates[0].id;
  const bossPlayer = entrants.find(p => p.id === winnerId);
  if (bossPlayer) bossPlayer.lives = 2;

  await channel.send(`👑 <@${bossPlayer.id}> has been chosen as **Boss Level Ugly** and now has **2 lives**!`);
  await runGauntlet(channel);
}
async function runGauntlet(channel) {
  await delay(2000);
  await channel.send("🎲 The Gauntlet begins now... let the eliminations commence!");

  while (entrants.length > 1) {
    round++;
    await delay(2000);

    const nftToken = Math.floor(Math.random() * 530) + 1;
    const imageURL = `${serverSettings.get(channel.guildId)?.imageBaseURL || "https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/"}${nftToken}.jpg`;

    // MUTATION ROUND? Add a gameplay twist
    let mutationText = "";
    if (Math.random() < 0.25) {
  await runMutationEvent(channel);
  await delay(3000);
}
     
    // Handle round eliminations (2–3 players)
    const killsThisRound = Math.min(Math.floor(Math.random() * 2) + 2, entrants.length - 1);
    const roundEliminated = [];
    const elimDescriptions = [];

    for (let i = 0; i < killsThisRound; i++) {
      const victim = getRandomItem(entrants);
      const isBoss = victim.lives > 1;

      if (isBoss) {
        victim.lives -= 1;
        elimDescriptions.push(`🛡️ <@${victim.id}> lost 1 life but survives as Boss Level Ugly!`);
      } else {
        entrants = entrants.filter(p => p.id !== victim.id);
        eliminated.push(victim);
        const message = Math.random() < 0.3
          ? getRandomItem(specialEliminations)
          : getRandomItem(eliminationEvents);
        elimDescriptions.push(`💀 <@${victim.id}> ${message}`);
        roundEliminated.push(victim);
      }
    }

    // REVIVAL CHANCE (15%)
    if (Math.random() < 0.15 && eliminated.length > 0) {
      const comeback = getRandomItem(eliminated);
      eliminated = eliminated.filter(p => p.id !== comeback.id);
      entrants.push({ ...comeback, lives: 1 });
      elimDescriptions.push(`🌟 <@${comeback.id}> ${getRandomItem(revivalEvents)}`);
    }

    // Mass revive trigger
    if (!massRevivalTriggered && entrants.length <= Math.ceil(originalCount / 3)) {
      massRevivalTriggered = true;
      await runMassRevival(channel);
    }

    // Round summary embed
    const roundEmbed = new EmbedBuilder()
      .setTitle(`⚔️ Round ${round}`)
      .setDescription(`${mutationText ? mutationText + '\n\n' : ''}${elimDescriptions.join('\n')}\n\n**🧍 ${entrants.length} of ${originalCount} remain.**`)
      .setImage(imageURL)
      .setColor(0xff4444);

    await channel.send({ embeds: [roundEmbed] });
    await delay(4000);
  }

  const winner = entrants[0];
  await channel.send(`🏆 The Gauntlet has ended. Our survivor: <@${winner.id}>`);
  await recordWin(winner);
  await announceTop3(channel, winner);
  await runRematchPrompt(channel);
}
let massReviveOpen = false;
let massReviveAttempts = new Set();

async function runMassRevival(channel) {
  massReviveOpen = true;
  massReviveAttempts = new Set();

  const totemEmbed = new EmbedBuilder()
    .setTitle("🌀 Totem of Lost Souls")
    .setDescription("Eliminated players and outsiders may now attempt to return.\nTouch the totem… if you dare.")
    .setColor(0x9933ff);

  const reviveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mass_revive')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [totemEmbed], components: [reviveRow] });

  await delay(8000);
  for (let i = 12; i >= 1; i -= 3) {
    await channel.send(`⏳ Totem resolves in **${i}** seconds...`);
    await delay(3000);
  }

  massReviveOpen = false;

  const attemptedIds = [...massReviveAttempts];
  const survivors = [];

  if (Math.random() < 0.5 && attemptedIds.length > 0) {
    for (const id of attemptedIds) {
      const existing = eliminated.find(p => p.id === id);
      const revived = existing || { id, username: `??`, lives: 1 };
      entrants.push({ ...revived, lives: 1 });
      survivors.push(`<@${id}>`);
      if (existing) {
        eliminated = eliminated.filter(p => p.id !== id);
      }
    }

    const returnEmbed = new EmbedBuilder()
      .setTitle("🌟 Totem Judgment")
      .setDescription(`The Totem pulses with energy...\n${survivors.join(', ')} **have returned to the Gauntlet!**`)
      .setColor(0x00ff99);
    await channel.send({ embeds: [returnEmbed] });
  } else {
    const failEmbed = new EmbedBuilder()
      .setTitle("☠️ Totem Judgment")
      .setDescription("The Totem rejects all who reached for it...\nNo one returns this time.")
      .setColor(0x660000);
    await channel.send({ embeds: [failEmbed] });
  }

  await delay(2000);
}
async function announceTop3(channel, winner) {
  // Top 3 = [3rd last eliminated, 2nd last eliminated, winner]
  const top3 = [...eliminated.slice(-2), winner];

  const places = ['🥉 3rd Place', '🥈 2nd Place', '🥇 Winner'];
  const podium = top3.map((p, i) => `${places[i]} — <@${p.id}>`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle("🏆 Final Podium")
    .setDescription(podium)
    .setColor(0xffff66);

  await channel.send({ embeds: [embed] });
}
async function runRematchPrompt(channel) {
  await delay(2000);

  const rematchEmbed = new EmbedBuilder()
    .setTitle("🔁 Gauntlet Rematch?")
    .setDescription("Want another shot at glory?\nClick below to join the rematch.\nWe need **75% of the last game** to join.")
    .setColor(0x3399ff);

  const rematchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_gauntlet')
      .setLabel('Join Rematch')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [rematchEmbed], components: [rematchRow] });

  const requiredCount = Math.ceil(originalCount * 0.75);

  const collector = msg.createMessageComponentCollector({ time: 30000 });

  collector.on('collect', async i => {
    const already = entrants.some(p => p.id === i.user.id);
    if (!already) {
      entrants.push({ id: i.user.id, username: i.user.username, lives: 1 });
      await i.reply({ content: '🔁 You’re in for the rematch!', ephemeral: true });
    }
  });

  collector.on('end', async () => {
    if (entrants.length >= requiredCount) {
      await channel.send("⚔️ Enough have joined! The rematch begins...");
      eliminated = [];
      revivable = [];
      round = 0;
      massRevivalTriggered = false;
      originalCount = entrants.length;
      await runBossVotePhase(channel);
    } else {
      await channel.send("⏹️ Not enough joined for a rematch. The Gauntlet rests... for now.");
      gameInProgress = false;
    }
  });
  async function runMutationEvent(channel) {
  const eventTypes = ['last-click-dies', 'first-click-safe', 'reaction-survival', 'emote-sacrifice', 'reverse-totem'];
const type = getRandomItem(eventTypes);

else if (type === 'reaction-survival') {
  const msg = await channel.send("🧬 MUTATION: Only those who react with 🐷 in the next 10 seconds will survive...");

  await msg.react('🐷');

  const collector = msg.createReactionCollector({
    time: 10000,
    filter: (reaction, user) =>
      reaction.emoji.name === '🐷' && entrants.some(p => p.id === user.id),
  });

  const survivors = new Set();

  collector.on('collect', (reaction, user) => {
    survivors.add(user.id);
  });

  collector.on('end', async () => {
    const eliminatedThisRound = entrants.filter(p => !survivors.has(p.id));
    entrants = entrants.filter(p => survivors.has(p.id));
    eliminated.push(...eliminatedThisRound);

    const elimNames = eliminatedThisRound.map(p => `<@${p.id}>`).join('\n') || 'Nobody';
    const embed = new EmbedBuilder()
      .setTitle("☠️ The Reaction Purge")
      .setDescription(`${elimNames} failed to oink and were obliterated.`)
      .setColor(0xff0000);
    await channel.send({ embeds: [embed] });
  });
}
else if (type === 'emote-sacrifice') {
  const msg = await channel.send("🧬 MUTATION: React with 🔥 — only one will be spared...");

  await msg.react('🔥');

  const collector = msg.createReactionCollector({
    time: 7000,
    filter: (reaction, user) =>
      reaction.emoji.name === '🔥' && entrants.some(p => p.id === user.id),
  });

  const reactors = [];

  collector.on('collect', (reaction, user) => {
    if (!reactors.includes(user.id)) reactors.push(user.id);
  });

  collector.on('end', async () => {
    const savedId = getRandomItem(reactors);
    const survivors = entrants.filter(p => p.id === savedId);
    const eliminatedThisRound = entrants.filter(p => p.id !== savedId);
    entrants = survivors;
    eliminated.push(...eliminatedThisRound);

    const embed = new EmbedBuilder()
      .setTitle("🔥 Sacrificial Mutation")
      .setDescription(`<@${savedId}> survives. All others who clicked 🔥 were burned by the lore gods.`)
      .setColor(0xdd3333);
    await channel.send({ embeds: [embed] });
  });
}
else if (type === 'reverse-totem') {
  const embed = new EmbedBuilder()
    .setTitle("🧬 MUTATION: Totem of Deceit")
    .setDescription("The button lies... whoever clicks **dies**.\nWill curiosity kill the cat?")
    .setColor(0x550000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mutation_curse')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({
    time: 10000,
    filter: i => entrants.some(p => p.id === i.user.id),
  });

  let cursed = null;

  collector.on('collect', async i => {
    if (!cursed) {
      cursed = i.user.id;
      await i.reply({ content: '💀 You touched the cursed totem...', ephemeral: true });
    }
  });

  collector.on('end', async () => {
    if (cursed) {
      const victim = entrants.find(p => p.id === cursed);
      entrants = entrants.filter(p => p.id !== cursed);
      eliminated.push(victim);

      const embed = new EmbedBuilder()
        .setTitle("☠️ Cursed by Curiosity")
        .setDescription(`<@${cursed}> couldn’t resist the totem. It was a trap.`)
        .setColor(0xaa0000);
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send("🧘 No one touched the cursed totem. You live — this time.");
    }
  });
}
    
  if (type === 'last-click-dies') {
    const embed = new EmbedBuilder()
      .setTitle("🧬 MUTATION: The Sluggish Reflex")
      .setDescription("The last person to click the **Screaming Button** in 10 seconds will be eliminated.\n\nDo you dare?")
      .setColor(0xaa00ff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mutation_click')
        .setLabel('Screaming Button')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      time: 10000,
      filter: i => entrants.some(p => p.id === i.user.id),
    });

    const clickOrder = [];

    collector.on('collect', async i => {
      if (!clickOrder.includes(i.user.id)) {
        clickOrder.push(i.user.id);
        await i.reply({ content: '😵 You clicked the button!', ephemeral: true });
      }
    });

    collector.on('end', async () => {
      if (clickOrder.length > 0) {
        const last = clickOrder[clickOrder.length - 1];
        const victim = entrants.find(p => p.id === last);
        entrants = entrants.filter(p => p.id !== last);
        eliminated.push(victim);

        const elimEmbed = new EmbedBuilder()
          .setTitle("☠️ Mutation Failure")
          .setDescription(`<@${last}> was too slow... the Gauntlet takes no prisoners.`)
          .setColor(0x880000);
        await channel.send({ embeds: [elimEmbed] });
      } else {
        await channel.send("🌀 No one clicked the Screaming Button... no elimination this round.");
      }
    });
  }

  else if (type === 'first-click-safe') {
    const embed = new EmbedBuilder()
      .setTitle("🧬 MUTATION: Sudden Blessing")
      .setDescription("The first person to click the **Ugly Totem** gains immunity from the next round.\nMove fast!")
      .setColor(0x55ccff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mutation_safe')
        .setLabel('Ugly Totem')
        .setStyle(ButtonStyle.Success)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      time: 10000,
      max: 1,
      filter: i => entrants.some(p => p.id === i.user.id),
    });

    collector.on('collect', async i => {
      await i.reply({ content: '✨ You are now immune from the next round!', ephemeral: true });
      const player = entrants.find(p => p.id === i.user.id);
      player.immune = true;

      const bless = new EmbedBuilder()
        .setTitle("🛡️ Blessing Received")
        .setDescription(`<@${player.id}> is protected next round!`)
        .setColor(0x00ffcc);
      await channel.send({ embeds: [bless] });
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await channel.send("❌ No one clicked the totem. No immunity granted.");
      }
    });
  }
}

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

// Helper: Month/Year getter
function getMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// Helper: Delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Shuffle
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Helper: Random
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Log in bot
client.login(process.env.BOT_TOKEN);
