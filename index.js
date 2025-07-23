// === GAUNTLET: POINTS-BASED VERSION WITH LORE ===

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Collection
} = require('discord.js');

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

// === Global Game State ===
let activeGame = null;
let rematchCount = 0;
const maxRematches = 4;
let gameChannel = null;
let joinMessageLink = null;
const authorizedUsers = ['826581856400179210', '1288107772248064044'];
let usedRiddleIndices = new Set();

// === Utility ===
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getUglyImageUrl() {
  const tokenId = Math.floor(Math.random() * 615) + 1;
  return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
}

function getMonsterImageUrl() {
  const tokenId = Math.floor(Math.random() * 126) + 1;
  return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}
// === Mini-Game Lore Pools & Flavor ===

const miniGameLorePool = [
  {
    title: "🎁 Pick a Prize",
    lore: "It’s totally random. Just pick one and hope for the best.",
    buttons: ["Box A", "Box B", "Box C", "Box D"]
  },
  {
    title: "🍕 Mystery Snack Time",
    lore: "You’re hungry. One of these snacks might help. Or not.",
    buttons: ["Cold Pizza", "Weird Burrito", "Melted Ice Cream", "Mystery Meat"]
  },
  {
    title: "🛏️ Dream Options",
    lore: "Four dreams float in the air. Choose one to nap in. Outcomes vary.",
    buttons: ["Flying Dream", "Falling Dream", "Late-for-Class Dream", "Totally Blank Dream"]
  },
  {
    title: "🧼 Clean or Cursed?",
    lore: "One of these soaps is cursed. The rest are just... soap.",
    buttons: ["Lemon Fresh", "Minty One", "Sketchy Bar", "Unknown Goo"]
  },
  {
    title: "🚪 Door Decision",
    lore: "Pick a door. Don’t overthink it. Or do. Won’t help.",
    buttons: ["Red Door", "Blue Door", "Green Door", "Wiggly Door"]
  },
  {
    title: "📺 Channel Surfing",
    lore: "You're flipping channels. What’s on might be your fate.",
    buttons: ["Cooking Show", "Weather Alert", "Cartoon Hour", "Static"]
  },
  {
    title: "🎨 Squig Expressionism",
    lore: "Each Squig drew one. Each is cursed in a different way.",
    buttons: ["Squig A", "Squig B", "Squig C", "Squig D"]
  },
  {
    title: "🔮 Charm Coin Flip",
    lore: "The coins are spinning mid-air. Choose your side — fast.",
    buttons: ["Heads", "Tails", "Edge", "Melted"]
  }
];

const miniGameFateDescriptions = [
  "The charm stirs. One button is blessed, the others are bitter.",
  "Only one fate uplifts. The rest whisper in riddles.",
  "Squigs have meddled here. Nothing makes sense anymore.",
  "Pick fast. The walls are starting to breathe.",
  "The charm’s eye is open. It will remember your choice.",
  "All outcomes are rigged. You just don’t know how.",
  "Your gut lies. Your brain lies. Just click something.",
  "Behind one door: hope. Behind the rest? Ha.",
  "Click now or regret it forever.",
  "You can’t win them all. But maybe you can survive this one."
];

