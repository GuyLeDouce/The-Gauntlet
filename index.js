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
  Collection,
  ComponentType // ✅ Add this
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
let usedMiniGameIndices = new Set();


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
  "They say the ugliest Squig once survived this by sneezing.",
  "The floorboards are judging you. Quietly.",
  "None of these were tested. Proceed accordingly.",
  "A Squig once solved this blindfolded. Then got lost forever.",
  "Just pick what smells right. Trust your nose.",
  "Legends say the correct answer tastes like burnt syrup.",
  "This choice once decided a mayoral race in Uglytown.",
  "Worms know the answer. Unfortunately, they won’t say.",
  "History will not remember what you picked. But we will.",
  "One button leads to treasure. The others... paperwork.",
  "If you guess with confidence, it counts double. Psych.",
  "This scenario was predicted by a Squig horoscope in 1997.",
  "You had a dream about this once. Probably shouldn’t trust it.",
  "The correct answer was scratched into a bathroom stall.",
  "A toad guessed right last time. That toad is now a CEO.",
  "Try not to overthink it. That's how the fog gets in.",
  "This round is sponsored by nothing and regrets.",
  "Even the ugliest choice might be the right one.",
  "Your ancestors are watching. Some are laughing.",
  "Only fools rush in. Also, they win sometimes.",
  "A squig with a broken antenna won this round once. Barely.",
  "Nothing about this is fair. But it is fabulous.",
  "It’s not random. It’s just curated chaos.",
  "Whispers say the correct answer glows under moonlight.",
  "Someone flipped a coin for this once. The coin exploded.",
  "Do not trust anything that rhymes with ‘bingo’.",
  "This moment is 42% fate, 58% vibes.",
  "Your shadow just tried to warn you. Too late.",
  "Statistically speaking, someone is always wrong.",
  "The fourth option was banned in two dimensions. Not this one."
];


const pointFlavors = {
  "+2": [
    "✨ Bathed in the forbidden glow of a Squig lamp. **+2 points!**",
    "🧃 Drank something that blinked back. Felt stronger. **+2 points!**",
    "📜 Misread the prophecy but impressed the paper. **+2 points!**",
    "🐸 Kissed a Squig out of curiosity. Got rewarded. **+2 points!**",
    "🌀 Stared into the static void. It whispered 'nice'. **+2 points!**"
  ],
  "+1": [
    "🎈 Floated past danger like a confused balloon. **+1 point!**",
    "💡 Guessed wrong twice, then guessed right. **+1 point!**",
    "📦 Opened the least cursed option. Just barely. **+1 point!**",
    "🔮 Licked the charm instead of solving it. Unexpected success. **+1 point!**",
    "🎤 Answered with total confidence. It was even right. **+1 point!**"
  ],
  "-1": [
    "🍄 Stepped on a lore mushroom. Instant regret. **-1 point!**",
    "🧤 Chose the sticky button. Ew. **-1 point!**",
    "📺 Watched cursed SquigTV for too long. **-1 point!**",
    "🧻 Slipped on ceremonial toilet paper. **-1 point!**",
    "📉 Traded UglyBucks for SquigCoin. Market tanked. **-1 point!**"
  ],
  "-2": [
    "🥴 Called a Squig 'mid'. It hexed you. **-2 points!**",
    "🪦 Tripped over lore and landed in a portable grave. **-2 points!**",
    "🍖 Tried to eat the Monster’s leftovers. Got slapped. **-2 points!**",
    "🎭 Mocked the ritual with a sock puppet. It mocked back harder. **-2 points!**",
    "🪞 Challenged your reflection. Lost everything. **-2 points!**"
  ]
};

