// === GAUNTLET: SHORTER ROUNDS EDITION (MiniGames + Labyrinth + RiskIt) ===
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
  ComponentType,
  InteractionCollector
} = require('discord.js');

const { randomUUID } = require('crypto');

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
    title: "🎁 Chamber of the Ugly",
    lore: "A Squig leads you into a crumbling cavern deep beneath the old arcade. Four boxes glow under flickering slime lights. One holds a blessing. One holds a trap. The others? Maybe a snack. Maybe a scream. You must choose. The Squig is already giggling.",
    buttons: ["Box A", "Box B", "Box C", "Box D"],
    image: "https://i.imgur.com/7G2PMce.png"
  },
  {
    title: "🍕 Feast of Regret",
    lore: "Inside a crooked Squig diner with flickering lights and a suspicious chef, you’re handed a tray of “snacks.” One bite might grant vision. Another might cause a week-long nap. The rest? Unknown. The menu was written in crayon and some kind of fluid. Choose carefully.",
    buttons: ["Cold Pizza", "Weird Burrito", "Melted Ice Cream", "Mystery Meat"],
    image: "https://i.imgur.com/3nzMYZp.jpeg"
  },
  {
    title: "🛏️ Inception? Never Heard of Her",
    lore: "You’ve drifted off in a Squig nap pod. Suddenly, dreams begin to drift around your head like lazy jellyfish. One is lovely. One is loud. One is endless stairs. One is just static and screaming. The Squig monitoring your vitals is snoring louder than you are. Choose a dream.",
    buttons: ["Flying Dream", "Falling Dream", "Late-for-Class Dream", "Totally Blank Dream"],
    image: "https://i.imgur.com/eTJISg9.jpeg"
  },
  {
    title: "🥄 The Soup of Uncertainty",
    lore: "A Squig invites you to sit at a crooked wooden table. Four steaming bowls sit before you, each with a smell you can’t quite place. One glows faintly. One has bubbles that form tiny faces. One makes your teeth feel cold just looking at it. The last… looks normal. Which is the most dangerous of all.",
    buttons: ["Glowing Bowl", "Face Bubbles", "Cold Teeth", "Normal Soup"],
    image: "https://i.imgur.com/FNYqXHz.jpeg"
  },
  {
    title: "🧳 Luggage Claim of the Damned",
    lore: "You stand at a slow-moving carousel in a dim, echoing room. Four strange suitcases pass by. One drips water. One hums softly. One is breathing. One is perfectly still, which somehow feels worse. The Squig at your side whispers, 'One of these is yours now.'",
    buttons: ["Dripping Case", "Humming Case", "Breathing Case", "Still Case"],
    image: "https://i.imgur.com/UsrlWEx.jpeg"
  },
  {
    title: "🧼 Clean or Cursed?",
    lore: "The Squigs don’t really understand hygiene, but they’re trying. You’re shown four soaps on a stone plinth. One cured a rash that never existed. One dissolved a hand. One smells like trauma. The last might be fruit-scented? A Squig proudly says, We made them ourselves.",
    buttons: ["Lemon Fresh", "Minty One", "Sketchy Bar", "Unknown Goo"],
    image: "https://i.imgur.com/1J8oNW4.png"
  },
  {
    title: "🚪 Ugly Door Policy",
    lore: "A Squig stands beside four doors. “Only one leads to safety,” they whisper. Another leads to a hallway of teeth. One just loops forever. The last is… moist? You won’t know until you open one. The Squig won’t make eye contact. The doors hum. Choose wrong, and you’re furniture now.",
    buttons: ["Red Door", "Blue Door", "Green Door", "Wiggly Door"],
    image: "https://i.imgur.com/utSECnX.jpeg"
  },
  {
    title: "🌌 The Archive of Forgotten Things",
    lore: "Deep inside the Squigs’ oldest vault, shelves stretch into darkness, each piled with objects that never belonged to this world. A Squig librarian shuffles beside you, its lantern casting warped shadows. Four artifacts are placed on a cracked marble table: a jar of unmoving smoke, a coin that hums like bees, a mask with too many straps, and a small cube that’s warm in your hand. The Squig leans close: 'Choose carefully — these remember their last owners.'",
    buttons: ["Smoke Jar", "Humming Coin", "Strap Mask", "Warm Cube"],
    image: "https://i.imgur.com/35OO8T1.jpeg"
  },
  {
    title: "📺 SquigVision™ Live",
    lore: "You grab the remote. The screen flashes violently. Each channel is broadcasting something — a bubbling stew of eyeballs, a Category 9 wind warning in space, a haunted cartoon rerun, and one is just... static, but it feels like it’s watching you. The Squig says, “Pick fast. It gets worse.”",
    buttons: ["Cooking Show", "Weather Alert", "Cartoon Hour", "Static"],
    image: "https://i.imgur.com/I2QB6Ls.png"
  },
  {
    title: "🎨 Gallery of Regret",
    lore: "Four Squigs submitted artwork to the Ugly Labs gallery. One piece is pure genius. Another caused a nosebleed in five viewers. One might be a summoning circle. The last… we don’t talk about the last. Pick your favorite. The Squigs are watching. Closely.",
    buttons: ["Squig A", "Squig B", "Squig C", "Squig D"],
    image: "https://i.imgur.com/HdQtSol.jpeg"
  },
  {
    title: "🔮 Charm Coin Flip",
    lore: "Every Squig carries a Charm Coin — not for luck, but because sometimes reality needs a decision. One of these coins knows your fate. One lies. One screams. One is still warm. You’re told to flip one. No one tells you why. The room starts humming.",
    buttons: ["Truth Coin", "Liar Coin", "Screaming Coin", "Still Warm"],
    image: "https://i.imgur.com/7IoCjbB.jpeg"
  },
  {
    title: "🧃 Pick Your Potion",
    lore: "A Squig offers you a tray of bubbling concoctions. “Each one changes something,” they say, avoiding eye contact. One makes your thoughts louder. One makes you see sounds. One makes your past self allergic to soup. One makes nothing happen — which is the most suspicious of all.",
    buttons: ["Blue Bubbler", "Echo Juice", "Time Syrup", "Definitely Nothing"],
    image: "https://i.imgur.com/23BxgsM.jpeg"
  },
  {
    title: "🪑 The Seat of Consequence",
    lore: "You enter a room with four chairs. One hums softly. One smells like ozone and regret. One has teeth marks. One is already warm, but no one’s here. A Squig gestures politely: “Sit wherever you feel… least endangered.” The lights flicker. Something growls under the floor.",
    buttons: ["Wobbly Chair", "Warm Chair", "Gnawed Chair", "Humming Chair"],
    image: "https://i.imgur.com/hHVScHi.jpeg"
  },
  {
    title: "🪞 Reflections That Aren’t",
    lore: "You step into a dusty hall lined with warped mirrors. A Squig stands behind you, but in the glass, it’s wearing your face. Each mirror shows a different version of you — taller, shorter, missing, or… smiling too wide. The Squig taps the glass and says, 'Pick one. Quickly.'",
    buttons: ["Tall You", "Small You", "No You", "Too Many Teeth"],
    image: "https://i.imgur.com/xc6aIXP.jpeg"
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
// === Riddles ===
const riddles = [
  // EASY (1)
  { riddle: "I have keys but no locks, a space but no room, and you can enter but not go inside. What am I?", answers: ["keyboard"], difficulty: 1 },
  { riddle: "I have rings and grow in forests. What am I?", answers: ["tree"], difficulty: 1 },
  { riddle: "I answer by repeating you, but I never speak first. What am I?", answers: ["echo"], difficulty: 1 },
  { riddle: "You can hold me without touching me. Let me go and I return on my own. What am I?", answers: ["breath"], difficulty: 1 },
  { riddle: "I show you yourself but I’m not a photo. What am I?", answers: ["mirror"], difficulty: 1 },
  { riddle: "I drink what you pour, then give it back when I’m squeezed. What am I?", answers: ["sponge"], difficulty: 1 },
  { riddle: "I have roads and borders but no cars or people. What am I?", answers: ["map"], difficulty: 1 },
  { riddle: "I melt in warmth and harden in cold, and I float when I’m solid. What am I?", answers: ["ice"], difficulty: 1 },
  { riddle: "I rest your head but never sleep. What am I?", answers: ["pillow"], difficulty: 1 },
  { riddle: "I have teeth but never eat. What am I?", answers: ["comb"], difficulty: 1 },
  { riddle: "I have steps but no legs, and I help you change floors. What am I?", answers: ["staircase", "stairs"], difficulty: 1 },
  { riddle: "I appear after rain and fade in bright light. What am I?", answers: ["rainbow"], difficulty: 1 },
  { riddle: "Seal me with a lick and send me away. What am I?", answers: ["envelope"], difficulty: 1 },
  { riddle: "I cross water without getting wet. What am I?", answers: ["bridge"], difficulty: 1 },
  { riddle: "I change the channel but never watch. What am I?", answers: ["remote", "remote control"], difficulty: 1 },
  { riddle: "I move up and down all day but never walk. What am I?", answers: ["elevator", "lift"], difficulty: 1 },
  { riddle: "I go up when the rain comes down. What am I?", answers: ["umbrella"], difficulty: 1 },
  { riddle: "I have a neck and a spout, and I pour without a mouth. What am I?", answers: ["teapot", "kettle", "beer"], difficulty: 1 },
  { riddle: "I can be cracked, made, told, and played. What am I?", answers: ["joke"], difficulty: 1 },

  // MEDIUM (2)
  { riddle: "I fly without wings and cry without eyes. What am I?", answers: ["cloud"], difficulty: 2 },
  { riddle: "I’m often answered but never ask a question. What am I?", answers: ["phone", "telephone"], difficulty: 2 },
  { riddle: "I run through cities and fields but never move. What am I?", answers: ["road"], difficulty: 2 },
  { riddle: "I grow without being watered, and I shrink when you wash me. What am I?", answers: ["stain"], difficulty: 2 },
  { riddle: "I am full of holes and still hold water. What am I?", answers: ["sponge"], difficulty: 2 },
  { riddle: "I have a bed but never sleep and a mouth but never eat. What am I?", answers: ["river"], difficulty: 2 },
  { riddle: "I have a head and a tail but no body. What am I?", answers: ["coin"], difficulty: 2 },
  { riddle: "I cut through paper but I’m not sharp without my twin. What am I?", answers: ["scissors"], difficulty: 2 },
  { riddle: "I’m taken before you see me and kept to remember you saw me. What am I?", answers: ["photo", "photograph", "picture"], difficulty: 2 },
  { riddle: "I vanish when you know me. What am I?", answers: ["surprise"], difficulty: 2 },
  { riddle: "I’m carried by the smallest breeze but can pull down the tallest tree. What am I?", answers: ["firestorm", "wildfire", "fire"], difficulty: 2 },
  { riddle: "I’m bought for eating but never eaten. What am I?", answers: ["plate", "dishes"], difficulty: 2 },
  { riddle: "I go in dry and come out wet, and the longer I’m in, the stronger I get. What am I?", answers: ["tea bag", "teabag", "tea"], difficulty: 2 },
  { riddle: "I’m a 'room' you can't enter. What am I?", answers: ["mushroom"], difficulty: 2 },
  { riddle: "You can throw me away, but you will never lose me. What am I?", answers: ["trash", "rubbish", "garbage"], difficulty: 2 },

  // HARD (3)
  { riddle: "I begin where knowledge ends and end where knowledge begins. What am I?", answers: ["ignorance"], difficulty: 3 },
  { riddle: "I exist when believed and vanish when proven. What am I?", answers: ["myth"], difficulty: 3 },
  { riddle: "I bind kings and beggars alike, yet I am only words. What am I?", answers: ["oath", "promise"], difficulty: 3 },
  { riddle: "I am the first step of every journey but never leave the ground. What am I?", answers: ["decision", "choice"], difficulty: 3 },
  { riddle: "I am earned by doubt and lost by certainty. What am I?", answers: ["curiosity"], difficulty: 3 },
  { riddle: "I’m a question that survives every answer. What am I?", answers: ["why"], difficulty: 3 },
  { riddle: "I make the tallest walls invisible. What am I?", answers: ["perspective"], difficulty: 3 },
  { riddle: "I am the weight carried by those who cannot forget. What am I?", answers: ["guilt", "regret"], difficulty: 3 },
  { riddle: "I am the only battle you lose by refusing to fight. What am I?", answers: ["change"], difficulty: 3 },
  { riddle: "I am the distance between what you said and what I heard. What am I?", answers: ["misunderstanding"], difficulty: 3 },
  { riddle: "I vanish the moment I arrive. What am I?", answers: ["future", "tomorrow"], difficulty: 3 },
  { riddle: "I am the echo of choices you didn’t make. What am I?", answers: ["regret"], difficulty: 3 },
  { riddle: "I begin with hope and end with proof. What am I?", answers: ["experiment"], difficulty: 3 },
  { riddle: "I am the step between thought and action where time passes by. What am I?", answers: ["hesitation"], difficulty: 3 },

  // === Squig Special (4 points) ===
  { riddle: "A Squig signs its name with a smear. What color is the smear on a lucky day?", answers: ["pink", "green", "ugly"], difficulty: 4 },
  { riddle: "The portal hiccups at lunch. Which snack calms it down?", answers: ["pickle", "ugly"], difficulty: 4 },
  { riddle: "A Squig collects useless trophies. Which one is the champion?", answers: ["spoon", "ugly"], difficulty: 4 },
  { riddle: "The charm asks for weather. What forecast makes Squigs cheer?", answers: ["fog", "rain"], difficulty: 4 },
  { riddle: "When a Squig tells a secret, what part squeaks?", answers: ["nose"], difficulty: 4 },
  { riddle: "A vending machine in Ugly Labs only dispenses one thing that isn’t food. What is it?", answers: ["charm"], difficulty: 4 },
  { riddle: "On Tuesdays, Squigs write poems to an object. Which one?", answers: ["portal", "uglypot"], difficulty: 4 },
  { riddle: "Gravity misbehaves in the lab. Which fruit do Squigs blame?", answers: ["banana", "tomato"], difficulty: 4 },
  { riddle: "The intercom crackles to life. What single word makes every Squig salute?", answers: ["ugly"], difficulty: 4 },
];


// === Command to start Gauntlet ===
client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!gauntlet')) return;

  if (!authorizedUsers.includes(message.author.id)) {
    return message.reply("⛔ Only authorized users can start the Gauntlet.");
  }
  if (activeGame) {
    return message.reply('⚠️ A Gauntlet is already running!');
  }

  const minutes = parseFloat(message.content.split(' ')[1]) || 2;
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
    await runPointsGauntlet_ShortFlow(message.channel); // new flow
  }, msUntilStart);
});

