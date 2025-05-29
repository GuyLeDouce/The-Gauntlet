require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
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
  .then(() => console.log('✅ Connected to PostgreSQL!'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// --- Global State ---
let players = [];
let eliminatedPlayers = [];
let rematchVotes = new Set();
let gameInProgress = false;
let massRevivalUsed = false;
let consecutiveGames = 0;
let currentChannel = null;
// --- Helper Functions ---
function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomAlivePlayers(count) {
  return shuffleArray(players.filter(p => !p.eliminated && p.lives > 0)).slice(0, count);
}

function eliminatePlayer(player, reason) {
  player.lives--;
  if (player.lives <= 0) {
    player.eliminated = true;
    eliminatedPlayers.push(player);
  }
}

function sendGameMessage(content) {
  if (currentChannel) currentChannel.send(content);
}

function getRandomNftImage() {
  const useUgly = Math.random() < 0.5;
  const tokenId = Math.floor(Math.random() * (useUgly ? 530 : 300)) + 1;
  return useUgly
    ? `https://opensea.io/assets/ethereum/0x9492505633d74451bdf3079c09ccc979588bc309/${tokenId}`
    : `https://opensea.io/assets/ethereum/0x1cd7fe72d64f6159775643acedc7d860dfb80348/${tokenId}`;
}

// --- Lore Arrays ---
const eliminationReasons = [
  "was swallowed by a sentient outhouse.",
  "tripped over their own ego and fell into the abyss.",
  "challenged a goose to a duel and lost.",
  "thought the red button was candy. It wasn’t.",
  "stood too close to the lorehole.",
  "failed the vibe check and got booted.",
  "opened the Charmhole and got sucked in.",
  "tried to bribe the Ugly Gods with a Hot Pocket.",
  "got rejected by every Monster... simultaneously.",
  "poked the wrong toad and evaporated.",
  "slipped on a pile of Squigs and disappeared.",
  "lost a staring contest with the Void.",
  "used their last neuron on a meme reply.",
  "got eaten by their own echo.",
  "wandered into the Molded Marketplace unprepared.",
  "declared themselves 'Not Ugly' and got smited.",
  "asked too many questions about $CHARM.",
  "unwrapped a cursed burrito.",
  "tried to craft a perfect Ugly and paid the price.",
  "opened a cursed vending machine prize."
];

const reviveSuccessMessages = [
  "clawed their way out of the abyss!",
  "used an Uno Reverse card on death!",
  "glitched back into reality.",
  "offered a single $CHARM and was forgiven.",
  "rode an Ugly Monster back to life.",
  "convinced the Reaper with a knock-knock joke.",
  "got spit out by the Charmhole.",
  "won a revival raffle while dead.",
  "screamed 'I’m still Ugly!' and respawned.",
  "traded 3 memes for one more shot."
];

const reviveFailureMessages = [
  "tried to return, but the portal slammed shut.",
  "nearly made it, then tripped on lore.",
  "offered expired $COFFEE tokens.",
  "got denied by the Totem of Lost Souls.",
  "accidentally revived someone else.",
  "got distracted by Monster merch.",
  "hit 'Reply All' and vanished from time.",
  "pushed the wrong summoning button.",
  "tried to flex and pulled a hammy mid-respawn.",
  "lost a debate with the Ugly Oracle."
];
// --- Mutation Events ---
const mutationEvents = [
  {
    name: "Whispering Shadows",
    description: "A wall of shadows descends. Choose to listen or run.",
    effect: async () => {
      const [lucky] = getRandomAlivePlayers(1);
      const [doomed] = getRandomAlivePlayers(1).filter(p => p !== lucky);
      if (lucky) lucky.lives++;
      if (doomed) eliminatePlayer(doomed, "was consumed by the whispering void.");
    }
  },
  {
    name: "Ugly Mirror",
    description: "Face your reflection. Some find strength, others despair.",
    effect: async () => {
      const r = Math.random();
      const [player] = getRandomAlivePlayers(1);
      if (!player) return;
      if (r < 0.33 && eliminatedPlayers.length) {
        const revived = eliminatedPlayers.pop();
        revived.eliminated = false;
        revived.lives = 1;
        players.push(revived);
        sendGameMessage(`💀 The mirror cracks and <@${revived.id}> walks free!`);
      } else if (r < 0.66) {
        eliminatePlayer(player, "fainted at their own reflection.");
      } else {
        player.lives++;
        sendGameMessage(`💅 <@${player.id}> admired their hideousness. +1 life.`);
      }
    }
  },
  {
    name: "Cauldron of Chance",
    description: "Sip the soup. It could cure or kill.",
    effect: async () => {
      const targets = getRandomAlivePlayers(2);
      for (const player of targets) {
        const r = Math.random();
        if (r < 0.4) {
          player.lives++;
          sendGameMessage(`🥣 <@${player.id}> drank bravery broth! +1 life.`);
        } else if (r < 0.8) {
          eliminatePlayer(player, "drank cursed soup and melted.");
        } else {
          sendGameMessage(`🍵 <@${player.id}> sipped confusion. Nothing happened.`);
        }
      }
    }
  }
];

// --- Mini-Games ---
const mutationMiniGames = [
  {
    name: "Lever of Regret",
    description: "Pull the lever? It promises... something.",
    interaction: async () => {
      const [player] = getRandomAlivePlayers(1);
      if (!player) return;
      const r = Math.random();
      if (r < 0.5) {
        player.lives++;
        sendGameMessage(`🕹️ <@${player.id}> pulled the Lever and got +1 life!`);
      } else {
        eliminatePlayer(player, "fell through the lever's lies.");
      }
    }
  },
  {
    name: "Goblin’s Gamble",
    description: "Flip a coin with a goblin. What could go wrong?",
    interaction: async () => {
      const [player] = getRandomAlivePlayers(1);
      if (!player) return;
      const r = Math.random();
      if (r < 0.5) {
        player.lives++;
        sendGameMessage(`🪙 Goblin grins. <@${player.id}> wins +1 life.`);
      } else {
        eliminatePlayer(player, "lost the Goblin’s Gamble and vanished.");
      }
    }
  },
  {
    name: "Mimic Chest",
    description: "Shiny box. Sharp teeth.",
    interaction: async () => {
      const [player] = getRandomAlivePlayers(1);
      if (!player) return;
      const r = Math.random();
      if (r < 0.5) {
        player.lives++;
        sendGameMessage(`📦 <@${player.id}> opened treasure! +1 life.`);
      } else {
        eliminatePlayer(player, "was devoured by a tongue-filled chest.");
      }
    }
  }
];

// --- Ugly Quotes ---
const uglyQuotes = [
  "“Being hideous is just advanced evolution.”",
  "“Stay ugly. Die laughing.”",
  "“Symmetry is for cowards.”",
  "“If you’re not disgusting, are you even trying?”",
  "“Charm is pain, darling.”",
  "“Born in the gutter, crowned in the mud.”"
];

// --- Lore Drops ---
const uglyLoreDrops = [
  "🌫️ Somewhere beyond the Market lies a swamp of forgotten memes...",
  "📜 They say the original Ugly still walks... twisted and crowned.",
  "🧃 $CHARM once dripped from the sky. Now we trade it like fools.",
  "🩸 The Monsters aren’t summoned. They’re remembering.",
  "🪞 Every reflection is a different version of Ugly. None better.",
  "🔥 Legends tell of a Flex so strong it tore through dimensions."
];

// --- Boss Entry Intros ---
const bossEntryLines = [
  "👑 **A malformed roar echoes...** The Boss has arrived.",
  "🧠 **The room warps. Eyes burn.** A new Boss takes form.",
  "☠️ **All kneel. All scream.** A Boss-level Ugly awakens.",
  "💥 **Power pulses. Reality skips.** This Boss means business.",
  "👺 **You feel smaller. You feel unworthy.** Bow to the Boss.",
  "🪦 **Their aura smells like cursed soup.** Respect the Boss."
];
// --- Warp Echoes ---
const warpEchoes = [
  "🌀 The air fractures. Something ancient tries to scream… but remembers too late it has no mouth.",
  "🌒 A second moon flickers into existence… then pops like a zit.",
  "🔮 You blink and everyone is wearing your face. Including the floor.",
  "💽 A voice whispers, ‘You were never meant to survive this round.’",
  "📡 Static builds. A malformed broadcast interrupts reality: **‘WE ARE SO BACK’**",
  "💀 A countdown begins. No one started it. No one knows what it’s for."
];

// --- Ugly Oracle Riddles ---
const uglyOracleRiddles = [
  {
    riddle: "I am the start of pain, the end of pride. You avoid me in mirrors, yet wear me with pride. What am I?",
    answer: "Ugly"
  },
  {
    riddle: "I have no face, but I mock you. No limbs, but I trip you. I whisper from nowhere, yet know your name. What am I?",
    answer: "Shadow"
  },
  {
    riddle: "I multiply when denied, vanish when embraced. I live in your skin and scream in silence. What am I?",
    answer: "Fear"
  },
  {
    riddle: "You created me, cursed me, then tried to sell me. Now I come for you. What am I?",
    answer: "NFT"
  },
  {
    riddle: "Break me, and I am free. Hold me, and I rot. Share me, and I live. What am I?",
    answer: "Secret"
  }
];

// --- Uglychants (Formerly Quirkling Chants) ---
const uglychants = [
  "👄 All chant in twisted tongues: _Ugly in, beauty out. Charm devours all doubt._",
  "🕯️ The crowd howls: _Sacrifice five, summon one. Monsters crawl when charm is spun._",
  "🫀 They chant without mouths: _Life is ugly, death is flex._",
  "💫 The malformed chant: _Drip your soul. Trade your face._",
  "🎭 Echoes return: _No winners. Just survivors._",
  "📢 Voices cry from the charmhole: _One gets crowned, all get cursed._"
];
// --- JOIN PHASE ---
async function startJoinPhase(channel, durationMinutes = 3, isTrial = false) {
  if (gameInProgress) {
    return channel.send("⛔ A Gauntlet is already running!");
  }

  players = [];
  eliminatedPlayers = [];
  rematchVotes = new Set();
  massRevivalUsed = false;
  currentChannel = channel;
  gameInProgress = true;

  const joinEmbed = new EmbedBuilder()
    .setTitle("🎮 The Gauntlet Begins!")
    .setDescription(`Click the button below to join.\nTime remaining: **${durationMinutes} minutes**`)
    .setColor("#2ecc71")
    .setFooter({ text: "Enter if you're Ugly enough..." });

  const joinButton = new ButtonBuilder()
    .setCustomId("join_button")
    .setLabel("Join The Gauntlet")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(joinButton);
  const joinMessage = await channel.send({ embeds: [joinEmbed], components: [row] });

  const collector = joinMessage.createMessageComponentCollector({
    componentType: 2,
    time: durationMinutes * 60 * 1000
  });

  collector.on("collect", async interaction => {
    const userId = interaction.user.id;
    if (players.some(p => p.id === userId)) {
      await interaction.reply({ content: "You've already joined!", ephemeral: true });
      return;
    }

    players.push({
      id: userId,
      username: interaction.user.username,
      lives: 1,
      eliminated: false,
      isTrial
    });

    await interaction.reply({ content: "✅ You're in!", ephemeral: true });
  });

  collector.on("end", async () => {
    await joinMessage.edit({ components: [] });

    if (players.length < 3) {
      await channel.send("❌ Not enough players joined. The Gauntlet fizzles out...");
      gameInProgress = false;
    } else {
      await runBossVotePhase(channel);
    }
  });

  // Ping reminders
  setTimeout(() => channel.send("@everyone ⏳ Time’s running out! Join The Gauntlet now!"), (durationMinutes * 20 * 1000));
  setTimeout(() => channel.send("@everyone ⚠️ Final call! Last minute to join!"), (durationMinutes * 40 * 1000));
}

// --- START GAUNTLET ---
async function startGauntlet(channel, trial = false) {
  currentChannel = channel;
  gameInProgress = true;
  massRevivalUsed = false;
  rematchVotes.clear();
  eliminatedPlayers = [];

  await channel.send(trial
    ? "🧪 **Trial Mode Activated!** Mock players enter the chaos..."
    : "🌀 **The Gauntlet begins now!** Prepare to be twisted."
  );

  await runBossVotePhase(channel);
}

// --- BOSS VOTE PHASE ---
async function runBossVotePhase(channel) {
  const alive = players.filter(p => !p.eliminated);
  const candidates = shuffleArray(alive).slice(0, 5);

  const row = new ActionRowBuilder().addComponents(
    candidates.map(p =>
      new ButtonBuilder()
        .setCustomId(`vote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const embed = new EmbedBuilder()
    .setTitle("👑 Boss Vote")
    .setDescription("Choose who should become the Boss-level Ugly.\nThey’ll start with **2 lives**.")
    .setColor("Red");

  const voteMsg = await channel.send({ embeds: [embed], components: [row] });

  const voteCounts = new Map();
  const alreadyVoted = new Set();

  const collector = voteMsg.createMessageComponentCollector({ time: 10_000 });

  collector.on("collect", async i => {
    if (alreadyVoted.has(i.user.id)) {
      await i.reply({ content: "🛑 You already voted!", ephemeral: true });
      return;
    }

    alreadyVoted.add(i.user.id);
    const selectedId = i.customId.replace("vote_", "");
    voteCounts.set(selectedId, (voteCounts.get(selectedId) || 0) + 1);

    await i.reply({ content: "✅ Vote cast!", ephemeral: true });
  });

  collector.on("end", async () => {
    let topId = null;
    let max = -1;
    for (const [id, count] of voteCounts.entries()) {
      if (count > max) {
        max = count;
        topId = id;
      }
    }

    const boss = players.find(p => p.id === topId);
    if (boss) {
      boss.lives = 2;
      await channel.send(`👑 <@${boss.id}> has been chosen as **Boss Level Ugly** and begins with **2 lives**!`);
      if (bossEntryLines.length) {
        const intro = shuffleArray(bossEntryLines)[0];
        await channel.send(intro);
      }
    } else {
      await channel.send("No Boss was chosen. The Gauntlet proceeds normally...");
    }

    // Proceed to game loop next
    await runGauntlet(channel);
  });
}
async function runGauntlet(channel) {
  while (players.filter(p => !p.eliminated && p.lives > 0).length > 1) {
    await wait(8000); // 8-second pause between rounds

    // 💬 Random Lore Flavor (20% chance each)
    if (Math.random() < 0.2 && warpEchoes.length) {
      const echo = shuffleArray(warpEchoes)[0];
      await channel.send(`✨ **Warp Echo**: _${echo}_`);
    }
    if (Math.random() < 0.15 && uglychants.length) {
      const chant = shuffleArray(uglychants)[0];
      await channel.send(`📢 ${chant}`);
    }
    if (Math.random() < 0.1 && uglyOracleRiddles.length) {
      const oracle = shuffleArray(uglyOracleRiddles)[0];
      await channel.send(`🔮 **The Ugly Oracle speaks:**\n_${oracle.riddle}_\n(Answer in chat within 10 seconds to survive)`);

      const filter = m => !m.author.bot && oracle.answer.toLowerCase() === m.content.trim().toLowerCase();
      try {
        const response = await channel.awaitMessages({ filter, max: 1, time: 10000, errors: ["time"] });
        const winner = players.find(p => p.id === response.first().author.id);
        if (winner) {
          winner.lives++;
          await channel.send(`✨ <@${winner.id}> answered correctly and gains +1 life!`);
        }
      } catch {
        await channel.send(`❌ No one answered the riddle. The Oracle fades into static...`);
      }
    }

    // 🎲 Random event type
    const roll = Math.random();
    if (roll < 0.4) {
      await runEliminationRound(channel);
    } else if (roll < 0.6) {
      await runMutationEvent(channel);
    } else if (roll < 0.8) {
      await runMiniGameEvent(channel);
    } else if (!massRevivalUsed) {
      await triggerMassRevival(channel);
    }
  }

  // 🎉 Game Over
  await showFinalPodium(channel);
  await showRematchButton(channel);
  gameInProgress = false;
}
// --- ELIMINATION ROUND ---
async function runEliminationRound(channel) {
  const alive = players.filter(p => !p.eliminated && p.lives > 0);
  if (alive.length === 0) return;

  const count = Math.min(3, Math.max(2, Math.floor(alive.length * 0.3)));
  const chosen = shuffleArray(alive).slice(0, count);

  const lines = [];
  for (const player of chosen) {
    eliminatePlayer(player, "eliminated by chaos.");
    const reason = shuffleArray(eliminationReasons)[0];
    lines.push(`☠️ <@${player.id}> ${reason}`);
  }

  const embed = new EmbedBuilder()
    .setTitle("🩸 Elimination Round")
    .setDescription(lines.join("\n"))
    .setImage(getRandomNftImage())
    .setColor("DarkRed");

  await channel.send({ embeds: [embed] });
}

// --- MUTATION EVENT ---
async function runMutationEvent(channel) {
  const mutation = shuffleArray(mutationEvents)[0];
  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation: ${mutation.name}`)
    .setDescription(mutation.description)
    .setColor("Purple")
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
  await mutation.effect();
}

// --- MINI-GAME EVENT ---
async function runMiniGameEvent(channel) {
  const mini = shuffleArray(mutationMiniGames)[0];
  const embed = new EmbedBuilder()
    .setTitle(`🎲 Mini-Game: ${mini.name}`)
    .setDescription(mini.description)
    .setColor("Blue")
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
  await mini.interaction();
}

// --- MASS REVIVAL EVENT ---
async function triggerMassRevival(channel) {
  if (massRevivalUsed) return;
  massRevivalUsed = true;

  const embed = new EmbedBuilder()
    .setTitle("☠️ Totem of Lost Souls Awakens")
    .setDescription("Eliminated players and lurking lurkers may return...\nClick to tempt fate.")
    .setColor("DarkPurple");

  const reviveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("massReviveClick")
      .setLabel("Return Through the Rift")
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [reviveRow] });

  const revived = [];
  const newcomers = [];
  const attempted = [];

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on("collect", async interaction => {
    const userId = interaction.user.id;
    if (attempted.includes(userId)) return;
    attempted.push(userId);

    const isEliminated = eliminatedPlayers.find(p => p.id === userId);
    const isNew = !players.some(p => p.id === userId);

    if (isEliminated && Math.random() < 0.6) {
      isEliminated.eliminated = false;
      isEliminated.lives = 1;
      revived.push(isEliminated);
    } else if (isNew && Math.random() < 0.4) {
      players.push({
        id: userId,
        username: interaction.user.username,
        lives: 1,
        eliminated: false,
        isTrial: false
      });
      newcomers.push(userId);
    }

    await interaction.deferUpdate();
  });

  collector.on("end", async () => {
    const lines = [];
    if (revived.length) lines.push(`🧟 Returned: ${revived.map(p => `<@${p.id}>`).join(", ")}`);
    if (newcomers.length) lines.push(`👀 Newcomers: ${newcomers.map(id => `<@${id}>`).join(", ")}`);
    if (!lines.length) lines.push("💀 None survived the call...");

    const resultEmbed = new EmbedBuilder()
      .setTitle("⚡ Revival Results")
      .setDescription(lines.join("\n"))
      .setColor("Fuchsia");

    await channel.send({ embeds: [resultEmbed] });
  });
}
// --- FINAL PODIUM ---
async function showFinalPodium(channel) {
  const survivors = players.filter(p => !p.eliminated);
  let podium = [];

  if (survivors.length >= 3) {
    podium = shuffleArray(survivors).slice(0, 3);
  } else if (survivors.length > 0) {
    const extras = eliminatedPlayers.slice(-3 + survivors.length);
    podium = survivors.concat(extras);
  } else {
    podium = eliminatedPlayers.slice(-3);
  }

  const positions = ["🏆 1st Place", "🥈 2nd Place", "🥉 3rd Place"];
  const desc = podium.map((p, i) => `${positions[i]} — <@${p.id}>`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🎉 Final Podium")
    .setDescription(`${desc}\n\nUgly reigns eternal.`)
    .setColor("Gold");

  await channel.send({ embeds: [embed] });

  // Update stats
  if (podium[0]) {
    await updatePlayerStats(podium[0].id, podium[0].username, "win");
  }
  for (const p of players) {
    await updatePlayerStats(p.id, p.username, "game");
  }

  if (uglychants.length) {
    const chant = shuffleArray(uglychants)[0];
    await channel.send(`📢 ${chant}`);
  }
}

// --- REMATCH BUTTON ---
async function showRematchButton(channel) {
  const previousIds = players.map(p => p.id);
  const requiredVotes = Math.ceil(previousIds.length * 0.75);
  rematchVotes = new Set();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rematch_vote")
      .setLabel("🔁 Join the Rematch")
      .setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({
    content: `The Gauntlet has ended. Want to run it back?\nWe need **${requiredVotes} votes** from last players to begin.`,
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({
    componentType: 2,
    time: 60000
  });

  collector.on("collect", async i => {
    if (!previousIds.includes(i.user.id)) {
      await i.reply({ content: "⛔ You weren't in the last game.", ephemeral: true });
      return;
    }

    rematchVotes.add(i.user.id);
    const current = rematchVotes.size;

    await i.reply({ content: `✅ You've voted to rematch. ${current}/${requiredVotes}`, ephemeral: true });

    if (current >= requiredVotes) {
      collector.stop("start_rematch");
    }
  });

  collector.on("end", async (_collected, reason) => {
    await msg.edit({ components: [] });

    if (reason === "start_rematch") {
      consecutiveGames++;
      await startJoinPhase(channel, 3);
    } else {
      consecutiveGames = 0;
      await channel.send("⏹️ Rematch vote ended. Start a new Gauntlet manually with `!gauntlet`.");
    }
  });
}

// --- PLAYER STATS TRACKING ---
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
      `INSERT INTO player_stats (user_id, username, year, month, wins, revives, games_played, duel_wins)
       VALUES ($1, $2, $3, $4, 0, 0, 0, 0)`,
      [userId, username, year, month]
    );
  }

  let column = "";
  if (category === "win") column = "wins";
  if (category === "revive") column = "revives";
  if (category === "game") column = "games_played";
  if (category === "duel") column = "duel_wins";

  if (column) {
    await db.query(
      `UPDATE player_stats SET ${column} = ${column} + 1 WHERE user_id = $1 AND year = $2 AND month = $3`,
      [userId, year, month]
    );
  }
}
// --- COMMAND LISTENERS ---
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  // Start Trial Mode
  if (content === "!gauntlettrial") {
    players = [];
    for (let i = 1; i <= 20; i++) {
      players.push({
        id: `Trial${i}`,
        username: `Trial${i}`,
        lives: 1,
        eliminated: false,
        isTrial: true
      });
    }
    await startGauntlet(message.channel, true);
  }

  // Quick Dev Gauntlet (15s)
  if (content === "!gauntletdev") {
    await startJoinPhase(message.channel, 0.25, true); // 15s
  }
  // Start a normal Gauntlet
  if (content.startsWith("!gauntlet")) {
    const parts = content.split(" ");
    const minutes = parseInt(parts[1]);
    const joinDuration = isNaN(minutes) ? 3 : minutes;
    await startJoinPhase(message.channel, joinDuration, false);
  }
  // Show leaderboard
  if (content.startsWith("!leaderboard")) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const result = await db.query(`
      SELECT username, wins, revives, games_played,
      CASE WHEN games_played > 0 THEN ROUND(wins::decimal / games_played, 2) ELSE 0 END as avg
      FROM player_stats
      WHERE year = $1 AND month = $2
      ORDER BY wins DESC, revives DESC
      LIMIT 10
    `, [year, month]);

    const leaderboard = result.rows.map((p, i) =>
      `**${i + 1}. ${p.username}** — 🏆 ${p.wins} Wins | ♻️ ${p.revives} Revives | 🎮 ${p.games_played} Games | 📊 ${p.avg} Avg Win`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📈 Monthly Gauntlet Leaderboard")
      .setDescription(leaderboard || "No data yet!")
      .setColor("Gold");

    await message.reply({ embeds: [embed] });
  }
});

// --- CLIENT LOGIN ---
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

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
    console.log("📊 Database initialized.");
  } catch (err) {
    console.error("❌ DB setup error:", err);
  }
});

client.login(process.env.BOT_TOKEN);