const riddles = [
  { riddle: "I tick but have no tock. What am I?", answers: ["watch"], difficulty: 1 },
  { riddle: "I’m written in ink but speak no words. What am I?", answers: ["book"], difficulty: 1 },
  { riddle: "You use me to write, then rub me out. What am I?", answers: ["pencil"], difficulty: 1 },
  { riddle: "I buzz but don’t fly. I connect calls but I’m not alive. What am I?", answers: ["phone"], difficulty: 1 },
  { riddle: "I store your thoughts but have no mind. What am I?", answers: ["notebook"], difficulty: 1 },
  { riddle: "I’m clear as day but can’t be seen at night. What am I?", answers: ["window"], difficulty: 1 },
  { riddle: "I glow but am not the sun. I help you read when the day is done. What am I?", answers: ["lamp"], difficulty: 1 },
  { riddle: "You sit on me but I have no legs. What am I?", answers: ["couch"], difficulty: 1 },
  { riddle: "I stretch but never tear. You wear me everywhere. What am I?", answers: ["shirt"], difficulty: 1 },
  { riddle: "I’m soft, warm, and full of dreams. What am I?", answers: ["bed"], difficulty: 1 },
  { riddle: "I move without legs. I rumble, then stop. I often carry a crowd. What am I?", answers: ["train"], difficulty: 2 },
  { riddle: "I have stripes but no colors. I guide your feet but never move. What am I?", answers: ["crosswalk"], difficulty: 2 },
  { riddle: "I spin tales but I’m no liar. I weave webs with threads much finer. What am I?", answers: ["spider"], difficulty: 2 },
  { riddle: "I’m the start of everything and the end of nothing. What letter am I?", answers: ["e"], difficulty: 2 },
  { riddle: "I stay in one spot but travel the world. What am I?", answers: ["postcard"], difficulty: 2 },
  { riddle: "I go up dirty and come down clean. What am I?", answers: ["elevator"], difficulty: 2 },
  { riddle: "I’m full of gas but not a balloon. I drive without legs. What am I?", answers: ["car"], difficulty: 2 },
  { riddle: "You can hear me, but never see me. I exist only when others speak. What am I?", answers: ["voice"], difficulty: 2 },
  { riddle: "I hold time but I’m not alive. I’m worn but not torn. What am I?", answers: ["watch"], difficulty: 2 },
  { riddle: "I live in the corner but travel the web. What am I?", answers: ["router"], difficulty: 2 },
  { riddle: "I lie in the earth, yet I move cities. I sleep for centuries, then roar in flame. What am I?", answers: ["volcano"], difficulty: 3 },
  { riddle: "I have no form, no weight, no smell, yet I’m feared in every spell. What am I?", answers: ["curse"], difficulty: 3 },
  { riddle: "I leave no footprints but I can drown. I arrive in silence, then crush towns. What am I?", answers: ["fog"], difficulty: 3 },
  { riddle: "The more you know me, the less I exist. What am I?", answers: ["mystery"], difficulty: 3 },
  { riddle: "I vanish if you name me. What am I?", answers: ["silence"], difficulty: 3 },
  { riddle: "I’m always on your back but never complain. I disappear when you stand still. What am I?", answers: ["burden"], difficulty: 3 },
  { riddle: "I can’t be touched, but I can be broken. I bind and divide. What am I?", answers: ["trust"], difficulty: 3 },
  { riddle: "I grow without rain, bloom without sun, and disappear without warning. What am I?", answers: ["mold"], difficulty: 3 },
  { riddle: "You carry me for life, but I weigh nothing. What am I?", answers: ["name"], difficulty: 3 },
  { riddle: "I see everything but remain unseen. I reflect what you won’t admit. What am I?", answers: ["mirror"], difficulty: 3 }
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
let bonusSpinUsed = false;


while (round <= maxRounds) {
  let availableMiniGames = miniGameLorePool
  .map((g, i) => ({ ...g, index: i }))
  .filter(g => !usedMiniGameIndices.has(g.index));

if (availableMiniGames.length === 0) {
  usedMiniGameIndices.clear(); // reset if all have been used
  availableMiniGames = miniGameLorePool.map((g, i) => ({ ...g, index: i }));
}

const selectedMiniGame = availableMiniGames[Math.floor(Math.random() * availableMiniGames.length)];
usedMiniGameIndices.add(selectedMiniGame.index);
const miniGame = selectedMiniGame;

  const flavor = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];

  // === Unified Round Intro + Mini-Game ===
  const embed = new EmbedBuilder()
    .setTitle(`🌪️ ROUND ${round} — ${miniGame.title}`)
    .setDescription(`${miniGame.lore}\n\n_${flavor}_\n\n⏳ You have 30 seconds to decide.`)
    .setImage(getUglyImageUrl())
    .setColor(0xff33cc);

  const row = new ActionRowBuilder().addComponents(
    miniGame.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`choice${idx + 1}`)
        .setLabel(label)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][idx % 4])
    )
  );

  await channel.send({ embeds: [embed], components: [row] });

  setTimeout(() => channel.send("⏳ 20 seconds left...").catch(() => {}), 10000);
  setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 20000);
  setTimeout(() => channel.send("🎲 Time’s up. The charm decides.").catch(() => {}), 30000);

  const collector = channel.createMessageComponentCollector({ componentType: 2, time: 30000 });
  const clickedUsers = new Set();

  collector.on('collect', async i => {
    if (i.user.bot || clickedUsers.has(i.user.id)) return;
    clickedUsers.add(i.user.id);

    if (!playerMap.has(i.user.id)) {
      playerMap.set(i.user.id, {
        id: i.user.id,
        username: i.user.username,
        points: 0
      });
    }

    const outcomes = [-2, -1, 1, 2];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    playerMap.get(i.user.id).points += result;

    const flavorList = pointFlavors[result > 0 ? `+${result}` : `${result}`] || [];
    const flavorText = flavorList.length ? flavorList[Math.floor(Math.random() * flavorList.length)] : "";

    try {
      await i.reply({
        content: `You chose **${i.component.label}**\nYour fate: **${result > 0 ? '+' : ''}${result} point${Math.abs(result) !== 1 ? 's' : ''}**\n${flavorText}`,
        flags: 64
      });
    } catch (err) {
      console.warn(`⚠️ Failed to reply to interaction: ${err.message}`);
    }
  });

  await wait(30000);
  collector.stop();

  await channel.send(`🧮 Mini-game complete. Round ${round} points have been applied.`);
  await wait(5000);

  // === Riddle Phase ===
  await runRiddlePoints(playerMap, channel);
  await wait(5000);

    round++;

  if (round === 7) {
    await channel.send({
      content: "⛔ **THE GAUNTLET PAUSES** ⛔",
      embeds: [
        new EmbedBuilder()
          .setTitle("🌪️ MID-GAME INTERRUPTION")
          .setDescription("The static thickens...\nSomething hideous stirs...\n\nPrepare yourselves. **The Ugly Selector is awakening.**")
          .setColor(0xff00cc)
          .setImage(getMonsterImageUrl())
      ]
    });
    await wait(3000);
    await runUglySelector(channel, playerMap);
    await wait(3000);
    await channel.send("🎭 The charm returns to its chaotic rhythm...");
    await wait(3000);
  }

