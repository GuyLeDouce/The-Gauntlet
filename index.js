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
    console.log('📊 Tables are ready!');
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

let currentGame = null;
let gameActive = false;
let gamePlayers = [];
let eliminatedPlayers = [];
let revivalAttempted = false;
let autoRestartCount = 0;
let mutationCount = 0;
let miniGameCount = 0;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function eliminatePlayer(player) {
  player.eliminated = true;
  player.lives = 0;
}

function eliminatePlayerById(id) {
  const player = gamePlayers.find(p => p.id === id);
  if (player) eliminatePlayer(player);
}

function getRandomNftImage() {
  const useUgly = Math.random() < 0.5;

  if (useUgly) {
    const tokenId = Math.floor(Math.random() * 615) + 1;
    return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
  } else {
    const tokenId = Math.floor(Math.random() * 126) + 1;
    return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
  }
}

// --- Lore Arrays ---
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
  "🎲 rolled a natural 1 during a simple prayer.",
  "🧃 drank the glowing Kool-Aid. Bold. Wrong.",
  "🧠 thought too hard about strategy and exploded.",
  "📦 opened a mystery box and got consumed by it.",
  "👻 got ghosted — literally.",
  "🌪️ summoned a wind and forgot to duck.",
  "🐸 kissed a cursed frog. Became the frog. Was stepped on."
];

const reviveSuccessLines = [
  "✨ emerged from the Charmhole, reeking of glory!",
  "🕯️ lit the right candle — fate reconsidered.",
  "💀 tore through the veil and screamed, 'I'm not done yet!'",
  "📿 whispered the ancient Uglychant and was reborn.",
  "👃 sniffed the scent of battle and couldn’t resist returning.",
  "👣 stomped their way back in with rage and rhythm.",
  "🫀 came back pulsing with malformed life!",
  "🎭 faked their death. Classic move."
];

const reviveFailLines = [
  "☠️ begged the charm for mercy. The charm laughed.",
  "🚫 tried to re-enter but was banned by reality.",
  "🥀 faded like a forgotten chant.",
  "⏳ asked for time. Time declined.",
  "🔁 attempted revival... but glitched out of existence.",
  "🪙 flipped the coin of fate. It landed on 'nope.'",
  "🌫️ wandered into the mist and never emerged.",
  "🙃 almost made it. Almost."
];

const warpEchoes = [
  "*You hear a voice echo through the void…*",
  "*Reality flickers like bad Wi-Fi…*",
  "*Something just blinked. It wasn’t you.*",
  "*The ground whispers forgotten names.*",
  "*Warped time tastes like burnt marshmallows.*",
  "*The Charm trembles. Someone important just joined.*",
  "*Past and future collide. It's Tuesday now.*",
  "*The echo asks: Are you even real?*"
];

const uglychants = [
  "Stay ugly, stay alive. Stay ugly, stay alive.",
  "Malform the norm, break the charm!",
  "Ugly is sacred. Ugly is survival.",
  "Bend your knees. Offer the teeth.",
  "The pretty perish. The ugly endure.",
  "Feed the chant. Fear the flex.",
  "Ugly, ugly, charm me swiftly!",
  "Sing no song but the warped one!"
];