// === Helper: ensure player exists ===
function ensurePlayer(user, playerMap) {
  if (!playerMap.has(user.id)) {
    playerMap.set(user.id, { id: user.id, username: user.username || "Player", points: 0 });
  }
  return playerMap.get(user.id);
}
// =======================
// 🧩 Riddles (points = difficulty)
// =======================
async function runRiddlePoints(players, channel) {
  const difficulties = [1, 2, 3, 4]; // now includes Squig specials
  const chosenDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
  const pointsForCorrect = chosenDifficulty;

  const availableRiddles = riddles
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => r.difficulty === chosenDifficulty && !usedRiddleIndices.has(r.index));

  if (availableRiddles.length === 0) {
    // If no riddles left at this difficulty, broaden search
    const anyAvailable = riddles
      .map((r, i) => ({ ...r, index: i }))
      .filter(r => !usedRiddleIndices.has(r.index));
    if (anyAvailable.length === 0) {
      await channel.send(`⚠️ No unused riddles remain. Skipping riddle...`);
      return;
    }
    const r = anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
    usedRiddleIndices.add(r.index);
    return await presentRiddle(players, channel, r, r.difficulty || 1);
  }

  const riddle = availableRiddles[Math.floor(Math.random() * availableRiddles.length)];
  usedRiddleIndices.add(riddle.index);

  await presentRiddle(players, channel, riddle, pointsForCorrect);
}

