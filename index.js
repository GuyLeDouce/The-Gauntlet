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
        wins INT DEFAULT 0,
        revives INT DEFAULT 0,
        duels_won INT DEFAULT 0,
        games_played INT DEFAULT 0
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
let gameInProgress = false;
let players = [];
let alivePlayers = [];
let eliminatedPlayers = [];
let joinMessage = null;
let gameChannel = null;
let bossPlayer = null;
let playerLives = {};
let rematchVotes = new Set();
let consecutiveRestarts = 0;
let massRevivalUsed = false;


async function startJoinPhase(channel, durationMinutes = 3, isDevMode = false) {
  entrantIDs = new Set();
  eliminatedPlayers = [];
  playerLives = {};
  trialMode = false;
  devMode = isDevMode;
  rematchVotes = new Set();
  lastGameEntrants = [];

  const joinEmbed = new EmbedBuilder()
    .setTitle('🎮 The Gauntlet Begins!')
    .setDescription(`Click the button below to join.\nTime remaining: **${durationMinutes} minutes**`)
    .setColor('#2ecc71')
    .setFooter({ text: 'Get in here, if you dare...' });

  const joinButton = new ButtonBuilder()
    .setCustomId('join_button')
    .setLabel('Join The Gauntlet')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(joinButton);

  const joinMessage = await channel.send({ embeds: [joinEmbed], components: [row] });

  let timeLeft = durationMinutes * 60;
  const interval = setInterval(async () => {
    timeLeft -= 60;
    if (timeLeft <= 0) {
      clearInterval(interval);
      await joinMessage.edit({ components: [] });
      if (entrantIDs.size < 3) {
        await channel.send('Not enough players joined The Gauntlet. Game cancelled.');
      } else {
        await startGauntlet(channel);
      }
    } else if (timeLeft === Math.floor(durationMinutes * 60 * 2 / 3) ||
               timeLeft === Math.floor(durationMinutes * 60 / 3)) {
      await channel.send('@everyone ⏳ The Gauntlet is starting soon. Join now if you dare.');
    }
  }, 60_000);
}

const DEFAULT_MONSTER_ADDRESS = '0x1cd7fe72d64f6159775643acedc7d860dfb80348';

const eliminationReasons = [
  "was swallowed by a sentient outhouse.",
  "tripped over their own ego and fell into the abyss.",
  "challenged a goose to a duel and lost.",
  "thought the red button was candy. It wasn’t.",
  "mistook a trap for a treasure chest.",
  "forgot how to breathe during hide and seek.",
  "tried to outstare a mirror and blinked.",
  "used their last brain cell as a sacrifice.",
  "failed the vibe check and got booted.",
  "stood too close to the lorehole.",
  "walked straight into the shadow realm's sneeze zone.",
  "was too ugly for the Ugly dimension. Yikes.",
  "failed to read the terms and conditions."
];

const reviveSuccessMessages = [
  "clawed their way out of the abyss!",
  "used an Uno Reverse card on death!",
  "glitched back into reality.",
  "convinced the reaper to take a break.",
  "hacked the matrix and rejoined!",
  "ate a mysterious mushroom and felt... better?",
  "traded a sock to the gods for one more chance!"
];

const reviveFailureMessages = [
  "tried to return, but the portal slammed shut.",
  "found a door back in... and walked into a wall.",
  "almost made it back... but forgot pants.",
  "was rejected by the revival gods for poor hygiene.",
  "screamed 'YOLO' and slipped.",
  "chose the wrong chalice.",
  "got distracted by a butterfly mid-respawn."
];

