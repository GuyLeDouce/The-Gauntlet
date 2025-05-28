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
let gameInProgress = false;
let entrants = [];
let eliminatedPlayers = [];
let roundCount = 0;
let currentGameId = null;

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

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Randomly choose between an Ugly or Monster NFT and generate an OpenSea URL
function getRandomNFTImage() {
  const isMonster = Math.random() < 0.5;
  const tokenId = Math.floor(Math.random() * (isMonster ? 126 : 413)) + 1;
  if (isMonster) {
    return `https://opensea.io/assets/ethereum/0x1cd7fe72d64f6159775643acedc7d860dfb80348/${tokenId}`;
  } else {
    return `https://opensea.io/assets/ethereum/0x9492505633d74451bdf3079c09ccc979588bc309/${tokenId}`;
  }
}

// Creates an embed object with the random NFT image
function createNFTEmbed() {
  return {
    image: {
      url: getRandomNFTImage()
    }
  };
}
// Track ongoing game state and players
let gameInProgress = false;
let players = [];
let eliminatedPlayers = [];
let currentGameMessage = null;

// Create 20 fake players for trial mode
function generateTrialPlayers() {
  const trialNames = [
    "Trial1", "Trial2", "Trial3", "Trial4", "Trial5",
    "Trial6", "Trial7", "Trial8", "Trial9", "Trial10",
    "Trial11", "Trial12", "Trial13", "Trial14", "Trial15",
    "Trial16", "Trial17", "Trial18", "Trial19", "Trial20"
  ];
  return trialNames.map(name => ({ id: name, username: name, isTrial: true }));
}
client.on('messageCreate', async message => {
  if (message.content === '!gauntlet' && !gameInProgress) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Only admins can start the Gauntlet.');
    }

    const entrants = Array.from(
      new Set(message.guild.members.cache.filter(m => !m.user.bot).map(m => m.user))
    ).map(user => ({ id: user.id, username: user.username }));

    if (entrants.length < 3) {
      return message.channel.send('Need at least 3 players to start the Gauntlet!');
    }

    players = shuffleArray(entrants);
    eliminatedPlayers = [];
    gameInProgress = true;
    message.channel.send(`⚔️ The Gauntlet has begun with ${players.length} players!`);
    runBossVotePhase(message.channel);
  }

  if (message.content === '!gauntlettrial' && !gameInProgress) {
    players = generateTrialPlayers();
    eliminatedPlayers = [];
    gameInProgress = true;
    message.channel.send('🎮 Starting Gauntlet Trial Mode with 20 randomly generated test players...');
    runBossVotePhase(message.channel);
  }
});
async function runBossVotePhase(channel) {
  const bossCandidates = shuffleArray(players).slice(0, 5);
  const buttons = new ActionRowBuilder();

  bossCandidates.forEach((player, index) => {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_boss_${player.username}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const voteEmbed = new EmbedBuilder()
    .setTitle('👹 Boss Selection Phase')
    .setDescription(`Choose who should become the Boss of this Gauntlet.\nClick a name below to cast your vote!`)
    .setColor('Red');

  const voteMessage = await channel.send({ embeds: [voteEmbed], components: [buttons] });

  const voteCollector = voteMessage.createMessageComponentCollector({ time: 10000 });
  const voteCounts = {};

  voteCollector.on('collect', interaction => {
    if (voteCounts[interaction.user.id]) {
      return interaction.reply({ content: '🛑 You already voted!', ephemeral: true });
    }

    const chosen = interaction.customId.replace('vote_boss_', '');
    voteCounts[interaction.user.id] = chosen;
    interaction.reply({ content: `✅ You voted for ${chosen}`, ephemeral: true });
  });

  voteCollector.on('end', async () => {
    const tally = {};
    Object.values(voteCounts).forEach(name => {
      tally[name] = (tally[name] || 0) + 1;
    });

    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const selectedBoss = sorted.length ? sorted[0][0] : bossCandidates[0].username;

    const boss = players.find(p => p.username === selectedBoss);
    if (boss) boss.isBoss = true;

    await channel.send(`👑 **${selectedBoss}** has been crowned the Boss!\nLet the eliminations begin...`);
    await runGauntlet(channel);
  });
}
async function startGauntlet(channel, isTrial = false) {
  if (gameInProgress) {
    channel.send('⚠️ A game is already in progress.');
    return;
  }

  gameInProgress = true;
  players = isTrial ? generateTrialPlayers() : [...entrants];
  eliminatedPlayers = [];
  audienceVotes = {};
  trapImmunity.clear();
  trapUsed.clear();
  warpEventUsed.clear();
  mutationUsed = false;
  totemUsed = false;

  const joinList = players.map(p => `<@${p.id || p.username}>`).join(', ');
  await channel.send(`🎮 Starting ${isTrial ? 'Gauntlet Trial Mode' : 'The Gauntlet'} with ${players.length} player(s)...`);
  await runBossVotePhase(channel);
}

async function runGauntlet(channel) {
  let round = 1;
  while (players.length > 1) {
    await new Promise(res => setTimeout(res, 5000));

    if (Math.random() < 0.2 && !mutationUsed) {
      mutationUsed = true;
      await runMutationRound(channel);
      continue;
    }

    if (Math.random() < 0.2 && !trapUsed.has(round)) {
      trapUsed.add(round);
      await runSurvivalTrap(channel);
      continue;
    }

    if (Math.random() < 0.2 && !warpEventUsed.has(round)) {
      warpEventUsed.add(round);
      await runWarpEvent(channel);
      continue;
    }

    await runEliminationRound(channel, round);

    // Mass Revival if 1/3 or fewer players remain and totem hasn't been used
    if (!totemUsed && players.length <= Math.ceil((players.length + eliminatedPlayers.length) / 3)) {
      totemUsed = true;
      await triggerMassRevival(channel);
    }

    round++;
  }

  await endGame(channel);
}
async function runEliminationRound(channel, round) {
  const eliminated = [];
  const survivors = [];

  for (let player of players) {
    if (Math.random() < 0.5) {
      eliminated.push(player);
    } else {
      survivors.push(player);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`💀 Round ${round} Eliminations`)
    .setColor(0xff0000);

  for (let player of eliminated) {
    eliminatedPlayers.push(player);
    const nftImage = await fetchRandomNftImage();
    const line = Math.random() < 0.2 ? getRandom(specialEliminations) : getRandom(eliminationEvents);
    embed.addFields({ name: player.username || `<@${player.id}>`, value: line });
    if (nftImage) embed.setImage(nftImage);
  }

  if (eliminated.length === 0) {
    embed.setDescription(`⚠️ Everyone dodged elimination this round!`);
  }

  await channel.send({ embeds: [embed] });
  players = survivors;
}

async function fetchRandomNftImage() {
  try {
    const isMonster = Math.random() < 0.15; // ~15% chance for Monster
    const tokenId = isMonster ? Math.floor(Math.random() * 126) + 1 : Math.floor(Math.random() * 7777) + 1;
    const contract = isMonster ? '0x1cd7fe72d64f6159775643acedc7d860dfb80348' : '0x9492505633d74451bdf3079c09ccc979588bc309';
    return `https://opensea.io/assets/${contract}/${tokenId}`;
  } catch (err) {
    return null;
  }
}
async function runSurvivalTrap(channel) {
  const embed = new EmbedBuilder()
    .setTitle("💥 Survival Trap Activated!")
    .setDescription("Click the survival button within 7 seconds or be eliminated!")
    .setColor(0xff6600);

  const button = new ButtonBuilder()
    .setCustomId("survive_button")
    .setLabel("SURVIVE!")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(button);

  const trapMsg = await channel.send({ embeds: [embed], components: [row] });

  const trapCollector = trapMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 7000,
  });

  const survivors = new Set();
  trapCollector.on("collect", (i) => {
    survivors.add(i.user.id);
    i.reply({ content: "💨 You survived!", ephemeral: true });
  });

  trapCollector.on("end", async () => {
    const eliminated = players.filter(p => !survivors.has(p.id));
    const survivorPlayers = players.filter(p => survivors.has(p.id));

    for (let elim of eliminated) {
      eliminatedPlayers.push(elim);
    }

    players = survivorPlayers;

    const resultEmbed = new EmbedBuilder()
      .setTitle("☠️ Trap Results")
      .setColor(0xcc0000)
      .setDescription(
        eliminated.length === 0
          ? "Everyone reacted in time! No eliminations."
          : `The following were too slow:\n${eliminated.map(p => `<@${p.id}>`).join(", ")}`
      );

    await channel.send({ embeds: [resultEmbed] });
  });
}

async function runMutationRound(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🧬 Mutation Round!")
    .setDescription(getRandom(mutationMessages))
    .setColor(0x8800ff);
  await channel.send({ embeds: [embed] });
}

async function maybeTriggerWarpEvent(channel) {
  if (Math.random() < 0.15) {
    const embed = new EmbedBuilder()
      .setTitle("🌌 WARP EVENT")
      .setDescription(getRandom(warpEvents))
      .setColor(0x00ffff);
    await channel.send({ embeds: [embed] });
  }
}
async function attemptMassRevival(channel) {
  if (players.length > 5) return;
  const embed = new EmbedBuilder()
    .setTitle("💀 Totem of Lost Souls")
    .setDescription("A mysterious totem appears, pulsing with forgotten energy... You have 10 seconds to press the button and attempt resurrection!")
    .setColor(0x550000);

  const button = new ButtonBuilder()
    .setCustomId("revive_button")
    .setLabel("Touch the Totem")
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(button);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10000 });
  const reviveAttempts = new Set();

  collector.on("collect", async (i) => {
    if (players.find(p => p.id === i.user.id)) {
      return i.reply({ content: "You're already alive!", ephemeral: true });
    }
    reviveAttempts.add(i.user.id);
    i.reply({ content: "🌀 You touched the Totem...", ephemeral: true });
  });

  collector.on("end", async () => {
    const revived = [];
    const failed = [];

    for (let id of reviveAttempts) {
      const success = Math.random() < 0.5;
      const name = (await i.guild.members.fetch(id)).displayName || "Unknown";
      if (success) {
        players.push({ id, name });
        revived.push(`<@${id}>`);
      } else {
        failed.push(`<@${id}>`);
      }
    }

    const summary = new EmbedBuilder()
      .setTitle("Totem Judgement")
      .setColor(revived.length ? 0x00ff00 : 0xff0000)
      .setDescription(
        revived.length
          ? `🔥 Returned to fight:\n${revived.join(", ")}\n\n💀 Lost in the void:\n${failed.join(", ")}`
          : `No souls returned. The Totem has vanished.`
      );

    await channel.send({ embeds: [summary] });
  });
}

async function displayFinalPodium(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 Final Podium")
    .setColor(0xffcc00);

  let podium = [];
  if (players.length >= 3) {
    podium = [...players];
  } else {
    podium = [...players, ...eliminatedPlayers.slice(-3 + players.length)].slice(0, 3);
  }

  podium = podium.slice(0, 3).reverse(); // Reverse for 1st on top
  const medals = ["🥇", "🥈", "🥉"];

  embed.setDescription(
    podium
      .map((p, i) => `${medals[i]} ${p.name ? `<@${p.id}>` : p}`)
      .join("\n") + `\n\nLegends fall hard. Stay Ugly.`
  );

  await channel.send({ embeds: [embed] });
}
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === '!gauntlettrial') {
    if (gameInProgress) return message.reply("🛑 A Gauntlet is already in progress.");
    gameInProgress = true;
    players = generateTrialPlayers(20);
    eliminatedPlayers = [];
    gameHost = message.author;
    await message.channel.send("🎮 Starting Gauntlet Trial Mode with 20 randomly generated test players...");
    await runBossVotePhase(message.channel);
    await runGauntlet(message.channel);
    await displayFinalPodium(message.channel);
    gameInProgress = false;
  }
});
client.login(process.env.TOKEN);