async function presentRiddle(players, channel, riddle, points) {
  const difficultyLabel =
    points === 1 ? "EASY" :
    points === 2 ? "MEDIUM" :
    points === 3 ? "HARD" :
    points === 4 ? "SQUIG SPECIAL" :
    "UNKNOWN";

  const embed = new EmbedBuilder()
    .setTitle("🧠 MID-ROUND RIDDLE")
    .setDescription(
      `_${riddle.riddle}_\n\n` +
      `🌀 Difficulty: **${difficultyLabel}** — Worth **+${points}** point${points > 1 ? 's' : ''}.\n` +
      `⏳ You have 30 seconds to decide your fate...`
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
        players.get(playerId).points += points;

        try { await message.delete(); } catch {}
        await channel.send(`🧠 <@${playerId}> answered correctly and gained **+${points}** point${points > 1 ? 's' : ''}!`);
      } else {
        try { await message.react('❌'); } catch {}
      }
    });

    setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 20000);
    setTimeout(() => channel.send("⏰ Time’s almost up!").catch(() => {}), 29000);

    collector.on('end', () => {
      const answerText = riddle.answers[0];
      channel.send(
        `✅ Riddle completed. ${correctPlayers.length} player(s) answered correctly and gained +${points} point${points > 1 ? 's' : ''}.\n` +
        `🧩 The correct answer was: **${answerText}**.`
      ).catch(() => {});
      resolve();
    });
  });
}