const miniGameNames = [
  "Skull Toss",
  "Mirror Maze",
  "Bone Bridge",
  "Cryptic Dance-Off",
  "Puzzle of Peril"
];
const mutationEvents = [
  {
    name: "Whispering Shadows",
    description: "A wall of shadows descends. Choose to listen or run.",
    effect: async () => {
      const lucky = getRandomAlive(1);
      const doomed = getRandomAlive(1, lucky);
      if (lucky.length && doomed.length) {
        playerLives[lucky[0]] = (playerLives[lucky[0]] || 1) + 1;
        eliminatePlayer(doomed[0], "was consumed by the whispering void.");
      }
    }
  },
  {
    name: "Ugly Mirror",
    description: "Face your reflection. Some find strength, others despair.",
    effect: async () => {
      const r = Math.random();
      if (r < 0.33) {
        const revived = eliminatedPlayers.pop();
        if (revived) alivePlayers.push(revived);
      } else if (r < 0.66) {
        const unlucky = getRandomAlive(1);
        if (unlucky.length) eliminatePlayer(unlucky[0], "fainted at their own reflection.");
      } else {
        const lucky = getRandomAlive(1);
        if (lucky.length) playerLives[lucky[0]] = (playerLives[lucky[0]] || 1) + 1;
      }
    }
  },
  {
    name: "Spinning Blade Room",
    description: "Duck, dodge, dive... or don't.",
    effect: async () => {
      const eliminated = getRandomAlive(2);
      eliminated.forEach(p => eliminatePlayer(p, "was sliced into abstract modern art."));
    }
  },
  {
    name: "Cauldron of Chance",
    description: "Sip the soup. It could cure or kill.",
    effect: async () => {
      const chosen = getRandomAlive(2);
      for (const player of chosen) {
        const outcome = Math.random();
        if (outcome < 0.4) {
          playerLives[player] = (playerLives[player] || 1) + 1;
        } else if (outcome < 0.8) {
          eliminatePlayer(player, "drank the wrong brew and melted.");
        }
      }
    }
  },
  {
    name: "Hall of Screams",
    description: "Cover your ears, or let madness in.",
    effect: async () => {
      const affected = getRandomAlive(3);
      if (affected.length) {
        const spared = affected.shift();
        playerLives[spared] = (playerLives[spared] || 1) + 1;
        affected.forEach(p => eliminatePlayer(p, "succumbed to the eternal wail."));
      }
    }
  }
];
const mutationMiniGames = [
  {
    name: "The Lever of Regret",
    description: "A rusty lever juts from the floor. Pull it?",
    interaction: async () => {
      const player = getRandomAlive(1)[0];
      if (!player) return;
      const outcome = Math.random();
      if (outcome < 0.5) {
        playerLives[player] = (playerLives[player] || 1) + 1;
        sendGameMessage(`<@${player}> pulled the Lever of Regret... and gained a second chance! (+1 life)`);
      } else {
        eliminatePlayer(player, "yanked the Lever of Regret and fell through a trapdoor.");
      }
    }
  },
  {
    name: "Goblin's Gamble",
    description: "A giggling goblin offers a coin toss. Heads or tails?",
    interaction: async () => {
      const player = getRandomAlive(1)[0];
      if (!player) return;
      const flip = Math.random() < 0.5 ? 'heads' : 'tails';
      if (flip === 'heads') {
        playerLives[player] = (playerLives[player] || 1) + 1;
        sendGameMessage(`<@${player}> guessed heads... and won a blessing! (+1 life)`);
      } else {
        eliminatePlayer(player, "lost the Goblin's Gamble.");
      }
    }
  },
  {
    name: "The Ugly Riddle",
    description: "Solve or suffer. A cryptic message appears before you.",
    interaction: async () => {
      const player = getRandomAlive(1)[0];
      if (!player) return;
      const correct = Math.random() < 0.4;
      if (correct) {
        sendGameMessage(`<@${player}> solved the Ugly Riddle! They remain safe.`);
      } else {
        eliminatePlayer(player, "muttered the wrong answer and vanished.");
      }
    }
  },
  {
    name: "Mimic Chest",
    description: "A treasure chest appears. Will you open it?",
    interaction: async () => {
      const player = getRandomAlive(1)[0];
      if (!player) return;
      const good = Math.random() < 0.5;
      if (good) {
        playerLives[player] = (playerLives[player] || 1) + 1;
        sendGameMessage(`<@${player}> opened the Mimic Chest and found an extra life!`);
      } else {
        eliminatePlayer(player, "was devoured by the chest’s tongue and teeth.");
      }
    }
  }
];
// --- WARP EVENTS ---