const pointFlavors = {
  "+2": [
    "✨ bathed in CHARM and came out dazzling.",
    "🧃 drank ancient juice. Gained weird strength.",
    "📜 read a prophecy upside-down. It still worked.",
    "🐸 kissed a Squig. Somehow gained points.",
    "🌀 stared into the void. It winked back, approvingly."
  ],
  "+1": [
    "🎈 floated through the challenge unscathed.",
    "💡 guessed right by accident. The charm shrugged.",
    "📦 opened the least cursed box.",
    "🔮 squinted at the sigils and kinda got it.",
    "🎤 blurted out an answer with confidence. It worked."
  ],
  "-1": [
    "🍄 stepped on a lore mushroom. Slippery.",
    "🧤 picked the sticky option. Ew. Minus one.",
    "📺 watched cursed static too long.",
    "🧻 slipped on ritual TP. Classic fail.",
    "📉 tried to trade SquigCoin. It crashed. Hard."
  ],
  "-2": [
    "🥴 called the charm ugly. It heard.",
    "🪦 tripped into a portable grave.",
    "🍖 stole meat from a Squig BBQ. Bad move.",
    "🎭 mocked the ritual. Got cursed with a new face.",
    "🪞 lost a staring contest with their reflection."
  ]
};
const riddles = [
  { riddle: "I have keys but no locks. I have space but no room. You can enter but not go outside. What am I?", answers: ["keyboard"], difficulty: 1 },
  { riddle: "I get wetter the more I dry. What am I?", answers: ["towel"], difficulty: 1 },
  { riddle: "The more you take from me, the bigger I become. What am I?", answers: ["hole"], difficulty: 1 },
  { riddle: "I go up but never come down. What am I?", answers: ["age"], difficulty: 1 },
  { riddle: "I speak without a mouth and hear without ears. What am I?", answers: ["echo"], difficulty: 1 },
  { riddle: "What has hands but can’t clap?", answers: ["clock"], difficulty: 1 },
  { riddle: "What has legs but doesn’t walk?", answers: ["table"], difficulty: 1 },
  { riddle: "I follow you everywhere but disappear in the dark. What am I?", answers: ["shadow"], difficulty: 1 },
  { riddle: "I’m tall when I’m young and short when I’m old. What am I?", answers: ["candle"], difficulty: 1 },
  { riddle: "What comes down but never goes up?", answers: ["rain"], difficulty: 1 },
  { riddle: "I fly without wings. I cry without eyes. What am I?", answers: ["cloud"], difficulty: 1 },
  { riddle: "You buy me to eat, but never eat me. What am I?", answers: ["plate"], difficulty: 1 },
  { riddle: "What can you catch but not throw?", answers: ["cold"], difficulty: 1 },
  { riddle: "I have a face but no eyes, hands but no arms. What am I?", answers: ["clock"], difficulty: 1 },
  { riddle: "I run but never walk, have a bed but never sleep. What am I?", answers: ["river"], difficulty: 1 },
  { riddle: "The more you have of me, the less you see. What am I?", answers: ["darkness"], difficulty: 1 },
  { riddle: "What has a head, a tail, but no body?", answers: ["coin"], difficulty: 1 },
  { riddle: "What can fill a room but takes up no space?", answers: ["light"], difficulty: 1 },
  { riddle: "What gets broken without being held?", answers: ["promise"], difficulty: 1 },
  { riddle: "What has one eye but can’t see?", answers: ["needle"], difficulty: 1 },
  { riddle: "I can be cracked, made, told, and played. What am I?", answers: ["joke"], difficulty: 2 },
  { riddle: "I’m taken from a mine and shut in a wooden case, but I help you express yourself. What am I?", answers: ["pencil"], difficulty: 2 },
  { riddle: "I shrink smaller every time you use me, yet I never complain. What am I?", answers: ["soap"], difficulty: 2 },
  { riddle: "I fall but never rise. I’m part of night and day, but never seen. What am I?", answers: ["darkness"], difficulty: 2 },
  { riddle: "I connect two people but touch only one. What am I?", answers: ["phone"], difficulty: 2 },
  { riddle: "You see me once in June, twice in November, but not at all in May. What am I?", answers: ["e"], difficulty: 2 },
  { riddle: "What begins with T, ends with T, and has T in it?", answers: ["teapot"], difficulty: 2 },
  { riddle: "What has cities but no houses, rivers but no water, and roads but no cars?", answers: ["map"], difficulty: 2 },
  { riddle: "I am full of holes but I hold water. What am I?", answers: ["sponge"], difficulty: 2 },
  { riddle: "What five-letter word becomes shorter when you add two letters to it?", answers: ["short"], difficulty: 2 },
  { riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?", answers: ["m"], difficulty: 2 },
  { riddle: "What has many teeth but can’t bite?", answers: ["comb"], difficulty: 2 },
  { riddle: "I have branches but no trunk, leaves, or fruit. What am I?", answers: ["bank"], difficulty: 2 },
  { riddle: "I travel the world while staying in the same spot. What am I?", answers: ["stamp"], difficulty: 2 },
  { riddle: "The more you take, the more you leave behind. What am I?", answers: ["footsteps"], difficulty: 2 },
  { riddle: "I’m always in front of you but can’t be seen. What am I?", answers: ["future"], difficulty: 2 },
  { riddle: "What has to be broken before you can use it?", answers: ["egg"], difficulty: 2 },
  { riddle: "I have no life, but I can die. What am I?", answers: ["battery"], difficulty: 2 },
  { riddle: "I’m lighter than a feather, yet the strongest person can’t hold me for long. What am I?", answers: ["breath"], difficulty: 2 },
  { riddle: "I have eyes but no sight, a crown but no head. What am I?", answers: ["potato"], difficulty: 2 },
  { riddle: "The person who makes it has no use for it. The person who buys it doesn’t need it. The person who uses it doesn’t know it. What is it?", answers: ["coffin"], difficulty: 3 },
  { riddle: "What walks on four legs in the morning, two legs at noon, and three legs in the evening?", answers: ["man", "human"], difficulty: 3 },
  { riddle: "I am always hungry, I must always be fed. The finger I touch will soon turn red. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "I can only live where there is light, but I die if the light shines on me. What am I?", answers: ["shadow"], difficulty: 3 },
  { riddle: "What comes back but never arrives?", answers: ["tomorrow"], difficulty: 3 },
  { riddle: "The more you remove from me, the stronger I become. What am I?", answers: ["hole"], difficulty: 3 },
  { riddle: "You measure my life in hours, I serve you by expiring. I'm quick when I'm thin and slow when I'm fat. What am I?", answers: ["candle"], difficulty: 3 },
  { riddle: "What belongs to you, but others use it more than you do?", answers: ["name"], difficulty: 3 },
  { riddle: "I turn once, what is out will not get in. I turn again, what is in will not get out. What am I?", answers: ["key"], difficulty: 3 },
  { riddle: "I have no voice, yet I speak to you. I tell of all things in the world that people do. I have leaves, but I’m not a tree. What am I?", answers: ["book"], difficulty: 3 },
  { riddle: "Forward I am heavy, but backward I’m not. What am I?", answers: ["ton"], difficulty: 3 },
  { riddle: "The more you look at me, the less you can see. What am I?", answers: ["darkness"], difficulty: 3 },
  { riddle: "I am taken from the ground and shut up in a box, from which I’m never released, and yet I am used by almost every person. What am I?", answers: ["pencil lead", "lead"], difficulty: 3 },
  { riddle: "I have lakes with no water, mountains with no stone, and cities with no people. What am I?", answers: ["map"], difficulty: 3 },
  { riddle: "The more I dry, the wetter I become. What am I?", answers: ["towel"], difficulty: 3 },
  { riddle: "I am not alive, but I grow. I don’t have lungs, but I need air. I don’t have a mouth, but water kills me. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "I build up castles. I tear down mountains. I make some men blind, I help others to see. What am I?", answers: ["sand"], difficulty: 3 },
  { riddle: "What flies forever, rests never?", answers: ["time"], difficulty: 3 },
  { riddle: "Whoever makes me, tells me not. Whoever takes me, knows me not. Whoever knows me, wants me not. What am I?", answers: ["counterfeit", "fake", "secret"], difficulty: 3 },
  { riddle: "What can run but never walks, has a bed but never sleeps, and has a mouth but never talks?", answers: ["river"], difficulty: 3 }
];


client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!gauntlet')) {
    if (!authorizedUsers.includes(message.author.id)) {
      return message.reply("⛔ Only authorized users can start the Gauntlet.");
    }

    if (activeGame) {
      return message.reply('⚠️ A Gauntlet is already running!');
    }

    const minutes = parseFloat(message.content.split(' ')[1]) || 3;
    const msUntilStart = minutes * 60 * 1000;
    const reminderInterval = msUntilStart / 3;

    activeGame = {
      players: new Map(),
      startTime: Date.now(),
    };
    gameChannel = message.channel;

    await message.channel.send(`@everyone ⚔️ A new Gauntlet begins in **${minutes}** minute(s)! Prepare your minds.`);

    setTimeout(async () => {
      await message.channel.send('⌛ One third of the time has passed... the charm is flexing.');
    }, reminderInterval);

    setTimeout(async () => {
      await message.channel.send('⏳ Two-thirds down... it’s almost time. Sharpen your weird.');
    }, reminderInterval * 2);

    setTimeout(async () => {
      await message.channel.send(`🎮 The Gauntlet has begun!`);
      await runPointsGauntlet(message.channel, 10, false); // ✅ fixed argument order
    }, msUntilStart);
  }
});
async function runPointsGauntlet(channel, overrideRounds = 10, isTestMode = false) {
  const maxRounds = 10;
  const playerMap = activeGame.players;

  let round = 1;

  while (round <= maxRounds) {
    // === Lore + Round Intro ===
    const lore = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
    const flavor = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];

    const intro = new EmbedBuilder()
      .setTitle(`🌪️ ROUND ${round} — ${lore.title}`)
      .setDescription(`_${lore.lore}_\n\n${flavor}`)
      .setImage(getUglyImageUrl())
      .setColor(0xaa00ff);

    await channel.send({ embeds: [intro] });
    await wait(5000);

    // === Mini-Game Phase ===
    await runMiniGamePoints(playerMap, channel, round, lore);
    await wait(5000);

    // === Riddle Phase ===
    await runRiddlePoints(playerMap, channel);
    await wait(5000);

    round++;
  }

  await showFinalScores(playerMap, channel);
}
async function runMiniGamePoints(players, channel, round, isTestMode = false) {
  const outcomes = [-2, -1, 1, 2];

  // Pick random mini-game from pool
  const miniGame = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle(`🎲 MINI-GAME CHALLENGE — ${miniGame.title}`)
    .setDescription(`${miniGame.lore}\n⏳ You have 30 seconds to decide.`)
    .setColor(0xff33cc);

  // Build dynamic buttons
  const row = new ActionRowBuilder().addComponents(
    miniGame.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`choice${idx + 1}`)
        .setLabel(label)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][idx % 4])
    )
  );

  await channel.send({ embeds: [embed], components: [row] });

  // Countdown
  setTimeout(() => channel.send("⏳ 20 seconds left...").catch(() => {}), 10000);
  setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 20000);
  setTimeout(() => channel.send("🎲 Time’s up. The charm decides.").catch(() => {}), 30000);

  const collector = channel.createMessageComponentCollector({ componentType: 2, time: 30000 });
  const clickedUsers = new Set();

  collector.on('collect', async i => {
    if (i.user.bot || clickedUsers.has(i.user.id)) return;
    clickedUsers.add(i.user.id);

    if (!players.has(i.user.id)) {
      players.set(i.user.id, {
        id: i.user.id,
        username: i.user.username,
        points: 0
      });
    }

    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    players.get(i.user.id).points += outcome;

    await i.reply({
      content: `You chose **${i.component.label}**\nYour fate: **${outcome > 0 ? '+' : ''}${outcome} point${Math.abs(outcome) !== 1 ? 's' : ''}**`,
      ephemeral: true
    });
  });

  collector.on('end', async () => {
    if (isTestMode) {
      for (const player of players.values()) {
        if (player.isMock) {
          const result = outcomes[Math.floor(Math.random() * outcomes.length)];
          player.points += result;
        }
      }
    }

    await channel.send(`🧮 Mini-game complete. Round ${round} points have been applied.`);
  });
}