// =======================
// 🎮 Mini-Game (30s, ±2/±1)
// =======================
async function runMiniGamePoints(players, channel, roundLabel = "") {
  const outcomes = [-2, -1, 1, 2];

  // pick unique mini-game until all used
  let availableMiniGames = miniGameLorePool
    .map((g, i) => ({ ...g, index: i }))
    .filter(g => !usedMiniGameIndices.has(g.index));
  if (availableMiniGames.length === 0) {
    usedMiniGameIndices.clear();
    availableMiniGames = miniGameLorePool.map((g, i) => ({ ...g, index: i }));
  }
  const selected = availableMiniGames[Math.floor(Math.random() * availableMiniGames.length)];
  usedMiniGameIndices.add(selected.index);

  const flavor = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];

  const challengeEmbed = new EmbedBuilder()
    .setTitle(`${roundLabel ? `🌪️ ${roundLabel} — ` : ''}${selected.title}`)
    .setDescription(`${selected.lore}\n\n_${flavor}_\n\n⏳ You have **30 seconds** to decide.`)
    .setColor(0xff33cc);

  if (selected.image) challengeEmbed.setImage(selected.image);

  const row = new ActionRowBuilder().addComponents(
    selected.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`choice_${Date.now()}_${idx + 1}`)
        .setLabel(label)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][idx % 4])
    )
  );

  const msg = await channel.send({ embeds: [challengeEmbed], components: [row] });

  setTimeout(() => channel.send("⏳ 15 seconds left...").catch(() => {}), 15000);
  setTimeout(() => channel.send("🎲 Time’s up. The charm decides.").catch(() => {}), 30000);

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
  const clickedUsers = new Set();

  collector.on('collect', async i => {
    if (i.user.bot || clickedUsers.has(i.user.id)) return;
    clickedUsers.add(i.user.id);

    ensurePlayer(i.user, players);

    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    players.get(i.user.id).points += result;

    const flavorList = pointFlavors[result > 0 ? `+${result}` : `${result}`] || [];
    const flavorText = flavorList.length ? flavorList[Math.floor(Math.random() * flavorList.length)] : "";

    try {
      await i.reply({
        content: `You chose **${i.component.label}**\nYour fate: **${result > 0 ? '+' : ''}${result} point${Math.abs(result) !== 1 ? 's' : ''}**\n${flavorText}`,
        flags: 64
      });
    } catch {}
  });

  await new Promise(res => collector.on('end', res));
  try {
    await msg.edit({ components: [new ActionRowBuilder().addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true)))] });
  } catch {}

  await channel.send(`🧮 Mini-game complete. Points applied.`);
  await wait(2000);
}
// =======================
// 🤝 Trust or Doubt (majority Trust = Trusters +1, unless Squig lies → Trusters -1)
// =======================
async function runTrustOrDoubtMini(players, channel, roundLabel = "ROUND 7 — Trust or Doubt") {
  const title = `🤝 ${roundLabel}`;
  const desc = [
    "Players click **Trust** or **Doubt**.",
    "If **majority Trust**, those players gain **+1** —",
    "👉 **unless the Squig lies this round**, then Trusters **-1** instead.",
    "Everyone else: **0**.",
    "⏳ You have **30 seconds**."
  ].join("\n");

  const prompt = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x7f00ff)
    .setImage("https://i.imgur.com/KixyMtH.png");


  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("trust").setLabel("Trust").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("doubt").setLabel("Doubt").setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [prompt], components: [row] });

  // userId -> 'trust' | 'doubt'
  const picks = new Map();

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000
  });

  collector.on("collect", async (i) => {
    if (i.user.bot) return;

    // ensure on scoreboard
    if (!players.has(i.user.id)) {
      players.set(i.user.id, { id: i.user.id, username: i.user.username || "Player", points: 0 });
    }

    const choice = i.customId === "trust" ? "trust" : "doubt";
    picks.set(i.user.id, choice);
    await i.reply({ content: `Locked: **${choice === "trust" ? "Trust" : "Doubt"}**`, flags: 64 });
  });

  setTimeout(() => channel.send("⏳ 20 seconds left…").catch(() => {}), 10_000);
  setTimeout(() => channel.send("⏰ 10 seconds left…").catch(() => {}), 20_000);

  await new Promise((res) => collector.on("end", res));

  // Disable buttons
  try {
    await msg.edit({
      components: [
        new ActionRowBuilder().addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true)))
      ]
    });
  } catch {}

  const trusters = [...picks.entries()].filter(([_, v]) => v === "trust").map(([uid]) => uid);
  const doubters = [...picks.entries()].filter(([_, v]) => v === "doubt").map(([uid]) => uid);

  const nT = trusters.length, nD = doubters.length, total = nT + nD;

  if (total === 0) {
    await channel.send("😴 No one chose. The Squig shrugs and eats a battery.");
    return;
  }

  const majorityTrust = nT > nD;          // tie = no majority
  const squigLies = Math.random() < 0.33; // ~33% lie chance

  let deltaApplied = 0;
  let resultLines = [];

  if (majorityTrust) {
    if (!squigLies) {
      for (const uid of trusters) {
        const p = players.get(uid); p.points = (p.points || 0) + 1;
      }
      deltaApplied = +1;
      resultLines.push(`✅ Majority chose **Trust**. Squig told the truth. **Trusters +1**.`);
    } else {
      for (const uid of trusters) {
        const p = players.get(uid); p.points = (p.points || 0) - 1;
      }
      deltaApplied = -1;
      resultLines.push(`🌀 Majority chose **Trust**… but the Squig **lied**. **Trusters -1**.`);
    }
  } else {
    resultLines.push(`🪵 No Trust majority (tie or Doubt). **No points change.**`);
  }

  const nameOf = (uid) => {
    const p = players.get(uid);
    return p?.username ? p.username : `<@${uid}>`;
  };

  const list = (arr) => {
    if (arr.length === 0) return "—";
    const names = arr.map(nameOf);
    return names.length > 12 ? names.slice(0, 12).join(", ") + `, +${names.length - 12} more` : names.join(", ");
  };

  const results = new EmbedBuilder()
    .setTitle("🤝 Trust or Doubt — Results")
    .setColor(deltaApplied >= 0 ? 0x00c853 : 0xd50000)
    .setDescription(
      [
        `**Trusters (${nT})**: ${list(trusters)}`,
        `**Doubters (${nD})**: ${list(doubters)}`,
        "",
        `**Outcome:** ${resultLines.join(" ")}`
      ].join("\n")
    );

  await channel.send({ embeds: [results] });
  await wait(1500);
}