const warpEvents = [
  {
    title: "WARP Event: Parallel Pain",
    description: "A ripple tears through the realm. Some Uglys double over, others stand tall.",
    execute: () => {
      const unlucky = getRandomAlive(2);
      unlucky.forEach(player => {
        eliminatePlayer(player, "was erased in a parallel collapse.");
      });
      sendGameMessage(`🌌 **Parallel Pain** has claimed ${unlucky.map(p => `<@${p}>`).join(", ")}`);
    }
  },
  {
    title: "WARP Event: Phantom Revival",
    description: "Ghostly howls echo… One eliminated soul claws its way back in.",
    execute: () => {
      if (eliminatedPlayers.length === 0) return;
      const lucky = eliminatedPlayers[Math.floor(Math.random() * eliminatedPlayers.length)];
      players.push(lucky);
      playerLives[lucky] = 1;
      eliminatedPlayers = eliminatedPlayers.filter(p => p !== lucky);
      sendGameMessage(`👻 **Phantom Revival:** <@${lucky}> has returned from the beyond!`);
    }
  },
  {
    title: "WARP Event: Ugly Shift",
    description: "Reality blinks. Players swap their fates!",
    execute: () => {
      const [p1, p2] = getRandomAlive(2);
      if (!p1 || !p2) return;
      const temp = playerLives[p1] || 1;
      playerLives[p1] = playerLives[p2] || 1;
      playerLives[p2] = temp;
      sendGameMessage(`🔄 **Ugly Shift:** <@${p1}> and <@${p2}> swapped their remaining lives!`);
    }
  },
  {
    title: "WARP Event: The Wormhole Gift",
    description: "The sky cracks open and drops a gift…",
    execute: () => {
      const player = getRandomAlive(1)[0];
      if (!player) return;
      playerLives[player] = (playerLives[player] || 1) + 2;
      sendGameMessage(`🎁 **Wormhole Gift:** <@${player}> received +2 bonus lives!`);
    }
  }
];
// --- MASS REVIVAL EVENT ---

async function triggerMassRevival(channel) {
  if (massRevivalUsed) return;

  const revivalEmbed = new EmbedBuilder()
    .setTitle("☠️ The Totem of Lost Souls Awakens")
    .setDescription("Those lost to the void feel a tug on their spirit...\nClick below to embrace the call and return!")
    .setColor(0x7f00ff);

  const reviveButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("massReviveClick")
      .setLabel("Return Through the Rift")
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [revivalEmbed], components: [reviveButton] });

  const attempted = [];
  const revived = [];
  const newcomerJoiners = [];

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on("collect", async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === "massReviveClick") {
      const userId = interaction.user.id;

      if (!attempted.includes(userId)) {
        attempted.push(userId);

        const isEliminated = eliminatedPlayers.includes(userId);
        const isNew = !players.includes(userId) && !eliminatedPlayers.includes(userId);

        if (isEliminated && Math.random() < 0.6) {
          players.push(userId);
          eliminatedPlayers = eliminatedPlayers.filter(id => id !== userId);
          playerLives[userId] = 1;
          revived.push(userId);
        } else if (isNew && Math.random() < 0.4) {
          players.push(userId);
          playerLives[userId] = 1;
          newcomerJoiners.push(userId);
        }
      }

      await interaction.deferUpdate();
    }
  });

  collector.on("end", async () => {
    massRevivalUsed = true;
    const lines = [];

    if (revived.length > 0)
      lines.push(`🧟 Returned: ${revived.map(id => `<@${id}>`).join(", ")}`);
    if (newcomerJoiners.length > 0)
      lines.push(`👀 Newcomers: ${newcomerJoiners.map(id => `<@${id}>`).join(", ")}`);
    if (lines.length === 0) lines.push("💀 None survived the call...");

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚡ Revival Results")
          .setDescription(lines.join("\n"))
          .setColor(0xd400ff)
      ]
    });

    await triggerDuelBattle(channel);
  });
}
// --- HEAD-TO-HEAD DUEL BATTLE ---