// === BONUS RNG SPIN EVENT ===
// === RUN UGLY SELECTOR ===
async function runUglySelector(channel, playerMap) {
  const embed = new EmbedBuilder()
    .setTitle("🎯 The Squig’s Ugly Selector Activates!")
    .setDescription("React with 🌀 within **15 seconds** to tempt fate.\nOne lucky participant will be granted **+3 bonus points** by pure Squig chaos.")
    .setColor(0xff77ff);

  const msg = await channel.send({ embeds: [embed] });
  await msg.react("🌀");

  const filter = (reaction, user) => reaction.emoji.name === "🌀" && !user.bot;
  const reactionCollector = msg.createReactionCollector({ filter, time: 15000 });

  const users = new Set();
  reactionCollector.on('collect', (reaction, user) => {
    users.add(user.id);
  });

  return new Promise((resolve) => {
    reactionCollector.on('end', async () => {
      if (users.size === 0) {
        await channel.send("🌀 No one dared tempt fate. The charm spins alone...");
        return resolve();
      }

      const userIdArray = Array.from(users);
      const winnerId = userIdArray[Math.floor(Math.random() * userIdArray.length)];

      if (!playerMap.has(winnerId)) {
        playerMap.set(winnerId, {
          id: winnerId,
          username: "Unknown",
          points: 0
        });
      }

      playerMap.get(winnerId).points += 3;

      await channel.send(`🎉 The Squig’s Ugly Selector has spoken... <@${winnerId}> gains **+3 bonus points!**\n_The static fizzles and the charm forgets what it just did._`);
      resolve();
    });
  });
}
 }
  await showFinalScores(playerMap, channel);
}
async function runMiniGamePoints(players, channel, round, isTestMode = false) {
  const outcomes = [-2, -1, 1, 2];
  const miniGame = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
  const flavor = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];

  // === ROUND ANNOUNCEMENT WITH FLAVOR ===
  const roundIntro = new EmbedBuilder()
    .setTitle(`🌪️ ROUND ${round} — ${miniGame.title}`)
    .setDescription(`${miniGame.lore}\n\n${flavor}`)
    .setColor(0xaa00ff);

  await channel.send({ embeds: [roundIntro] });
  await wait(5000); // give time to read lore

  // === MINI-GAME CHALLENGE EMBED ===
  const challengeEmbed = new EmbedBuilder()
    .setTitle(`🎲 MINI-GAME CHALLENGE — ${miniGame.title}`)
    .setDescription(`${miniGame.lore}\n⏳ You have 30 seconds to decide.`)
    .setColor(0xff33cc);

  const row = new ActionRowBuilder().addComponents(
    miniGame.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`choice${idx + 1}`)
        .setLabel(label)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][idx % 4])
    )
  );

  await channel.send({ embeds: [challengeEmbed], components: [row] });

  // Timed alerts
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

    try {
      await i.reply({
        content: `You chose **${i.component.label}**\nYour fate: **${outcome > 0 ? '+' : ''}${outcome} point${Math.abs(outcome) !== 1 ? 's' : ''}**`,
        flags: 64
      });
    } catch (err) {
      console.warn(`⚠️ Failed to reply to interaction: ${err.message}`);
    }
  });

  // Ensure we wait out the full window
  await wait(31000); // full 30 sec + 1s buffer to avoid overlap

  if (isTestMode) {
    for (const player of players.values()) {
      if (player.isMock) {
        const result = outcomes[Math.floor(Math.random() * outcomes.length)];
        player.points += result;
      }
    }
  }

  await channel.send(`🧮 Mini-game complete. Round ${round} points have been applied.`);
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
  const difficulties = [1, 2, 3];
  const chosenDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
  const pointsForCorrect = chosenDifficulty;

  const availableRiddles = riddles
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => r.difficulty === chosenDifficulty && !usedRiddleIndices.has(r.index));

  if (availableRiddles.length === 0) {
    await channel.send(`⚠️ No unused riddles available for difficulty level: ${chosenDifficulty}. Skipping riddle...`);
    return;
  }

  const riddle = availableRiddles[Math.floor(Math.random() * availableRiddles.length)];
  usedRiddleIndices.add(riddle.index);

  const difficultyLabel = chosenDifficulty === 1 ? "EASY" : chosenDifficulty === 2 ? "MEDIUM" : "HARD";

  const embed = new EmbedBuilder()
    .setTitle("🧠 RIDDLE CHALLENGE")
    .setDescription(
      `_${riddle.riddle}_\n\n🌀 Difficulty: **${difficultyLabel}** — Worth **+${pointsForCorrect}** point${pointsForCorrect > 1 ? 's' : ''}.\n⏳ You have 30 seconds to decide your fate...`
    )
    .setColor(0xff66cc);

  await channel.send({ embeds: [embed] });

  return new Promise(resolve => {
    const correctPlayers = [];
    const filter = m => !m.author.bot;
    const collector = channel.createMessageCollector({ filter, time: 30000 });

    collector.on('collect', async message => {
      const playerId = message.author.id;
      const answer = message.content.trim().toLowerCase();
      const isCorrect = riddle.answers.map(a => a.toLowerCase()).includes(answer);

      if (!players.has(playerId)) {
        players.set(playerId, {
          id: playerId,
          username: message.author.username,
          points: 0,
          isMock: false,
        });
      }

      if (isCorrect && !correctPlayers.includes(playerId)) {
        correctPlayers.push(playerId);
        players.get(playerId).points += pointsForCorrect;

        try {
          await message.delete();
        } catch (err) {
          console.warn(`⚠️ Could not delete correct message: ${err.message}`);
        }

        await channel.send(`🧠 <@${playerId}> answered correctly and gained **+${pointsForCorrect}** point${pointsForCorrect > 1 ? 's' : ''}!`);
      } else {
        try {
          await message.react('❌');
        } catch (err) {
          console.warn(`⚠️ Failed to react to incorrect guess: ${err.message}`);
        }
      }
    });

    setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 20000);
    setTimeout(() => channel.send("⏰ Time’s almost up!").catch(() => {}), 29000);

    collector.on('end', () => {
      const answerText = riddle.answers[0];
      channel.send(
        `✅ Riddle completed. ${correctPlayers.length} player(s) answered correctly and gained +${pointsForCorrect} point${pointsForCorrect > 1 ? 's' : ''}.\n🧩 The correct answer was: **${answerText}**.`
      ).catch(() => {});
      resolve();
    });
  });
}