// =======================
// 🎲 Squig Roulette (fixed rules: pick 1–6, match = +2, others 0)
// =======================
async function runSquigRouletteMini(players, channel, roundLabel = "ROUND 7 — Squig Roulette") {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');

  const title = `🎲 ${roundLabel}`;
  const rules = [
    "Pick a number **1–6** below.",
    "I’ll roll a die at the end.",
    "**Match = +2 points.** No match = 0.",
  ].join('\n');

const embed = new EmbedBuilder()
  .setTitle(`${roundLabel}`)
  .setDescription(`${rules}\n\n⏳ You have **30 seconds** to decide.`)
  .setColor(0x7f00ff)
  .setImage("https://i.imgur.com/BolGW1m.png");

  // 6 buttons (two rows for neatness)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roulette_1').setLabel('1').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('roulette_2').setLabel('2').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('roulette_3').setLabel('3').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roulette_4').setLabel('4').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('roulette_5').setLabel('5').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('roulette_6').setLabel('6').setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row1, row2] });

  // Collect picks: userId -> number
  const picks = new Map();
  const clickedUsers = new Set();

  const filter = (i) => i.message.id === msg.id && !i.user.bot;
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
    filter,
  });

  collector.on('collect', async (i) => {
    try {
      // allow updating pick; last click counts (nicer UX)
      const choice = Number(i.customId.split('_')[1]);
      if (!Number.isInteger(choice) || choice < 1 || choice > 6) {
        return i.reply({ content: 'Invalid choice.', flags: 64 });
      }
      // ensure they exist on the scoreboard
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username || "Player", points: 0 });
      }
      picks.set(i.user.id, choice);
      clickedUsers.add(i.user.id);
      await i.reply({ content: `You picked **${choice}** 🎯`, flags: 64 });
    } catch { /* noop */ }
  });

  // countdown alerts
  setTimeout(() => channel.send("⏳ 20 seconds left…").catch(() => {}), 10_000);
  setTimeout(() => channel.send("⏰ 10 seconds left…").catch(() => {}), 20_000);

  await new Promise((res) => collector.on('end', res));

  // Disable buttons
  try {
    const disable = (row) => new ActionRowBuilder().addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true)));
    await msg.edit({ components: [disable(row1), disable(row2)] });
  } catch {}

  // If nobody picked, exit gracefully
  if (picks.size === 0) {
    await channel.send(`😴 No picks. The die rolls off the table and cracks in half.`);
    return;
  }

  // Roll 1–6
  const rolled = 1 + Math.floor(Math.random() * 6);

  // Apply points (+2 for matches)
  const winners = [];
  for (const [uid, num] of picks.entries()) {
    if (num === rolled) {
      winners.push(uid);
      const p = players.get(uid) || { id: uid, username: "Player", points: 0 };
      p.points = (p.points || 0) + 2;
      players.set(uid, p);
    }
  }

  // Pretty results table
  const nameOf = (uid) => {
    const p = players.get(uid);
    return p?.username ? p.username : `<@${uid}>`;
  };
  const byNum = new Map(); // num -> [names]
  for (const [uid, num] of picks) {
    const arr = byNum.get(num) || [];
    arr.push(nameOf(uid));
    byNum.set(num, arr);
  }
  const lines = [];
  for (let n = 1; n <= 6; n++) {
    const list = byNum.get(n) || [];
    lines.push(`**${n}** — ${list.length ? list.join(', ') : '—'}`);
  }

  const summary = new EmbedBuilder()
    .setTitle('🎲 Squig Roulette — Results')
    .setDescription([
      `Rolled: **${rolled}**`,
      '',
      '**Picks:**',
      lines.join('\n'),
      '',
      winners.length ? `Winners (+2): ${winners.map(nameOf).join(', ')}` : 'No matches this time!',
    ].join('\n'))
    .setColor(0x7f00ff);

  await channel.send({ embeds: [summary] });
  await wait(1500);
}