async function triggerDuelBattle(channel) {
  if (players.length < 2) return;

  const [p1, p2] = shuffleArray(players).slice(0, 2);
  const duelEmbed = new EmbedBuilder()
    .setTitle("⚔️ Duel of the Damned")
    .setDescription(`Two challengers face off under the crimson moon.\nOnly one will walk away...\n\n<@${p1}> vs <@${p2}>`)
    .setColor(0xff0000);

  const duelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("voteP1")
      .setLabel(`Back ${p1}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("voteP2")
      .setLabel(`Back ${p2}`)
      .setStyle(ButtonStyle.Primary)
  );

  const duelMsg = await channel.send({ embeds: [duelEmbed], components: [duelRow] });

  const duelCollector = duelMsg.createMessageComponentCollector({ time: 8000 });

  let votesP1 = 0;
  let votesP2 = 0;

  duelCollector.on("collect", async interaction => {
    if (interaction.customId === "voteP1") votesP1++;
    if (interaction.customId === "voteP2") votesP2++;
    await interaction.deferUpdate();
  });

  duelCollector.on("end", async () => {
    let loser, winner;

    if (votesP1 === votesP2) {
      loser = Math.random() < 0.5 ? p1 : p2;
      winner = loser === p1 ? p2 : p1;
    } else if (votesP1 > votesP2) {
      loser = p2;
      winner = p1;
    } else {
      loser = p1;
      winner = p2;
    }

    playerLives[winner] = (playerLives[winner] || 1) + 1;
    eliminatedPlayers.push(loser);
    players = players.filter(p => p !== loser);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Duel Result")
          .setDescription(`<@${winner}> wins the duel and gains +1 life!\n<@${loser}> is vanquished.`)
          .setColor(0xffcc00)
      ]
    });

    await updatePlayerStats(winner, "duel_wins");
  });
}
// --- FINAL PODIUM DISPLAY ---

async function showFinalPodium(channel) {
  const survivors = players.slice();
  let podium;

  if (survivors.length > 0) {
    podium = survivors.slice(0, 3);
  } else {
    podium = eliminatedPlayers.slice(-3).reverse();
  }

  const positions = ["🏆 Winner", "🥈 2nd Place", "🥉 3rd Place"];
  const descriptions = podium.map((p, index) => `${positions[index]} — <@${p}>`).join("\n");

  const podiumEmbed = new EmbedBuilder()
    .setTitle("🎉 Final Podium")
    .setDescription(`${descriptions}\n\nLegends fall hard. Stay Ugly.`)
    .setColor(0x00ffff);

  await channel.send({ embeds: [podiumEmbed] });

  if (podium[0]) await updatePlayerStats(podium[0], "wins");
}
// --- REMATCH LOGIC ---

const MAX_CONSECUTIVE_GAMES = 4;

async function showRematchButton(previousPlayers, durationMinutes = 3) {
  if (consecutiveGames >= MAX_CONSECUTIVE_GAMES) {
    await channel.send("🛑 Auto-restart limit reached. Please start a new Gauntlet manually.");
    return;
  }

  rematchVotes.clear();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rematch_vote")
      .setLabel("🔁 Join the Rematch")
      .setStyle(ButtonStyle.Primary)
  );

  const requiredVotes = Math.ceil(previousPlayers.length * 0.75);

  const message = await channel.send({
    content: `The Gauntlet has ended. 🔁 Want to go again?\nWe need **${requiredVotes}** votes to begin the next Gauntlet.`,
    components: [row],
  });

  const collector = message.createMessageComponentCollector({
    componentType: 2,
    time: durationMinutes * 60 * 1000,
  });

  collector.on("collect", async (interaction) => {
    if (!previousPlayers.includes(interaction.user.id)) {
      await interaction.reply({ content: "You didn't play last game!", ephemeral: true });
      return;
    }

    rematchVotes.add(interaction.user.id);
    const count = rematchVotes.size;

    await interaction.reply({ content: `🔁 You've voted to rematch. ${count}/${requiredVotes} votes so far.`, ephemeral: true });

    if (count >= requiredVotes) {
      collector.stop("rematch_started");
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "rematch_started") {
      consecutiveGames++;
      await startGauntlet(channel, 3); // default to 3 minute join time
    } else {
      consecutiveGames = 0;
      await channel.send("⏹️ Rematch vote ended. Start a new Gauntlet with `!gauntlet`.");
    }
  });
}
// --- LEADERBOARD COMMAND ---