async function showFinalScores(playerMap, channel) {
  const players = [...playerMap.values()];

  if (players.length === 0) {
    await channel.send('⚠️ No players to score. The charm is confused.');
    activeGame = null;
    usedMiniGameIndices.clear();
    return;
  }

  const sorted = players.sort((a, b) => b.points - a.points);
  const top3 = sorted.slice(0, 3);
  const topScore = top3[0].points;

  const tiedTopScorers = sorted.filter(p => p.points === topScore);

  if (tiedTopScorers.length > 1) {
    await channel.send('⚖️ There is a tie among the top scorers. The charm demands a vote to break it.');
    
    const resolvedTiebreaker = await runPointTiebreaker(tiedTopScorers, channel);

    // Merge resolved tie order with the rest of the players
    const remaining = sorted.filter(p => !tiedTopScorers.find(tp => tp.id === p.id));
    const finalOrderedPlayers = [...resolvedTiebreaker, ...remaining];

    await showFinalPodium(channel, finalOrderedPlayers);
  } else {
    await showFinalPodium(channel, sorted);
  }

  await wait(5000);
  activeGame = null;
  usedMiniGameIndices.clear();
  rematchCount++;

  if (rematchCount < maxRematches) {
    await channel.send(`📯 *Maybe enough reactions will encourage another game 👀*`);
    await wait(2000);
  }
}