// =======================
// 🌀 Labyrinth (60s, +1 per correct step, +2 bonus for perfect)
// =======================
async function runLabyrinthAdventure(channel, playerMap) {
  const eventTitle = "🌀 The Labyrinth of Wrong Turns";
  const sessionId = randomUUID();

  const correctStepLore = [
    "The tunnel curves like the spine of some old beast. You press onward, hearing faint dripping ahead.",
    "Your footsteps echo, but the echoes don’t match your pace.",
    "The air grows warm, almost metallic. Something scurries away just out of sight.",
    "The walls here breathe, slow and heavy, as if the stone itself is alive.",
    "A faint glow pulses from deeper in the passage — you can’t tell if it’s inviting or warning.",
    "The floor tilts sharply, but you manage to keep your footing as the hum grows louder.",
    "Shadows crawl along the ceiling, but none belong to you."
  ];
  const wrongStepLore = [
    "The floor vanishes beneath your feet, and cold water swallows you whole.",
    "A shadow steps out from the wall, wearing your face, and everything goes black.",
    "The air becomes too thick to breathe; you collapse before you can turn back.",
    "A heavy door slams shut behind you, and the path ahead is gone.",
    "Your reflection appears in the wall — smiling, waving — and pulls you in.",
    "Roots wrap around your ankles and drag you into the dark.",
    "The light fades completely, and you know you are not alone."
  ];
  const epicEscapeLore = [
    "You shove open the final stone door, and the labyrinth screams as if alive. The light beyond is blinding — and when it fades, you stand in the Gauntlet arena, dripping with shadow and triumph. The Squigs fall silent… then erupt into manic applause.",
    "A final turn, a final breath — and the walls collapse behind you like they’ve given up the hunt. You tumble through the portal and into the Gauntlet floor, Squigs pounding the ground in celebration. Your name will be etched into the Labyrinth’s memory — and that’s not always a good thing.",
    "The last corridor is narrow, breathing on your neck as you run. With a leap, you crash through the exit and land before the gathered Squigs. They hiss your name, then chant it, then scream it until the air vibrates. You have beaten what swallows most whole.",
    "You push past the final threshold, dragging with you a wind that smells of cold iron and fear. The Gauntlet crowd stares in awe. Somewhere deep in the Labyrinth, something sighs — or maybe laughs. You have made it out… for now."
  ];

// === Labyrinth with 2-button alternating directions ===
const dirPairs = [
  ["Left", "Right"],
  ["Up", "Down"],
  ["Left", "Down"],
  ["Right", "Up"]
];

// pick correct path: 4 steps, each random from that step’s pair
const correctPath = Array.from({ length: 4 }, (_, step) => {
  const pair = dirPairs[step % dirPairs.length];
  return pair[Math.floor(Math.random() * pair.length)];
});

const state = new Map(); // userId -> { step, finished, points, started }

// Public row: first step’s pair
const publicRow = new ActionRowBuilder().addComponents(
  dirPairs[0].map(d =>
    new ButtonBuilder()
      .setCustomId(`lab:init:${sessionId}:${d}`)
      .setLabel(d)
      .setStyle(ButtonStyle.Primary)
  )
);

const startMsg = await channel.send({
  embeds: [{
    title: eventTitle,
    description:
      "The ground tilts, and you tumble into the Squigs’ infamous labyrinth.\n" +
      "Find the **exact** sequence of turns — four correct choices in a row — before the Squigs decide you’ve been in here too long.\n\n" +
      "⏳ **You have 60 seconds.**\n" +
      "✅ Each correct step: **+1 point**\n" +
      "🏆 Escape all 4 steps: **+2 bonus** (total **+6**)\n\n" +
      "_Click your **first** turn below. After that, your path continues in **private embeds** only you can see._",
    color: 0x7f00ff,
    image: { url: "https://i.imgur.com/MA1CdEC.jpeg" }
  }],
  components: [publicRow]
});

// Build step row with 2 buttons (based on current step)
const stepRowFor = (userId, step) =>
  new ActionRowBuilder().addComponents(
    dirPairs[step % dirPairs.length].map(d =>
      new ButtonBuilder()
        .setCustomId(`lab:step:${sessionId}:${userId}:${d}`)
        .setLabel(d)
        .setStyle(ButtonStyle.Primary)
    )
  );

const filter = (i) => {
  if (!i.isButton()) return false;
  const parts = i.customId.split(":");
  if (parts[0] !== "lab") return false;
  const isInit = parts[1] === "init" && parts[2] === sessionId;
  const isStep = parts[1] === "step" && parts[2] === sessionId;
  return isInit || isStep;
};

const collector = new InteractionCollector(channel.client, {
  componentType: ComponentType.Button,
  time: 60_000,
  filter
});

const ensurePlayerLocal = (user) => {
  if (!playerMap.has(user.id)) {
    playerMap.set(user.id, { id: user.id, username: user.username || "Player", points: 0 });
  }
  if (!state.has(user.id)) {
    state.set(user.id, { step: 0, finished: false, points: 0, started: false });
  }
};

const handleProgress = async (interaction, userId, choice, isInitialClick=false) => {
  const s = state.get(userId);
  if (!s || s.finished) { try { await interaction.deferUpdate(); } catch {} return; }

  const isCorrect = (choice === correctPath[s.step]);

  if (isCorrect) {
    s.points += 1;
    s.step += 1;

    if (s.step >= 4) {
      s.finished = true;
      s.points += 2; // escape bonus
      const payload = {
        embeds: [{
          title: `${eventTitle} – Escape!`,
          description: `${epicEscapeLore[Math.floor(Math.random() * epicEscapeLore.length)]}\n\n**+${s.points} points earned** (includes **+2** escape bonus)`,
          color: 0x00ff88
        }],
        components: []
      };
      try { if (isInitialClick) await interaction.reply({ ...payload, ephemeral: true }); else await interaction.update(payload); } catch {}
      return;
    }

    const payload = {
      embeds: [{
        title: `${eventTitle} – Step ${s.step + 1}`,
        description: `${correctStepLore[Math.floor(Math.random() * correctStepLore.length)]}\n\nChoose your next path…`,
        color: 0x7f00ff
      }],
      components: [stepRowFor(userId, s.step)],
      ephemeral: true
    };
    try { if (isInitialClick) await interaction.reply(payload); else await interaction.update({ embeds: payload.embeds, components: payload.components }); } catch {}
  } else {
    s.finished = true;
    const payload = {
      embeds: [{
        title: `${eventTitle} – Dead End`,
        description: `${wrongStepLore[Math.floor(Math.random() * wrongStepLore.length)]}\n\n**Run ends – you earned ${s.points} point${s.points === 1 ? "" : "s"}.**`,
        color: 0xff0066
      }],
      components: []
    };
    try { if (isInitialClick) await interaction.reply({ ...payload, ephemeral: true }); else await interaction.update(payload); } catch {}
  }
};

collector.on('collect', async (i) => {
  const parts = i.customId.split(":");

  if (parts[1] === "init") {
    const dir = parts[3];
    ensurePlayerLocal(i.user);
    const s = state.get(i.user.id);
    if (s.started || s.finished) { try { await i.deferUpdate(); } catch {} return; }
    s.started = true;
    await handleProgress(i, i.user.id, dir, true);
    return;
  }

  if (parts[1] === "step") {
    const userId = parts[3];
    const dir = parts[4];

    if (i.user.id !== userId) {
      try { await i.reply({ content: "That’s not your path to walk.", ephemeral: true }); } catch {}
      return;
    }

    if (!playerMap.has(userId)) playerMap.set(userId, { id: userId, username: i.user.username || "Player", points: 0 });
    if (!state.has(userId)) state.set(userId, { step: 0, finished: false, points: 0, started: true });

    await handleProgress(i, userId, dir, false);
    return;
  }
});

await new Promise((resolve) => {
  collector.on('end', async () => {
    try { await startMsg.edit({ components: [] }); } catch {}
    let verdict = "**The Labyrinth’s Verdict:**\n";
    for (const [userId, s] of state.entries()) {
      const p = playerMap.get(userId) || { id: userId, username: "Player", points: 0 };
      p.points = (p.points || 0) + (s.points || 0);
      playerMap.set(userId, p);

      if (s.finished && s.step >= 4) {
        verdict += `<@${userId}> **escaped in glory!** **+${s.points} points**\n`;
      } else if (s.points > 0) {
        verdict += `<@${userId}> reached step ${s.step} — **+${s.points} points**\n`;
      } else if (s.started) {
        verdict += `<@${userId}> was lost at the first turn — **0 points**\n`;
      } else {
        verdict += `<@${userId}> did not enter the Labyrinth.\n`;
      }
    }

    await channel.send({ embeds: [{ title: "🏚 The Labyrinth’s Verdict", description: verdict, color: 0xff0066 }] });
    resolve();
  });
});
}