async function updatePlayerStats(userId, username, category) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const res = await db.query(
    `SELECT * FROM player_stats WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, year, month]
  );

  if (res.rows.length === 0) {
    await db.query(
      `INSERT INTO player_stats (user_id, username, year, month, wins, revives, games_played) VALUES ($1, $2, $3, $4, 0, 0, 0)`,
      [userId, username, year, month]
    );
  }

  let column = '';
  if (category === 'win') column = 'wins';
  if (category === 'revive') column = 'revives';
  if (category === 'game') column = 'games_played';
  if (category === 'duel') column = 'duel_wins';

  if (column) {
    await db.query(
      `UPDATE player_stats SET ${column} = ${column} + 1 WHERE user_id = $1 AND year = $2 AND month = $3`,
      [userId, year, month]
    );
  }
}

client.on("messageCreate", async (message) => {
  if (message.content.toLowerCase().startsWith("!leaderboard")) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const stats = await db.query(`
      SELECT username, wins, revives, games_played,
        CASE WHEN games_played > 0 THEN ROUND(wins::decimal / games_played, 2) ELSE 0 END as avg_wins
      FROM player_stats
      WHERE year = $1 AND month = $2
      ORDER BY wins DESC, revives DESC
      LIMIT 10
    `, [year, month]);

    const top = stats.rows;

    const embed = new EmbedBuilder()
      .setTitle("📈 Monthly Gauntlet Leaderboard")
      .setDescription(
        top.map((p, i) =>
          `**${i + 1}. ${p.username}** — 🏆 ${p.wins} Wins | ♻️ ${p.revives} Revives | 🎮 ${p.games_played} Games | 📊 ${p.avg_wins} Avg Win`
        ).join("\n")
      )
      .setColor("Gold")
      .setFooter({ text: `May the Ugliest survive.` });

    await message.reply({ embeds: [embed] });
  }
});
// --- AUTO REMATCH LOGIC ---

let previousPlayers = [];
let consecutiveGames = 0;

async function showRematchButton(channel) {
  if (consecutiveGames >= 4) {
    const embed = new EmbedBuilder()
      .setTitle("⛔ Rematch Limit Reached")
      .setDescription("Too many consecutive Gauntlets. Please start a new game manually with `!gauntlet`.")
      .setColor("Red");

    await channel.send({ embeds: [embed] });
    return;
  }

   const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rematch_vote")
      .setLabel("Join Rematch")
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏁 Rematch?")
        .setDescription(`75% of players from last game must click to start a new one!\nCurrent: 0 / ${Math.ceil(previousPlayers.length * 0.75)}`)
        .setColor("Blurple")
    ],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async (i) => {
    if (previousPlayers.includes(i.user.id)) {
      rematchVotes.add(i.user.id);
      const required = Math.ceil(previousPlayers.length * 0.75);
      const current = rematchVotes.size;

      if (current >= required) {
        await i.reply({ content: "✅ Rematch starting!", ephemeral: true });
        consecutiveGames++;
        collector.stop();

        // Simulate starting a new Gauntlet with default 3 minute countdown
        await startGauntlet(i.channel, 3);
      } else {
        await i.reply({ content: `🟢 ${current}/${required} ready for rematch!`, ephemeral: true });
      }
    } else {
      await i.reply({ content: `⛔ You weren't in the last game.`, ephemeral: true });
    }
  });

  collector.on("end", async () => {
    await msg.edit({ components: [] });
  });
}
// --- DISCORD CLIENT LOGIN ---

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Setup database tables
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT,
        year INT,
        month INT,
        wins INT DEFAULT 0,
        revives INT DEFAULT 0,
        games_played INT DEFAULT 0,
        duel_wins INT DEFAULT 0
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

    console.log("📊 Tables are ready!");
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  }
});