const uglyOracleRiddles = [
  { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" },
  { question: "The more you take, the more you leave behind. What are they?", answer: "footsteps" },
  { question: "I’m not alive, but I grow; I don’t have lungs, but I need air. What am I?", answer: "fire" },
  { question: "I can fill a room but take up no space. What am I?", answer: "light" },
  { question: "I have keys but no locks. I have space but no room. You can enter, but you can’t go outside. What am I?", answer: "keyboard" },
  { question: "What begins with T, ends with T, and has T in it?", answer: "teapot" }
];
// --- Mutation Events ---
const mutationEvents = [
  {
  name: "The Maw Opens",
  description: "A gaping mouth forms in the sky. It hungers. Choose to FEED it or FLEE.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('feed').setLabel('FEED').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('flee').setLabel('FLEE').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🕳️ The Maw Opens")
      .setDescription("A gaping mouth forms in the sky. It hungers.\n\nYou may **FEED** the Maw with part of your soul... or attempt to **FLEE**.")
      .setColor(0x8B0000);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 10000 });
    const results = { fed: [], fled: [] };

    collector.on('collect', async i => {
      if (i.user.bot) return;
      if (results.fed.includes(i.user.id) || results.fled.includes(i.user.id)) {
        return i.reply({ content: "You already chose!", ephemeral: true });
      }
      if (i.customId === 'feed') results.fed.push(i.user.id);
      else results.fled.push(i.user.id);
      await i.reply({ content: `🩸 Choice recorded: ${i.customId.toUpperCase()}`, ephemeral: true });
    });

    collector.on('end', async () => {
      const feedOutcome = results.fed.map(id => `<@${id}>`).join(', ') || "*No one*";
      const fleeOutcome = results.fled.map(id => `<@${id}>`).join(', ') || "*No one*";

      const resultEmbed = new EmbedBuilder()
        .setTitle("🩸 The Maw Has Spoken")
        .setDescription(`**Fed the Maw:** ${feedOutcome}\n**Fled:** ${fleeOutcome}`)
        .setFooter({ text: "The Maw is... temporarily satisfied." })
        .setColor(0x5e0000);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
  {
  name: "The Charmhole",
  description: "A writhing vortex opens in the ground. Some are pulled in. A few emerge... changed.",
  async effect(channel, gamePlayers, eliminatedPlayers) {
    const chosen = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.3);

    const results = [];

    for (const player of chosen) {
      const roll = Math.random();
      if (roll < 0.33) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        results.push(`💀 <@${player.id}> was consumed by the Charmhole.`);
      } else if (roll < 0.66) {
        player.lives += 2;
        results.push(`💫 <@${player.id}> emerged glowing with **+2 lives**.`);
      } else {
        results.push(`❓ <@${player.id}> returned... but seems unchanged. For now.`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🌀 The Charmhole Opens")
      .setDescription(results.length ? results.join('\n') : "The Charmhole grumbled, but spared everyone.")
      .setColor(0x443355);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Mind Swap",
  description: "Two players suddenly switch souls. Only one survives the swap.",
  async effect(channel, gamePlayers, eliminatedPlayers) {
    const candidates = gamePlayers.filter(p => !p.eliminated);
    if (candidates.length < 2) return;

    const [p1, p2] = candidates.sort(() => 0.5 - Math.random()).slice(0, 2);
    const winner = Math.random() < 0.5 ? p1 : p2;
    const loser = winner === p1 ? p2 : p1;

    loser.eliminated = true;
    eliminatedPlayers.push(loser);
    winner.lives += 1;

    const embed = new EmbedBuilder()
      .setTitle("🧬 The Mind Swap")
      .setDescription(`🧠 <@${p1.id}> and <@${p2.id}> had their souls switched.\n🎲 The charm allowed <@${winner.id}> to live — they gain **+1 life**.\n💀 <@${loser.id}> was lost in the void.`)
      .setColor(0x776688);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Coffee Curse",
  description: "The scent of cursed coffee fills the air. Those who sip it feel the full jolt of fate.",
  async effect(channel, gamePlayers, eliminatedPlayers) {
    const chosen = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.5);
    const lines = [];

    for (const player of chosen) {
      const roll = Math.random();
      if (roll < 0.25) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        lines.push(`☠️ <@${player.id}> chugged the cursed ☕ and collapsed.`);
      } else if (roll < 0.6) {
        player.lives += 1;
        lines.push(`⚡ <@${player.id}> felt the buzz — **+1 life**.`);
      } else {
        lines.push(`😐 <@${player.id}> felt nothing. Maybe it was decaf.`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("☕ The Coffee Curse")
      .setDescription(lines.join('\n') || "No one dared to sip.")
      .setColor(0x5c4033);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Mirror of Echoes",
  description: "The mirror offers you power… or punishment. Only the brave step forward.",
  async effect(channel, gamePlayers, eliminatedPlayers) {
    const brave = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.4);
    const lines = [];

    for (const player of brave) {
      const roll = Math.random();
      if (roll < 0.2) {
        player.lives += 3;
        lines.push(`🪞 <@${player.id}> mastered the reflection and gained **+3 lives**!`);
      } else if (roll < 0.5) {
        player.lives -= 1;
        if (player.lives <= 0) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💔 <@${player.id}> was shattered by their own reflection.`);
        } else {
          lines.push(`⚠️ <@${player.id}> lost a life facing themselves.`);
        }
      } else {
        lines.push(`👤 <@${player.id}> stared into the mirror and walked away... haunted, but untouched.`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🪞 The Mirror of Echoes")
      .setDescription(lines.join('\n') || "No one faced the mirror. Cowards.")
      .setColor(0x444466);

    await channel.send({ embeds: [embed] });
  }
},
  {
  name: "Chamber of Eyes",
  description: "The floor is watching. Step carefully. Choose your direction: LEFT or RIGHT.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('left').setLabel('LEFT').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('right').setLabel('RIGHT').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("👁️ Chamber of Eyes")
      .setDescription("The floor is watching. Choose **LEFT** or **RIGHT** to proceed.\n\nStep wisely.")
      .setColor(0x4444aa);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 10000 });
    const results = { left: [], right: [] };

    collector.on('collect', async i => {
      if (i.user.bot) return;
      if (results.left.includes(i.user.id) || results.right.includes(i.user.id)) {
        return i.reply({ content: "You've already chosen!", ephemeral: true });
      }
      if (i.customId === 'left') results.left.push(i.user.id);
      else results.right.push(i.user.id);
      await i.reply({ content: `👣 You stepped ${i.customId.toUpperCase()}`, ephemeral: true });
    });

    collector.on('end', async () => {
      await msg.edit({ components: [] });
      const safeSide = Math.random() < 0.5 ? 'left' : 'right';
      const dead = results[safeSide === 'left' ? 'right' : 'left'];

      for (const id of dead) {
        eliminatePlayerById(id);
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("⚖️ Judgment Passed")
        .setDescription(`The **${safeSide.toUpperCase()}** path was safe.\n\n💀 RIP: ${dead.map(id => `<@${id}>`).join(', ') || "None"}`)
        .setColor(0x770000);

      await msg.edit({ embeds: [resultEmbed] });
    });
  }
}
];

// --- Mutation Mini-Games ---
const mutationMiniGames = [
  {
  name: "Press the Charm",
  description: "A single button appears. Press it... or not.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('presscharm').setLabel('Press It').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔴 Press the Charm")
      .setDescription("A single button appears. Press it... or not.\n\nClick fast. Someone’s gonna blow.")
      .setColor(0xdd2222);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });
    const results = [];

    collector.on('collect', async i => {
      if (i.user.bot || results.includes(i.user.id)) return;
      results.push(i.user.id);
      await i.reply({ content: "🧨 You pressed the Charm.", ephemeral: true });
    });

    collector.on('end', async () => {
      const unlucky = results.length > 0 ? results[Math.floor(Math.random() * results.length)] : null;
      if (unlucky) eliminatePlayerById(unlucky);

      const resultEmbed = new EmbedBuilder()
        .setTitle("💥 Boom!")
        .setDescription(unlucky
          ? `<@${unlucky}> pressed too hard...`
          : "Nobody dared press it. The charm is... disappointed.")
        .setColor(0xff0000);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "The Charm Pulse",
  description: "The charm vibrates. You may touch it — or you may die.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pulse').setLabel('Touch the Charm').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔵 The Charm Pulse")
      .setDescription("A dangerous energy emits from the charm. Press at your own risk.")
      .setColor(0x3399ff);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 8000 });

    const results = [];

    collector.on('collect', async i => {
      if (i.user.bot || results.includes(i.user.id)) return;
      results.push(i.user.id);
      await i.reply({ content: "⚡ You reached for the charm...", ephemeral: true });
    });

    collector.on('end', async () => {
      const resultLines = [];

      for (const id of results) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player || player.eliminated) continue;

        const roll = Math.random();
        if (roll < 0.25) {
          player.lives++;
          resultLines.push(`❤️ <@${id}> gained a life!`);
        } else if (roll < 0.5) {
          player.lives--;
          if (player.lives <= 0) {
            player.eliminated = true;
            eliminatedPlayers.push(player);
            resultLines.push(`💀 <@${id}> touched the wrong part. Eliminated.`);
          } else {
            resultLines.push(`💔 <@${id}> lost a life!`);
          }
        } else {
          resultLines.push(`⚖️ <@${id}> was unaffected.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("⚡ Pulse Results")
        .setDescription(resultLines.join('\n') || "No one dared touch it.")
        .setColor(0x2222ff);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "Coin of Reversal",
  description: "All eliminated players may flip the cursed coin — one side revives, the other explodes.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('flipcoin').setLabel('Flip the Coin').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🪙 Coin of Reversal")
      .setDescription("Eliminated players only: flip the coin to gamble your soul.")
      .setColor(0xaaaaaa);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 6000 });

    const attempts = [];

    collector.on('collect', async i => {
      if (i.user.bot || attempts.includes(i.user.id)) return;

      const wasDead = eliminatedPlayers.find(p => p.id === i.user.id);
      const alreadyAlive = gamePlayers.find(p => p.id === i.user.id && !p.eliminated);

      if (!wasDead || alreadyAlive) {
        return i.reply({ content: "🧟 Only eliminated players can flip this coin.", ephemeral: true });
      }

      attempts.push(i.user.id);
      await i.reply({ content: "🪙 You flip the cursed coin...", ephemeral: true });
    });

    collector.on('end', async () => {
      const results = [];

      for (const id of attempts) {
        const roll = Math.random();
        if (roll < 0.5) {
          const player = eliminatedPlayers.find(p => p.id === id);
          player.eliminated = false;
          player.lives = 1;
          results.push(`🧠 <@${id}> flipped heads and **revived**!`);
        } else {
          results.push(`💥 <@${id}> flipped tails and **was vaporized again.**`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🎲 Coin Results")
        .setDescription(results.join('\n') || "None flipped the coin.")
        .setColor(0xbbbbbb);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
 {
  name: "The Split Path",
  description: "Two identical doorways. One is a trap.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('leftdoor').setLabel('Left Door').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rightdoor').setLabel('Right Door').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🚪 The Split Path")
      .setDescription("Two doors. One leads forward, the other to elimination.\nChoose wisely.")
      .setColor(0x222266);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 9000 });

    const chosen = { left: [], right: [] };

    collector.on('collect', async i => {
      if (i.user.bot || chosen.left.includes(i.user.id) || chosen.right.includes(i.user.id)) return;
      if (i.customId === 'leftdoor') chosen.left.push(i.user.id);
      if (i.customId === 'rightdoor') chosen.right.push(i.user.id);
      await i.reply({ content: "🚪 You stepped through...", ephemeral: true });
    });

    collector.on('end', async () => {
      const safeSide = Math.random() < 0.5 ? 'left' : 'right';
      const doomed = safeSide === 'left' ? chosen.right : chosen.left;
      const lines = [];

      for (const id of doomed) {
        const player = gamePlayers.find(p => p.id === id);
        if (player && !player.eliminated) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💀 <@${id}> chose poorly.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("⚖️ The Path Chosen")
        .setDescription(`**Safe Door:** ${safeSide.toUpperCase()}\n${lines.join('\n') || "Everyone survived!"}`)
        .setColor(0x333388);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "The Ugly Crystal",
  description: "A fractured crystal glows. Risk your life to overcharge it.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('chargecrystal').setLabel('Charge Crystal').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔮 The Ugly Crystal")
      .setDescription("Click to charge it with your essence. It may reward you with **+2 lives**, or obliterate you.")
      .setColor(0xaa00ff);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 9000 });

    const chargers = [];

    collector.on('collect', async i => {
      if (i.user.bot || chargers.includes(i.user.id)) return;
      chargers.push(i.user.id);
      await i.reply({ content: "🔋 Energy absorbed...", ephemeral: true });
    });

    collector.on('end', async () => {
      const lines = [];

      for (const id of chargers) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player || player.eliminated) continue;

        const roll = Math.random();
        if (roll < 0.33) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💥 <@${id}> overloaded the crystal. Eliminated.`);
        } else {
          player.lives += 2;
          lines.push(`✨ <@${id}> gained **2 lives** from the charge.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🌌 Crystal Discharge")
        .setDescription(lines.join('\n') || "No one dared to touch it.")
        .setColor(0xcc88ff);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "Bargain With the Charm",
  description: "Offer part of your vitality to try and revive a fallen ally.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('offerlife').setLabel('Offer Life').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🤝 Bargain With the Charm")
      .setDescription("You may sacrifice a life to revive someone random. The charm may accept… or ignore you.")
      .setColor(0x888800);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 8000 });

    const sacrificers = [];

    collector.on('collect', async i => {
      const player = gamePlayers.find(p => p.id === i.user.id);
      if (!player || player.eliminated || player.lives < 2 || sacrificers.includes(i.user.id)) {
        return i.reply({ content: "🩸 You don’t have enough life to offer.", ephemeral: true });
      }

      sacrificers.push(i.user.id);
      player.lives -= 1;
      await i.reply({ content: "☠️ You offer your life to the charm...", ephemeral: true });
    });

    collector.on('end', async () => {
      const results = [];

      for (const id of sacrificers) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player) continue;

        const candidates = eliminatedPlayers.filter(p => p.id !== id);
        if (candidates.length === 0) continue;

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        if (Math.random() < 0.5) {
          chosen.eliminated = false;
          chosen.lives = 1;
          results.push(`💓 <@${id}> sacrificed and revived <@${chosen.id}>!`);
        } else {
          results.push(`🪦 <@${id}>'s sacrifice was rejected. No revival.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🪙 The Bargain Complete")
        .setDescription(results.join('\n') || "No one attempted a bargain.")
        .setColor(0xcccc44);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
}  
];
// --- Gauntlet Command Listeners (Reordered) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  // Handle trial first to avoid misfire
  if (content === '!gauntlettrial') {
    if (gameActive) return message.reply("⚠️ A Gauntlet is already active!");
    return startJoinPhase(message.channel, 5000, true); // isTrial = true
  }

  // Dev command
  if (content === '!gauntletdev') {
    if (gameActive) return message.reply("⚠️ A Gauntlet is already active!");
    return startJoinPhase(message.channel, 10000, false); // short test window
  }

  // Default Gauntlet
  if (content.startsWith('!gauntlet')) {
    if (gameActive) {
      return message.reply("⚠️ A Gauntlet is already active!");
    }

    const args = content.split(' ');
    const minutes = parseInt(args[1]) || 2;
    return startJoinPhase(message.channel, minutes * 60 * 1000, false);
  }
});

// --- Join Phase Logic ---
async function startJoinPhase(channel, duration, isTrial = false) {
  gameActive = true;
  gamePlayers = [];
  eliminatedPlayers = [];
  revivalAttempted = false;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('joingauntlet').setLabel('Join the Gauntlet').setStyle(ButtonStyle.Success)
  );

  const joinEmbed = new EmbedBuilder()
    .setTitle("⚔️ The Gauntlet Begins!")
    .setDescription("Click below to enter the arena. Only one will survive.")
    .setFooter({ text: `Game starts in ${(duration / 1000 / 60).toFixed(1)} minutes` })
    .setColor(0x00ff99);

  const joinMsg = await channel.send({ content: "@everyone ⚠️ A new Gauntlet is forming!", embeds: [joinEmbed], components: [joinButton] });

  const collector = joinMsg.createMessageComponentCollector({ time: duration });
  const joiners = new Set();

  collector.on('collect', async interaction => {
    if (interaction.customId !== 'joingauntlet') return;
    if (joiners.has(interaction.user.id)) {
      return interaction.reply({ content: "You're already in!", ephemeral: true });
    }

    joiners.add(interaction.user.id);
    const player = {
      id: interaction.user.id,
      username: interaction.user.username,
      lives: 1,
      eliminated: false,
      joinedAt: Date.now(),
      isBoss: false
    };
    gamePlayers.push(player);

    await interaction.reply({ content: `✅ You've joined The Gauntlet. Good luck, <@${interaction.user.id}>!`, ephemeral: true });
  });

  // Timed join reminders
  const intervals = [duration / 3, (duration / 3) * 2];
  intervals.forEach((ms, idx) => {
    setTimeout(() => {
      if (!collector.ended) {
        const remaining = Math.round((duration - ms) / 1000);
        channel.send({ content: `⏳ <@everyone> Only **${Math.ceil(remaining / 60)} minutes** left to join! [Click here to join](${joinMsg.url})` });
      }
    }, ms);
  });

  // --- End Join Phase ---
  collector.on('end', async () => {
    if (isTrial) {
      const fakeNames = [
        "Botrick", "UglyGPT", "Charmander", "FunkStink", "NoSleep", "Uglet",
        "HairyHag", "MalformedMike", "CrustyCarl", "SoggyWitch", "NFTBag", "TrialTroll",
        "Flexorcist", "GasPasser", "DegenJean", "LilWart", "StankLee", "BuglyBob", "SleepySue", "RitualRandy"
      ];

      fakeNames.forEach((name, index) => {
        gamePlayers.push({
          id: `trial_player_${index}`,
          username: name,
          lives: 1,
          eliminated: false,
          joinedAt: Date.now(),
          isBoss: false
        });
      });
    }

    if (gamePlayers.length === 0) {
      gameActive = false;
      return channel.send("❌ No one joined The Gauntlet. Cancelled.");
    }

    await channel.send(`🔒 Join phase ended. **${gamePlayers.length}** players are entering The Gauntlet...`);
    return startGauntlet(gamePlayers, channel, isTrial);
  });
}
// --- Start Game Function ---
async function startGauntlet(players, channel, isTrial = false) {
  gamePlayers = [...players];
  eliminatedPlayers = [];
  revivalAttempted = false;
  gamePlayers.forEach(p => {
    p.lives = 1;
    p.eliminated = false;
    p.isBoss = false;
  });

  await runBossVotePhase(channel);
  await wait(8000);

  await runGauntlet(channel, isTrial);
}

// --- Boss Vote Phase ---
async function runBossVotePhase(channel) {
  const contenders = shuffleArray(gamePlayers).slice(0, 5);
  const row = new ActionRowBuilder();

  contenders.forEach((p) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bossvote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle("👑 BOSS VOTE")
    .setDescription("Choose the one who will rise as the **Boss-Level Ugly**. They gain +1 extra life.")
    .setColor(0xffcc00);

  const voteMsg = await channel.send({ embeds: [embed], components: [row] });

  const votes = {};
  const collector = voteMsg.createMessageComponentCollector({ time: 10000 });

  collector.on('collect', async interaction => {
    const targetId = interaction.customId.split('_')[1];
    votes[targetId] = (votes[targetId] || 0) + 1;
    await interaction.reply({ content: `🗳️ Vote registered for <@${targetId}>`, ephemeral: true });
  });

  collector.on('end', async () => {
    await voteMsg.edit({ components: [] });

    const winnerId = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
    const boss = gamePlayers.find(p => p.id === winnerId) || contenders[0];
    boss.lives = 2;
    boss.isBoss = true;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("👑 The Boss Has Risen")
          .setDescription(`<@${boss.id}> is now the **Boss-Level Ugly** with 2 lives!`)
          .setColor(0xff8800)
      ]
    });
  });
}
// --- Main Gauntlet Loop ---
async function runGauntlet(channel, isTrial = false) {
  let round = 0;
  const totalPlayers = gamePlayers.length;

  while (gamePlayers.filter(p => !p.eliminated).length > 3) {
    round++;
    const alive = gamePlayers.filter(p => !p.eliminated);
    const aliveCount = alive.length;

    await wait(8000);
    await channel.send(`🔄 **Round ${round}** begins! (${aliveCount}/${totalPlayers} remain)`);

    // 20% chance: Warp Echo
    if (Math.random() < 0.2) {
      const echo = warpEchoes[Math.floor(Math.random() * warpEchoes.length)];
      await channel.send(`🌌 ${echo}`);
      await wait(3000);
    }

    // 15% chance: Ugly Chant
    if (Math.random() < 0.15) {
      const chant = uglychants[Math.floor(Math.random() * uglychants.length)];
      await channel.send(`🔊 *Ugly Chant:* "${chant}"`);
      await wait(2500);
    }

    // 10% chance: Ugly Oracle Riddle
    if (Math.random() < 0.10) {
      const riddle = uglyOracleRiddles[Math.floor(Math.random() * uglyOracleRiddles.length)];
      const embed = new EmbedBuilder()
        .setTitle("🔮 Ugly Oracle Riddle")
        .setDescription(`> ${riddle.question}\n\nReply with the answer in the next **30 seconds** to gain a life.`)
        .setColor(0xaa00aa);

      await channel.send({ embeds: [embed] });

      const collected = await channel.awaitMessages({
        filter: m => !m.author.bot,
        time: 30000
      });

     const correctPlayers = [];

collected.forEach(msg => {
  if (msg.content.toLowerCase().includes(riddle.answer)) {
    const player = gamePlayers.find(p => p.id === msg.author.id);
    if (player && !player.eliminated) {
      player.lives++;
      correctPlayers.push(player);
    }
  }
});

if (correctPlayers.length > 0) {
  const list = correctPlayers.map(p => `<@${p.id}>`).join(', ');
  await channel.send(`🧠 The charm acknowledges the clever ones: ${list} — each gains **+1 life**.`);
} else {
  await channel.send(`🤷‍♂️ No one solved the Oracle's riddle. The charm remains unimpressed.`);
}

      await wait(2000);
    }

    // Trigger Mass Revival if 50% or more eliminated and not yet done
    if (!revivalAttempted && eliminatedPlayers.length >= totalPlayers / 2) {
      revivalAttempted = true;
      await runMassRevivalEvent(channel);
      await wait(12000);
    }

    // Randomly select round type
    const eventRoll = Math.random();

if (eventRoll < 0.2 && mutationCount < 4) {
  await runMutationEvent(channel, gamePlayers, eliminatedPlayers);
  mutationCount++;
} else if (eventRoll < 0.35 && miniGameCount < 2) {
  await runMiniGameEvent(channel, gamePlayers, eliminatedPlayers);
  miniGameCount++;
} else {
  await runEliminationRound(channel, gamePlayers, eliminatedPlayers);
}
    await wait(12000);
  }

  // Game over — determine podium
  const finalists = gamePlayers.filter(p => !p.eliminated);
  const top3 = [...finalists, ...eliminatedPlayers]
    .sort((a, b) => (b.lives || 0) - (a.lives || 0))
    .slice(0, 3);

  const podiumEmbed = new EmbedBuilder()
    .setTitle(isTrial ? "🏁 Trial Gauntlet Complete" : "🏆 The Gauntlet Has Ended")
    .setDescription(`**1st:** <@${top3[0]?.id || '???'}>\n**2nd:** <@${top3[1]?.id || '???'}>\n**3rd:** <@${top3[2]?.id || '???'}>`)
    .setFooter({ text: isTrial ? "This was a test run." : "Glory is temporary. Ugliness is eternal." })
    .setColor(isTrial ? 0xaaaaaa : 0x00ffcc);

  await channel.send({ embeds: [podiumEmbed] });

  if (!isTrial) {
    for (let i = 0; i < top3.length; i++) {
      const player = top3[i];
      if (!player) continue;
      await updateStats(player.id, player.username, i === 0 ? 1 : 0, 0, 0);
    }
  }

  gameActive = false;
  autoRestartCount = 0;

  if (!isTrial) {
    await showRematchButton(channel, gamePlayers);
  }
}
// --- Elimination Round ---
async function runEliminationRound(channel) {
  const alive = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  const count = Math.min(3, Math.floor(Math.random() * 2) + 2); // 2 or 3 eliminations
  const toEliminate = shuffleArray(alive).slice(0, count);

  for (const player of toEliminate) {
    player.lives--;
    if (player.lives <= 0) {
      player.eliminated = true;
      eliminatedPlayers.push(player);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("💀 Casualties This Round")
    .setDescription(toEliminate.map(p => `• <@${p.id}> ${eliminationReasons[Math.floor(Math.random() * eliminationReasons.length)]}`).join('\n'))
    .setColor(0xff4444)
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
}

// --- Mutation Event ---
async function runMutationEvent(channel) {
  const mutation = mutationEvents[Math.floor(Math.random() * mutationEvents.length)];
  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation Event: ${mutation.name}`)
    .setDescription(mutation.description)
    .setColor(0x9933ff);
  await channel.send({ embeds: [embed] });

  await mutation.effect({ channel }, gamePlayers, eliminatedPlayers);
}

// --- Mini-Game Event ---
async function runMiniGameEvent(channel) {
  const miniGame = mutationMiniGames[Math.floor(Math.random() * mutationMiniGames.length)];
  const embed = new EmbedBuilder()
    .setTitle(`🎮 Mini-Game: ${miniGame.name}`)
    .setDescription(miniGame.description)
    .setColor(0x66ccff);
  await channel.send({ embeds: [embed] });

  await miniGame.effect({ channel }, gamePlayers, eliminatedPlayers);
}

// --- Mass Revival Event ---
async function runMassRevivalEvent(channel) {
  const embed = new EmbedBuilder()
    .setTitle("💫 Totem of Lost Souls")
    .setDescription("Eliminated players and outsiders have one chance to **click the Totem** and return.\n\nOnly the lucky shall rise again.")
    .setColor(0xff00cc);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('revivetotem')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [button] });

  const collector = msg.createMessageComponentCollector({ time: 6000 });
  const attempted = [];

  collector.on('collect', async i => {
    if (i.user.bot || attempted.includes(i.user.id)) return;
    attempted.push(i.user.id);
    await i.reply({ content: "🔮 You touched the Totem...", ephemeral: true });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });

    const revived = [];
    for (const id of attempted) {
      const isEliminated = eliminatedPlayers.find(p => p.id === id);
      const isNew = !gamePlayers.find(p => p.id === id);

      const successChance = isEliminated ? 0.6 : 0.4;
      if (Math.random() < successChance) {
        if (isEliminated) {
          const player = eliminatedPlayers.find(p => p.id === id);
          player.eliminated = false;
          player.lives = 1;
          revived.push(`<@${id}>`);
        } else {
          const player = {
            id: id,
            username: (await channel.guild.members.fetch(id)).user.username,
            lives: 1,
            eliminated: false,
            joinedAt: Date.now(),
            isBoss: false
          };
          gamePlayers.push(player);
          revived.push(`<@${id}>`);
        }
      }
    }
mutationCount = 0;
miniGameCount = 0;

    const embed = new EmbedBuilder()
      .setTitle("🕯️ Totem Judgment")
      .setDescription(revived.length > 0
        ? `The Totem shows mercy. Returned: ${revived.join(', ')}`
        : "No soul was worthy. All attempts failed.")
      .setColor(revived.length ? 0x33cc99 : 0x333333);

    await channel.send({ embeds: [embed] });
  });
}
// --- Update Stats in DB ---
async function updateStats(userId, username, wins = 0, revives = 0, duels = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    INSERT INTO player_stats (user_id, username, wins, revives, duels_won, games_played, year, month)
    VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
    ON CONFLICT (user_id, year, month)
    DO UPDATE SET
      wins = player_stats.wins + $3,
      revives = player_stats.revives + $4,
      duels_won = player_stats.duels_won + $5,
      games_played = player_stats.games_played + 1;
  `, [userId, username, wins, revives, duels, year, month]);
}

// --- Rematch Button ---
async function showRematchButton(channel, previousPlayers) {
  const neededVotes = Math.ceil(previousPlayers.length * 0.75);
  const votes = new Set();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_vote')
      .setLabel('Start Rematch')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔁 Rematch?")
        .setDescription(`If **${neededVotes}** of you want to run it back... we do this again.`)
        .setColor(0x00cc99)
    ],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({ time: 15000 });

  collector.on('collect', async i => {
    if (votes.has(i.user.id)) {
      return i.reply({ content: "Already voted!", ephemeral: true });
    }
    votes.add(i.user.id);
    await i.reply({ content: "🔁 You voted for rematch!", ephemeral: true });

    if (votes.size >= neededVotes && gameActive === false) {
      autoRestartCount++;
      if (autoRestartCount > 4) {
        await channel.send("⚠️ Too many auto-restarts in a row. Rest period triggered.");
        return;
      }
      await msg.edit({ components: [] });
      return startJoinPhase(channel, 10000, false); // 10s rematch window
    }
  });

  collector.on('end', async () => {
    if (votes.size < neededVotes) {
      await msg.edit({ components: [] });
      await channel.send("🛑 Not enough votes to restart.");
    }
  });
}

// --- Leaderboard Command ---
client.on('messageCreate', async (message) => {
  if (message.content === '!leaderboard') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [wins, revives, games] = await Promise.all([
      db.query(`SELECT username, wins FROM player_stats WHERE year=$1 AND month=$2 ORDER BY wins DESC LIMIT 3`, [year, month]),
      db.query(`SELECT username, revives FROM player_stats WHERE year=$1 AND month=$2 ORDER BY revives DESC LIMIT 3`, [year, month]),
      db.query(`SELECT username, games_played FROM player_stats WHERE year=$1 AND month=$2 ORDER BY games_played DESC LIMIT 3`, [year, month])
    ]);

    const formatTop = (rows, label) => rows.rows.map((r, i) => `**${i + 1}.** ${r.username} — ${r[label]}`).join('\n') || "*None yet*";

    const embed = new EmbedBuilder()
      .setTitle("📊 Monthly Leaderboard")
      .addFields(
        { name: "🏆 Wins", value: formatTop(wins, 'wins'), inline: true },
        { name: "🧠 Revives", value: formatTop(revives, 'revives'), inline: true },
        { name: "🎮 Games Played", value: formatTop(games, 'games_played'), inline: true }
      )
      .setFooter({ text: `${month}/${year}` })
      .setColor(0x00aaff);

    await message.channel.send({ embeds: [embed] });
  }
});

// --- Player Stats Command ---
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!stats')) {
    const mention = message.mentions.users.first() || message.author;
    const id = mention.id;

    const res = await db.query(`
      SELECT SUM(wins) as wins, SUM(revives) as revives, SUM(duels_won) as duels, SUM(games_played) as games
      FROM player_stats WHERE user_id = $1
    `, [id]);

    const row = res.rows[0] || {};
    const embed = new EmbedBuilder()
      .setTitle(`📈 Stats for ${mention.username}`)
      .addFields(
        { name: "🏆 Wins", value: `${row.wins || 0}`, inline: true },
        { name: "🧠 Revives", value: `${row.revives || 0}`, inline: true },
        { name: "⚔️ Duels Won", value: `${row.duels || 0}`, inline: true },
        { name: "🎮 Games Played", value: `${row.games || 0}`, inline: true }
      )
      .setColor(0xdddddd);

    await message.channel.send({ embeds: [embed] });
  }
});
// --- Bot Ready Handler ---
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Launch Bot ---
client.login(process.env.TOKEN);