// =======================
// 🎯 Ugly Selector (mid-game break)
// =======================
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
  reactionCollector.on('collect', (reaction, user) => users.add(user.id));

  await new Promise((resolve) => reactionCollector.on('end', resolve));

  if (users.size === 0) {
    await channel.send("🌀 No one dared tempt fate. The charm spins alone...");
    return;
  }

  const userIdArray = Array.from(users);
  const winnerId = userIdArray[Math.floor(Math.random() * userIdArray.length)];

  if (!playerMap.has(winnerId)) {
    playerMap.set(winnerId, { id: winnerId, username: "Unknown", points: 0 });
  }

  playerMap.get(winnerId).points += 3;
  await channel.send(`🎉 The Squig’s Ugly Selector has spoken... <@${winnerId}> gains **+3 bonus points!**\n_The static fizzles and the charm forgets what it just did._`);
}
// =======================
// 🪙 Risk It (20s decision window)
// =======================
async function runRiskItPhase(channel, playerMap) {
  const intro = new EmbedBuilder()
    .setTitle("🎲 RISK IT — The Charm Tempts You")
    .setDescription(
      "Between rounds, the static parts... and a Squig grins.\n" +
      "Risk your points for a shot at more — or lose them to the void.\n\n" +
      "• **Risk All** — stake everything\n" +
      "• **Risk Half** — stake half your current points\n" +
      "• **Risk Quarter** — stake a quarter (min 1)\n" +
      "• **No Risk** — sit out and watch the chaos\n\n" +
      "⏳ You have **20 seconds** to decide."
    )
    .setColor(0xffaa00)
    .setImage("https://i.imgur.com/GHztzMk.png");


  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("risk_all").setLabel("Risk All").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("risk_half").setLabel("Risk Half").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("risk_quarter").setLabel("Risk Quarter").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("risk_none").setLabel("No Risk").setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [intro], components: [row] });

  const entrants = new Map(); // userId -> { stake, choiceLabel }
  const seen = new Set();

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 20000
  });

  collector.on("collect", async (i) => {
    if (i.user.bot) return;
    if (seen.has(i.user.id)) return i.reply({ content: "You already locked a choice.", flags: 64 });

    if (!playerMap.has(i.user.id)) return i.reply({ content: "You’re not on the scoreboard yet — join a round first!", flags: 64 });
    const player = playerMap.get(i.user.id);
    const pts = Math.floor(player.points || 0);

    let stake = 0;
    let label = "";

    switch (i.customId) {
      case "risk_all":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = pts; label = "Risk All"; break;
      case "risk_half":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = Math.max(1, Math.floor(pts / 2)); label = "Risk Half"; break;
      case "risk_quarter":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = Math.max(1, Math.floor(pts / 4)); label = "Risk Quarter"; break;
      case "risk_none":
        seen.add(i.user.id);
        return i.reply({ content: "You sit out. The charm respects cautious cowards. (Sometimes.)", flags: 64 });
    }

    entrants.set(i.user.id, { stake, choiceLabel: label });
    seen.add(i.user.id);
    return i.reply({ content: `Locked: **${label}** (Stake: ${stake} point${stake === 1 ? "" : "s"})`, flags: 64 });
  });

  setTimeout(() => channel.send("⏳ 10 seconds left to **Risk It**...").catch(() => {}), 10000);

  await new Promise((res) => collector.on("end", res));

  try {
    await msg.edit({ components: [new ActionRowBuilder().addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true)))] });
  } catch {}

  if (entrants.size === 0) {
    await channel.send("😴 No one dared. The charm yawns and moves on.");
    return;
  }

  const outcomes = [
    { mult: -1, label: "💀 Lost it all", lore: "The charm nibbles your points like day-old fries." },
    { mult: 0,  label: "😮 Broke even",  lore: "Static fizzles; the charm shrugs. Nothing gained, nothing lost." },
    { mult: 0.5, label: "✨ Won 1.5×",    lore: "A bright hiss in the air. Luck tastes like ozone." },
    { mult: 1, label: "👑 Doubled",       lore: "The charm purrs. Reality briefly applauds." }
  ];

  const lines = [];
  for (const [userId, { stake, choiceLabel }] of entrants.entries()) {
    const player = playerMap.get(userId);
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    let delta = outcome.mult === -1 ? -stake : Math.round(stake * outcome.mult);
    player.points = (player.points || 0) + delta;

    const sign = delta > 0 ? "+" : "";
    lines.push(
      `<@${userId}> • **${choiceLabel}** (staked ${stake}) → ${outcome.label} • **${sign}${delta}** • new total: **${player.points}**\n_${outcome.lore}_`
    );
  }

  const resEmbed = new EmbedBuilder()
    .setTitle("🧮 Risk It — Results")
    .setDescription(lines.join("\n\n"))
    .setColor(0xff66cc);

  await channel.send({ embeds: [resEmbed] });
  await wait(2000);
}

// =======================
// 🧱 New Short Flow Orchestrator (10 rounds)
// =======================
async function runPointsGauntlet_ShortFlow(channel) {
  const players = activeGame.players;

  // Round 1: Mini-Game -> Riddle
  await runMiniGamePoints(players, channel, "ROUND 1");
  await runRiddlePoints(players, channel);
  await wait(1500);

  // Round 2: Mini-Game -> Riddle
  await runMiniGamePoints(players, channel, "ROUND 2");
  await runRiddlePoints(players, channel);
  await wait(1500);

  // Round 3: Labyrinth -> Riddle
  await channel.send("🌫️ The floor tilts… a hush falls over the Squigs.");
  await runLabyrinthAdventure(channel, players);
  await wait(1500);
  await runRiddlePoints(players, channel);
  await wait(1500);

  // Ugly Selector — Mid Game Pause
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
  await wait(1500);
  await runUglySelector(channel, players);
  await wait(1500);
  await channel.send("🎭 The charm returns to its chaotic rhythm...");
  await wait(1500);

  // Round 4: Mini-Game -> Riddle
  await runMiniGamePoints(players, channel, "ROUND 4");
  await runRiddlePoints(players, channel);
  await wait(1500);

  // Round 5: Squig Roulette
  await channel.send("🎲 The Squigs demand a wager… **Squig Roulette!**");
  await runSquigRouletteMini(players, channel, "ROUND 5 — Squig Roulette");
  await wait(1500);

  // Round 6: Mini-Game -> Riddle
  await runMiniGamePoints(players, channel, "ROUND 6");
  await runRiddlePoints(players, channel);
  await wait(1500);

// Round 7: Trust or Doubt (majority trust mechanic)
await runTrustOrDoubtMini(players, channel, "ROUND 7 — Trust or Doubt");
await wait(1500);

  // Round 8: Mini-Game -> Riddle  (you changed wording from 9 → 8)
  await runMiniGamePoints(players, channel, "ROUND 8");
  await runRiddlePoints(players, channel);
  await wait(1500);

// Round 9: Risk It -> Riddle
await channel.send("🪙 The charm leans in… a chance to **Risk It**.");
await runRiskItPhase(channel, players);
await runRiddlePoints(players, channel);
await wait(1500);


  // Round 10: Mini-Game -> Riddle
  await runMiniGamePoints(players, channel, "ROUND 10");
  await runRiddlePoints(players, channel);
  await wait(2000);

  // Final scores + podium (with point tiebreaker if needed)
  await showFinalScores(players, channel);

  // cleanup
  activeGame = null;
  usedMiniGameIndices.clear();
  usedRiddleIndices.clear();
}