async function startJoinPhase(message, duration) {
  const joinEmbed = new EmbedBuilder()
    .setTitle('⚔️ The Gauntlet Begins!')
    .setDescription(`A new game is starting!\nClick the button below to join.\n\n**Start Time:** ${duration} minute(s)`)
    .setColor('Gold')
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setCustomId('join_button')
    .setLabel('Join the Gauntlet')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(joinButton);

  const sentMessage = await message.channel.send({ embeds: [joinEmbed], components: [row] });

  const totalMs = duration * 60 * 1000;

  // Reminder tags at 1/3 and 2/3 marks
  setTimeout(() => {
    message.channel.send(`⏳ One third of the join time has passed! @everyone`);
  }, totalMs / 3);

  setTimeout(() => {
    message.channel.send(`⚠️ Two thirds of the join time has passed! @everyone`);
  }, (2 * totalMs) / 3);

  // Game starts after countdown
  setTimeout(() => {
    message.channel.send(`🚨 The Gauntlet is now starting! No more entries allowed.`);
    // Proceed to boss vote or whatever comes next
    startBossVotePhase(message.channel); // ← make sure this function exists and works
  }, totalMs);
}
function startGauntlet(players, channel, isTrial = false) {
  activeGame = true;
  gauntletChannel = channel;
  gamePlayers = players.map(name => ({
    id: name,
    username: name,
    lives: 1,
    eliminated: false,
    isTrial: isTrial
  }));
  eliminatedPlayers = [];
  rematchVotes.clear();
  consecutiveRestarts = 0;

  if (isTrial) {
    channel.send('⚔️ Trial Mode Activated! Prepare for chaos...');
  } else {
    channel.send('🌀 The Gauntlet begins now!');
  }

  setTimeout(() => {
    runBossVotePhase(channel);
  }, 3000);
}