async function showFinalPodium(channel, players) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  let top3 = sorted.slice(0, 3);

  const medals = ['👑🥇', '🩸🥈', '💀🥉'];
  const titles = [
    "⚔️ **Champion of the Charm** ⚔️",
    "🌑 **Scarred But Standing** 🌑",
    "🕳️ **Last One Dragged from the Void** 🕳️"
  ];

  const totalParticipants = players.length;

  const podiumEmbed = new EmbedBuilder()
    .setTitle("👁‍🗨️ THE FINAL PODIUM 👁‍🗨️")
    .setDescription(
      `The charm acknowledges those who rose above...\n` +
      `👥 **${totalParticipants} player${totalParticipants === 1 ? '' : 's'}** participated in this Gauntlet.`
    )
    .setColor(0xaa00ff);

  // Handle 2nd/3rd place ties (excluding 1st place)
  const firstPlacePoints = top3[0].points;
  const secondAndThird = top3.slice(1);
  const tiePoints = secondAndThird[0]?.points;
  const tiedForSecond = secondAndThird.filter(p => p.points === tiePoints);

  if (tiedForSecond.length > 1) {
    const resolved = await runTiebreaker(tiedForSecond, channel);
    top3 = [top3[0], ...resolved]; // Keep 1st, replace rest
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

  if (message.content === '!lb') {
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
if (message.content === '!info') {
  const infoEmbed = new EmbedBuilder()
    .setTitle("📖 Welcome to The Gauntlet")
    .setDescription(
      "**The Gauntlet** is a 10-round Discord mini-game of chaos, riddles, and unpredictable rewards.\n\n" +
      "**🔹 How it works:**\n" +
      "• Each round includes a **mini-game** (random button choice) and a **riddle** challenge.\n" +
      "• Mini-games are luck-based and reward or subtract points based on your fate.\n" +
      "• Riddles test your brain — answer correctly for bonus points.\n" +
      "• Watch for mid-game bonus events like the Charm's Bonus Wheel — react quickly to win extra points!\n" +
      "• The goal is to earn the most points by the end. Top 3 are crowned in the Final Podium.\n\n" +
      "**🎮 Game Commands:**\n" +
      "`!points` — Check your current points during a game\n" +
      "`!leaderboard` — View the top players in the current game\n" +
      "`!info` — Shows this help message\n\n" +
      "_Watch for chaos rounds, bonus events, and lore surprises. The charm is always watching._"
    )
    .setColor(0x00ccff);

  await message.channel.send({ embeds: [infoEmbed] });
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
  const playerMap = new Map(mockPlayers.map(p => [p.id, { ...p }])); // Deep clone to avoid mutation
  let round = 1;
let bonusSpinUsed = false;
  const maxRounds = 10;
  const usedIndices = new Set();

  while (round <= maxRounds) {
    // === ROUND INTRO ===
    const roundIntro = new EmbedBuilder()
      .setTitle(`🌪️ ROUND ${round}`)
      .setDescription(`🌀 *The charm stirs once more...*`)
      .setColor(0xaa00ff);
    await channel.send({ embeds: [roundIntro] });
    await wait(2000);

    // === MINI-GAME SIMULATION ===
    const outcomes = [1, 2, -1, -2].sort(() => 0.5 - Math.random());
    for (const player of playerMap.values()) {
      const result = outcomes[Math.floor(Math.random() * outcomes.length)];
      player.points += result;
    }
    await channel.send(`🎮 Mock players completed mini-game. Round ${round} points have been applied.`);
    await wait(2000);

    // === RIDDLE SIMULATION ===
    const availableRiddles = riddles
      .map((r, i) => ({ ...r, index: i }))
      .filter(r => !usedIndices.has(r.index));

    if (availableRiddles.length === 0) {
      await channel.send(`⚠️ No more riddles available. Ending early.`);
      break;
    }

    const picked = availableRiddles[Math.floor(Math.random() * availableRiddles.length)];
    usedIndices.add(picked.index);

    const difficulty = picked.difficulty || 1;
    const difficultyLabel = difficulty === 1 ? "EASY" : difficulty === 2 ? "MEDIUM" : "HARD";

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧠 RIDDLE CHALLENGE")
          .setDescription(`_${picked.riddle}_\n\n🌀 Difficulty: **${difficultyLabel}** — Worth **+${difficulty}** point${difficulty > 1 ? 's' : ''}.`)
          .setColor(0xff66cc)
      ]
    });

    const shuffled = [...playerMap.values()].sort(() => 0.5 - Math.random());
    const correctCount = Math.floor(playerMap.size * 0.4);
    for (let i = 0; i < correctCount; i++) {
      shuffled[i].points += difficulty;
    }

    await wait(1000);
    await channel.send(`✅ ${correctCount} players got it right and gained **+${difficulty}** point${difficulty > 1 ? 's' : ''}.`);
    await wait(2000);

    round++;
  }

  // === FINAL SCORING ===
  await showFinalScores(playerMap, channel);
}

// === On Bot Ready ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Start Bot ===
client.login(TOKEN);