// =======================
// 🏁 Scoring, Tiebreakers, Podium
// =======================
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
    const remaining = sorted.filter(p => !tiedTopScorers.find(tp => tp.id === p.id));
    const finalOrderedPlayers = [...resolvedTiebreaker, ...remaining];
    await showFinalPodium(channel, finalOrderedPlayers);
  } else {
    await showFinalPodium(channel, sorted);
  }

  await wait(2000);
  activeGame = null;
  usedMiniGameIndices.clear();
  rematchCount++;
  if (rematchCount < maxRematches) {
    await channel.send(`📯 *Maybe enough reactions will encourage another game 👀*`);
  }
}

// Vote-based tiebreaker (for 1st place ties)
async function runPointTiebreaker(tiedPlayers, channel) {
  return new Promise(async (resolve) => {
    const voteCounts = new Map(tiedPlayers.map(p => [p.id, 0]));
    const votedUsers = new Set();

    const buttons = tiedPlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`vote_${player.id}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    const voteEmbed = new EmbedBuilder()
      .setTitle("🩸 FINAL TIEBREAKER VOTE — TOP SPOT 🩸")
      .setDescription(
        `Multiple players are tied for the crown.\n\n` +
        `Vote to determine their final ranking.\nAll may vote — the charm will sort the rest.\n\n` +
        tiedPlayers.map(p => `• ${p.username}`).join('\n')
      )
      .setColor(0xff0033);

    const voteMessage = await channel.send({ embeds: [voteEmbed], components: [row] });

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

  // Resolve 2nd/3rd ties (keep 1st intact)
  const firstPlacePoints = top3[0]?.points ?? 0;
  const secondAndThird = top3.slice(1);
  if (secondAndThird.length === 2 && secondAndThird[0].points === secondAndThird[1].points) {
    const resolved = await runTiebreaker(secondAndThird, channel);
    top3 = [top3[0], ...resolved];
  }

  top3.forEach((player, index) => {
    podiumEmbed.addFields({
      name: `${medals[index]} ${titles[index]}`,
      value: `<@${player.id}> \n**Total Points:** ${player.points}`,
      inline: false
    });
  });

  await channel.send({ embeds: [podiumEmbed] });
  await wait(1500);
}

async function runTiebreaker(tiedPlayers, channel) {
  return new Promise(async (resolve) => {
    const voteCounts = new Map(tiedPlayers.map(p => [p.id, 0]));
    const votedUsers = new Set();

    const buttons = tiedPlayers.map((player) =>
      new ButtonBuilder()
        .setCustomId(`vote_${player.id}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    const voteEmbed = new EmbedBuilder()
      .setTitle("🩸 TIEBREAKER VOTE (Placements 2 & 3) 🩸")
      .setDescription(
        `We have a tie for second/third.\nVote to decide the order.\n\n` +
        tiedPlayers.map(p => `• ${p.username}`).join('\n')
      )
      .setColor(0xff0033);

    const voteMessage = await channel.send({ embeds: [voteEmbed], components: [row] });

    const collector = voteMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 20000
    });

    collector.on('collect', async (interaction) => {
      if (votedUsers.has(interaction.user.id)) return interaction.reply({ content: "You already voted!", flags: 64 });
      const votedId = interaction.customId.split('_')[1];
      if (!voteCounts.has(votedId)) return interaction.reply({ content: "Invalid vote!", flags: 64 });
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
      await channel.send("🗳️ Tiebreaker vote complete.");
      resolve(sortedTied);
    });
  });
}

// =======================
// ℹ️ Utility Commands
// =======================
client.on('messageCreate', async (message) => {
  if (message.content === '!points') {
    if (!activeGame || !activeGame.players) return message.reply('⚠️ No Gauntlet is currently running.');
    const player = activeGame.players.get(message.author.id);
    if (!player) return message.reply('💀 You haven’t interacted this game.');
    return message.reply(`📊 You currently have **${player.points}** point${player.points === 1 ? '' : 's'}.`);
  }

  if (message.content === '!lb' || message.content === '!leaderboard') {
    if (!activeGame || !activeGame.players) return message.reply('⚠️ No Gauntlet is currently running.');
    const sorted = [...activeGame.players.values()].sort((a, b) => b.points - a.points).slice(0, 15);
    const list = sorted.map((p, i) => `**#${i + 1}** ${p.username} — **${p.points}** point${p.points === 1 ? '' : 's'}`).join('\n');
    const embed = new EmbedBuilder().setTitle('🏆 Current Gauntlet Leaderboard').setDescription(list || 'No players currently tracked.').setColor(0x00ccff);
    return message.channel.send({ embeds: [embed] });
  }

if (message.content === '!info') {
  const infoEmbed = new EmbedBuilder()
    .setTitle("📖 Welcome to The Gauntlet — Full Edition")
    .setDescription(
      "**10 chaotic rounds**:\n" +
      "1) Mini-Game → Riddle\n" +
      "2) Mini-Game → Riddle\n" +
      "3) Labyrinth → Riddle\n" +
      "   ⏸ Mid-Game Pause: **Ugly Selector**\n" +
      "4) Mini-Game → Riddle\n" +
      "5) **Squig Roulette** (match the die = +2)\n" +
      "6) Mini-Game → Riddle\n" +
      "7) **Trust or Doubt** (majority Trust = +1, unless the Squig lies…)\n" +
      "8) Mini-Game → Riddle\n" +
      "9) **Risk It** → Riddle\n" +
      "10) Mini-Game → Riddle\n\n" +

      "Then: **Tiebreaker if needed → Final Podium**\n\n" +
      "Earn points from luck, brainpower, and chaos. Highest total wins."
    )
    .setColor(0x00ccff);

  return message.channel.send({ embeds: [infoEmbed] });
}
});


// === On Bot Ready ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Start Bot ===
client.login(TOKEN);