function generateMockPlayers(count) {
  const mockPlayers = [];
  for (let i = 1; i <= count; i++) {
    mockPlayers.push({
      id: `Trial${i}`,
      username: `Trial${i}`,
      lives: 1
    });
  }
  return mockPlayers;
}
function startGauntlet(players, channel, isTrial = false) {
  activeGame = true;
  gauntletChannel = channel;
  gamePlayers = players.map(name => ({
    id: name,
    username: name,
    lives: 1,
    eliminated: false,
    isTrial: isTrial
  }));
  eliminatedPlayers = [];
  rematchVotes.clear();
  consecutiveRestarts = 0;

  if (isTrial) {
    channel.send('⚔️ Trial Mode Activated! Prepare for chaos...');
  } else {
    channel.send('🌀 The Gauntlet begins now!');
  }

  async function runBossVotePhase(channel) {
  const candidates = shuffleArray(gamePlayers).slice(0, 5);
  const voteCounts = new Map();
  const alreadyVoted = new Set();

  const row = new ActionRowBuilder().addComponents(
    candidates.map(player =>
      new ButtonBuilder()
        .setCustomId(`vote_${player.id}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary)
    )
  );
  
  const voteMessage = await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('👑 Boss Selection Phase')
      .setDescription('Choose who should become the Boss of this Gauntlet.\nClick a name below to cast your vote!')
      .setColor('Red')],
    components: [row]
  });

  const collector = voteMessage.createMessageComponentCollector({ time: 10000 });

  collector.on('collect', async interaction => {
    if (alreadyVoted.has(interaction.user.id)) {
      try {
        await interaction.reply({ content: '🛑 You already voted!', ephemeral: true });
      } catch (err) {
        console.error('Interaction reply error:', err);
      }
      return;
    }

    alreadyVoted.add(interaction.user.id);
    const selectedId = interaction.customId.replace('vote_', '');
    voteCounts.set(selectedId, (voteCounts.get(selectedId) || 0) + 1);
    try {
      await interaction.reply({ content: '✅ Vote recorded!', ephemeral: true });
    } catch (err) {
      console.error('Vote response error:', err);
    }
  });

  collector.on('end', () => {
    let winner = null;
    let maxVotes = -1;
    for (const [id, votes] of voteCounts.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = id;
      }
    }

    const boss = gamePlayers.find(p => p.id === winner);
    if (boss) {
      boss.lives = 2;
      channel.send(`👑 ${boss.username} has been chosen as the Boss Level Ugly! They start with **2 lives**!`);
    } else {
      channel.send('👑 No Boss selected. The game proceeds normally.');
    }

    async function runGauntlet() {
  while (gamePlayers.filter(p => !p.eliminated).length > 1) {
    // Pause between rounds
    await wait(8000);

    // Random choice: elimination, mutation, minigame, or revival
    const roundType = Math.random();
    if (roundType < 0.4) {
      await runEliminationRound();
    } else if (roundType < 0.6) {
      await runMutationEvent();
    } else if (roundType < 0.8) {
      await runMiniGameEvent();
    } else {
      await runMassRevivalEvent();
    }
  }

  // Game End Logic
  const survivors = gamePlayers.filter(p => !p.eliminated);
  let podium = [];

  if (survivors.length >= 3) {
    podium = survivors.slice(-3);
  } else if (survivors.length > 0) {
    podium = [
      ...survivors,
      ...eliminatedPlayers.slice(-3 + survivors.length)
    ];
  } else {
    podium = eliminatedPlayers.slice(-3);
  }

  // Display Podium
  const podiumEmbed = new EmbedBuilder()
    .setTitle('🏆 Final Podium')
    .setDescription(`
🥇 1st Place — <@${podium[0]?.id || 'Unknown'}>
🥈 2nd Place — <@${podium[1]?.id || 'Unknown'}>
🥉 3rd Place — <@${podium[2]?.id || 'Unknown'}>

🎉 Legends fall hard. Stay Ugly. 🧠
`)
    .setColor('#FFD700');
  await gauntletChannel.send({ embeds: [podiumEmbed] });

  // Leaderboard Tracking
  if (!gamePlayers[0].isTrial) {
    for (const player of gamePlayers) {
      await updatePlayerStats(player.id, player.username, {
        gamesPlayed: 1,
        wins: podium[0]?.id === player.id ? 1 : 0
      });
    }
  }

  // Offer Rematch
  offerRematch(gamePlayers.map(p => p.id));
}
 // Now continue into the elimination rounds
  });
}
function runEliminationRound(channel) {
  const alivePlayers = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  const numToEliminate = Math.floor(Math.random() * 2) + 2; // 2 or 3

  const shuffled = shuffleArray(alivePlayers);
  const victims = shuffled.slice(0, Math.min(numToEliminate, alivePlayers.length));

  victims.forEach(player => {
    player.lives--;
    if (player.lives <= 0) {
      player.eliminated = true;
      eliminatedPlayers.push(player);
    }
  });

  const lines = victims.map(p => `☠️ ${p.username} ${getRandomEliminationReason()}`);
  const image = getRandomNftImage();
  const embed = new EmbedBuilder()
    .setTitle('🩸 Elimination Round')
    .setDescription(lines.join('\n'))
    .setImage(image);

  channel.send({ embeds: [embed] });
}
function runMutationEvent(channel) {
  const alive = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  if (alive.length === 0) return;

  const target = alive[Math.floor(Math.random() * alive.length)];
  const outcome = Math.random();
  let resultText = '';
  if (outcome < 0.25) {
    target.lives++;
    resultText = `🧪 Mutation Success! ${target.username} grew an extra limb and gained 1 life!`;
  } else if (outcome < 0.5) {
    target.lives--;
    if (target.lives <= 0) {
      target.eliminated = true;
      eliminatedPlayers.push(target);
      resultText = `💀 Mutation Failed! ${target.username} melted into goo and was eliminated!`;
    } else {
      resultText = `⚠️ Mutation Backfire! ${target.username} lost 1 life!`;
    }
  } else {
    resultText = `🌀 Mutation passed over ${target.username}... this time.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🧬 Mutation Event')
    .setDescription(resultText)
    .setImage(getRandomNftImage());

  channel.send({ embeds: [embed] });
}
function runMiniGameEvent(channel) {
  const alive = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  if (alive.length < 2) return;

  const [p1, p2] = shuffleArray(alive).slice(0, 2);
  const winner = Math.random() < 0.5 ? p1 : p2;
  const loser = winner === p1 ? p2 : p1;

  winner.lives++;
  loser.lives--;
  if (loser.lives <= 0) {
    loser.eliminated = true;
    eliminatedPlayers.push(loser);
  }

  const embed = new EmbedBuilder()
    .setTitle('🎲 Mini Game Duel')
    .setDescription(`🎮 ${p1.username} vs ${p2.username}\n🏆 Winner: ${winner.username} (gains 1 life)\n💀 Loser: ${loser.username} (loses 1 life)`)
    .setImage(getRandomNftImage());

  channel.send({ embeds: [embed] });
}
function runMassRevivalEvent(channel) {
  const dead = eliminatedPlayers;
  const newPlayers = [];

  const revived = dead.filter(() => Math.random() < 0.6);
  revived.forEach(p => {
    p.eliminated = false;
    p.lives = 1;
  });

  const newNames = ['ReviveBot', 'UglyVamp', 'GrubGuts', 'GhostMop', 'Freakoid'];
  newNames.forEach(name => {
    if (Math.random() < 0.4) {
      gamePlayers.push({ id: name, username: name, lives: 1, eliminated: false });
      newPlayers.push(name);
    }
  });

  eliminatedPlayers = eliminatedPlayers.filter(p => p.eliminated); // Filter those who revived
  const embed = new EmbedBuilder()
    .setTitle('🪦 Totem of Lost Souls — Mass Revival')
    .setDescription(`💫 Revived: ${revived.map(p => p.username).join(', ') || 'None'}\n🧟 New Entrants: ${newPlayers.join(', ') || 'None'}`)
    .setImage(getRandomNftImage());

  channel.send({ embeds: [embed] });
}

}
function handleTrialCommand(message) {
  const mockPlayers = generateMockPlayers(20); // Create 20 test players
  message.channel.send('🧪 Starting Gauntlet Trial Mode with 20 randomly generated test players...');
  await runGauntlet(message.channel, mockPlayers); // Launch the game with mock players
}
function generateTrialPlayers(count) {
  const trialPlayers = [];
  for (let i = 1; i <= count; i++) {
    trialPlayers.push({
      id: `Trial${i}`,
      username: `Trial${i}`,
      isTrial: true,
      lives: 1,
    });
  }
  return trialPlayers;
}
function handleTrialCommand(message) {
  const trialPlayers = generateTrialPlayers(20);
  message.channel.send('⚔️ Starting Gauntlet Trial Mode with 20 randomly generated test players...');
  startGauntlet(trialPlayers, message.channel, true); // true = isTrialMode
}
// Actual launch logic for dev command
function handleDevCommand(message) {
  const devPlayers = generateTrialPlayers(8); // Small group for quick test
  message.channel.send('🧪 Starting Gauntlet Dev Mode with 8 test players...');
  startGauntlet(devPlayers, message.channel, true); // true = isTrialMode or local test mode
}


client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  // !gauntlet [optionalMinutes]
  if (content.startsWith('!gauntlet')) {
    const parts = content.split(' ');
    const minutes = parseInt(parts[1]);
    const joinDuration = isNaN(minutes) ? 3 : minutes;
    startJoinPhase(message.channel, joinDuration, false);
  }

  // !gauntlettrial - test run with mock players
  if (content === '!gauntlettrial') {
    startTrialMode(message.channel);
  }

  // !gauntletdev - developer-only fast test
  if (content === '!gauntletdev') {
    startJoinPhase(message.channel, 0.25, true); // 15 seconds
  }
});

client.login(process.env.BOT_TOKEN);