function ensurePlayer(user, playerMap) {
  if (!playerMap.has(user.id)) {
    const newPlayer = {
      id: user.id,
      username: user.username,
      points: 0
    };
    playerMap.set(user.id, newPlayer);
  }
  return playerMap.get(user.id);
}
async function runRiddlePoints(players, channel) {
  const difficulties = ['easy', 'medium', 'hard'];
  const chosenDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
  const pointsForCorrect = chosenDifficulty === 'easy' ? 1 : chosenDifficulty === 'medium' ? 2 : 3;

  const filteredRiddles = riddles.filter(r => r.difficulty === chosenDifficulty);
  if (filteredRiddles.length === 0) {
    await channel.send(`⚠️ No riddles available for difficulty: ${chosenDifficulty}. Skipping riddle...`);
    return;
  }

  const riddle = filteredRiddles[Math.floor(Math.random() * filteredRiddles.length)];
  if (!riddle || !riddle.riddle) {
    await channel.send(`⚠️ Failed to retrieve a valid riddle. Skipping...`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🧠 RIDDLE CHALLENGE")
    .setDescription(
      `_${riddle.riddle}_\n\n🌀 Difficulty: **${chosenDifficulty.toUpperCase()}** — Worth **+${pointsForCorrect}** points.\n⏳ You have 30 seconds to decide your fate...`
    )
    .setColor(0xff66cc);

  await channel.send({ embeds: [embed] });

  // Set up answer collection
  const filter = m => !m.author.bot;
  const collector = channel.createMessageCollector({ filter, time: 30000 });
  const correctPlayers = [];

  collector.on('collect', message => {
    const player = players.get(message.author.id);
    if (!player) {
      players.set(message.author.id, {
        id: message.author.id,
        username: message.author.username,
        points: 0,
        isMock: false,
      });
    }

    const answer = message.content.trim().toLowerCase();
    if (riddle.answers.map(a => a.toLowerCase()).includes(answer)) {
      if (!correctPlayers.includes(message.author.id)) {
        correctPlayers.push(message.author.id);
        players.get(message.author.id).points += pointsForCorrect;
      }
    }
  });

  // Optional: update countdown messages
  setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 20000);
  setTimeout(() => channel.send("⏰ Time’s almost up!").catch(() => {}), 29000);

  collector.on('end', () => {
    channel.send(`Riddle completed. ${correctPlayers.length} player(s) answered correctly and gained +${pointsForCorrect} points.`);
  });
}



async function showFinalScores(playerMap, channel) {
  const players = [...playerMap.values()];
  const sorted = players.sort((a, b) => b.points - a.points);

  const top3 = sorted.slice(0, 3);
  const uniqueScores = new Set(top3.map(p => p.points));

  if (uniqueScores.size < 3) {
    await channel.send('⚖️ There is a tie among the top scorers. The charm demands a vote to break it.');
    await runPointTiebreaker(top3, channel);
  } else {
    await showFinalPodium(channel, players);
  }

  await wait(5000);
  activeGame = null;
  rematchCount++;

  if (rematchCount < maxRematches) {
    await channel.send(`📯 *The spirits stir... perhaps one more trial awaits?*`);
    await wait(2000);
    await showRematchButton(channel);
  }
}

async function showFinalPodium(channel, playerMap) {
  const players = [...playerMap.values()];
  const sorted = players.sort((a, b) => b.points - a.points);
  let top3 = sorted.slice(0, 3);

  const medals = ['👑🥇', '🩸🥈', '💀🥉'];
  const titles = [
    "⚔️ **Champion of the Charm** ⚔️",
    "🌑 **Scarred But Standing** 🌑",
    "🕳️ **Last One Dragged from the Void** 🕳️"
  ];

  const podiumEmbed = new EmbedBuilder()
    .setTitle("👁‍🗨️ THE FINAL PODIUM 👁‍🗨️")
    .setDescription("The charm acknowledges those who rose above...")
    .setColor(0xaa00ff);

  // Handle 2nd/3rd place ties ONLY (1st place remains highest scorer)
  const firstPlacePoints = top3[0].points;
  const secondAndThird = top3.slice(1);
  const tiePoints = secondAndThird[0]?.points;
  const tiedForSecond = secondAndThird.filter(p => p.points === tiePoints);

  if (tiedForSecond.length > 1) {
    const resolved = await runTiebreaker(tiedForSecond, channel);
    top3 = [top3[0], ...resolved]; // Keep 1st as-is, replace 2nd/3rd with vote result
  }

  top3.forEach((player, index) => {
    podiumEmbed.addFields({
      name: `${medals[index]} ${titles[index]}`,
      value: `<@${player.id}> \n**Total Points:** ${player.points}`,
      inline: false
    });
  });

  await channel.send({ embeds: [podiumEmbed] });

  await wait(5000);
  await showRematchButton(channel);
}
async function runTiebreaker(tiedPlayers, channel) {
  return new Promise(async (resolve) => {
    const voteCounts = new Map(tiedPlayers.map(p => [p.id, 0]));
    const votedUsers = new Set();

    const buttons = tiedPlayers.map((player, index) => {
      return new ButtonBuilder()
        .setCustomId(`vote_${player.id}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    const voteEmbed = new EmbedBuilder()
      .setTitle("🩸 FINAL TIEBREAKER VOTE 🩸")
      .setDescription(
        `Multiple players are tied.\n\n` +
        `Vote to determine their final ranking.\nAll may vote — the charm will sort the rest.\n\n` +
        tiedPlayers.map(p => `• ${p.username}`).join('\n')
      )
      .setColor(0xff0033);

    const voteMessage = await channel.send({
      embeds: [voteEmbed],
      components: [row]
    });

    const collector = voteMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 20000
    });

    collector.on('collect', async (interaction) => {
      if (votedUsers.has(interaction.user.id)) {
        await interaction.reply({ content: "You already voted!", flags: 64 });
        return;
      }

      const votedId = interaction.customId.split('_')[1];
      if (!voteCounts.has(votedId)) {
        await interaction.reply({ content: "Invalid vote!", flags: 64 });
        return;
      }

      voteCounts.set(votedId, voteCounts.get(votedId) + 1);
      votedUsers.add(interaction.user.id);
      await interaction.reply({ content: "Vote counted!", flags: 64 });
    });

    collector.on('end', async () => {
      const sortedTied = [...tiedPlayers].sort((a, b) => {
        const aVotes = voteCounts.get(a.id) || 0;
        const bVotes = voteCounts.get(b.id) || 0;
        return bVotes - aVotes;
      });

      await channel.send("🗳️ Tiebreaker vote complete. The charm has decided.");
      resolve(sortedTied);
    });
  });
}

async function showRematchButton(channel) {
  const rematchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch')
      .setLabel('🔁 Call for Rematch')
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({
    content: "Should we go again? Click below to signal your will.",
    components: [rematchRow]
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });
  let votes = 0;
  const votedUsers = new Set();

  collector.on('collect', async i => {
    if (!i.member || i.member.user.bot) return;
    if (votedUsers.has(i.user.id)) {
      return i.reply({ content: '🛑 You already voted!', flags: 64 });
    }

    votedUsers.add(i.user.id);
    votes++;
    await i.reply({ content: '🔁 Rematch vote counted!', flags: 64 });
  });

  collector.on('end', async () => {
    if (votes >= 3) {
      await channel.send('🧿 Enough voices call for more. The next Gauntlet awakens...');
      setTimeout(() => {
        channel.send('Use `!gauntlet 3` to begin again.');
      }, 2000);
    } else {
      await channel.send('⏳ The charm settles. Perhaps another time...');
    }
  });
}
client.on('messageCreate', async (message) => {
  if (message.content === '!points') {
    if (!activeGame || !activeGame.players) {
      return message.reply('⚠️ No Gauntlet is currently running.');
    }

    const player = activeGame.players.get(message.author.id);
    if (!player) {
      return message.reply('💀 You haven’t interacted this round.');
    }

    return message.reply(`📊 You currently have **${player.points}** point${player.points === 1 ? '' : 's'}.`);
  }

  if (message.content === '!leaderboard') {
    if (!activeGame || !activeGame.players) {
      return message.reply('⚠️ No Gauntlet is currently running.');
    }

    const sorted = [...activeGame.players.values()]
      .sort((a, b) => b.points - a.points)
      .slice(0, 15);

    const list = sorted.map((p, i) =>
      `**#${i + 1}** ${p.username} — **${p.points}** point${p.points === 1 ? '' : 's'}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Current Gauntlet Leaderboard')
      .setDescription(list || 'No players currently tracked.')
      .setColor(0x00ccff);

    message.channel.send({ embeds: [embed] });
  }
});
client.on('messageCreate', async (message) => {
  if (message.content === '!testgauntlet') {
    // Restrict to authorized users only
    if (!authorizedUsers.includes(message.author.id)) {
      return message.reply("⛔ Only authorized users can run test mode.");
    }

    // Ensure no other Gauntlet is running
    if (activeGame) {
      return message.reply('⛔ A Gauntlet is already in progress.');
    }

    // Create 10 mock players
    const mockPlayers = new Map();
    for (let i = 1; i <= 10; i++) {
      mockPlayers.set(`mock_${i}`, {
        id: `mock_${i}`,
        username: `MockPlayer${i}`,
        points: 0,
        isMock: true
      });
    }

    // Set global activeGame state
    activeGame = {
      players: mockPlayers,
      startTime: Date.now()
    };

    try {
      await message.channel.send('🧪 Starting **Test Gauntlet** with 10 mock players...');
      await runPointsGauntletSimulation(message.channel, mockPlayers);
    } catch (err) {
      console.error('❌ Error running test gauntlet:', err);
      await message.channel.send('❌ Failed to run test gauntlet.');
      activeGame = null;
    }
  }
});

// Simulation runner function
async function runPointsGauntletSimulation(channel, mockPlayers) {
  const playerMap = new Map(mockPlayers);
  let round = 1;
  const maxRounds = 10;

  while (round <= maxRounds) {
    const roundIntro = new EmbedBuilder()
      .setTitle(`🌪️ ROUND ${round}`)
      .setDescription(`🌀 *The charm stirs once more...*`)
      .setColor(0xaa00ff);

    await channel.send({ embeds: [roundIntro] });
    await wait(2000);

    // Mini-game simulation
    const outcomes = [1, 2, -1, -2].sort(() => 0.5 - Math.random());
    const buttons = ['A', 'B', 'C', 'D'];

    for (const player of playerMap.values()) {
      const randomIndex = Math.floor(Math.random() * 4);
      const result = outcomes[randomIndex];
      player.points += result;
    }

    await channel.send(`🎮 Mock players completed mini-game. Round ${round} points have been applied.`);
    await wait(2000);

    // Riddle simulation
    const riddlePool = riddles
      .map((r, i) => ({ ...r, index: i }))
      .filter(r => !usedRiddleIndices.has(r.index));

    const picked = riddlePool[Math.floor(Math.random() * riddlePool.length)];
    if (!picked) break;

    usedRiddleIndices.add(picked.index);
    const difficulty = picked.difficulty;

    // Simulate 40% of players getting it right
    const shuffledPlayers = [...playerMap.values()].sort(() => 0.5 - Math.random());
    const correctCount = Math.floor(playerMap.size * 0.4);
    for (let i = 0; i < correctCount; i++) {
      shuffledPlayers[i].points += difficulty;
    }

    await channel.send(`🧠 Riddle completed. ${correctCount} players answered correctly and gained +${difficulty} points.`);
    await wait(2000);

    round++;
  }

  // Final results
  await showFinalScores(playerMap, channel);
}
// === On Bot Ready ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Start Bot ===
client.login(TOKEN);
