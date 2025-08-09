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
  ComponentType,
  InteractionCollector        // ⬅️ ADD THIS
} = require('discord.js');

const { randomUUID } = require('crypto'); // ⬅️ ADD THIS (new)


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
  image: "https://i.imgur.com/FNYqXHz.jpeg" // art will be made after
},
{
  title: "🧳 Luggage Claim of the Damned",
  lore: "You stand at a slow-moving carousel in a dim, echoing room. Four strange suitcases pass by. One drips water. One hums softly. One is breathing. One is perfectly still, which somehow feels worse. The Squig at your side whispers, 'One of these is yours now.'",
  buttons: ["Dripping Case", "Humming Case", "Breathing Case", "Still Case"],
  image: "https://i.imgur.com/UsrlWEx.jpeg" // art after
},
  {
    title: "🧼 Clean or Cursed?",
    lore: "The Squigs don’t really understand hygiene, but they’re trying. You’re shown four soaps on a stone plinth. One cured a rash that never existed. One dissolved a hand. One smells like trauma. The last might be fruit-scented? A Squig proudly says, We made them ourselves. " ,
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
  image: "https://i.imgur.com/35OO8T1.jpeg" // art after
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

const riddles = [
  // === EASY (1) ===
  { riddle: "I’m full of holes but still hold water. What am I?", answers: ["sponge"], difficulty: 1 },
  { riddle: "Turn me on and I'm running, but never move from my spot. What am I?", answers: ["faucet", "tap"], difficulty: 1 },
  { riddle: "I come in pairs, make noise when you clap me, and live on your hands. What am I?", answers: ["gloves"], difficulty: 1 },
  { riddle: "I follow you everywhere but disappear in the dark. What am I?", answers: ["shadow"], difficulty: 1 },
  { riddle: "I’m white when I’m dirty, and black when I’m clean. What am I?", answers: ["chalkboard"], difficulty: 1 },
  { riddle: "I get shorter the more you use me. What am I?", answers: ["pencil"], difficulty: 1 },
  { riddle: "I’m always in the fridge but never get cold. What am I?", answers: ["light"], difficulty: 1 },
  { riddle: "I’m soft enough to fold but strong enough to hold soup. What am I?", answers: ["bread"], difficulty: 1 },

  // === MEDIUM (2) ===
  { riddle: "I speak without a mouth and travel without feet. What am I?", answers: ["echo"], difficulty: 2 },
  { riddle: "I hide in every corner but am never seen in the open. What am I?", answers: ["dust"], difficulty: 2 },
  { riddle: "I’m made of glass but can capture time. What am I?", answers: ["hourglass"], difficulty: 2 },
  { riddle: "I disappear every time you say my name. What am I?", answers: ["silence"], difficulty: 2 },
  { riddle: "I’m born from fire, live in air, and dissipate in wind. What am I?", answers: ["smoke"], difficulty: 2 },
  { riddle: "I’m as light as a feather but even the strongest can’t hold me long. What am I?", answers: ["breath"], difficulty: 2 },
  { riddle: "I’m have many rings but have no fingers. What am I?", answers: ["tree"], difficulty: 2 },
  { riddle: "I can fill a room but take up no space. What am I?", answers: ["light"], difficulty: 2 },
  { riddle: "I’m always ahead of you but can never be reached. What am I?", answers: ["future", "tomorrow"], difficulty: 2 },
  { riddle: "I’m big when I’m young and small when I’m old and used. What am I?", answers: ["candle"], difficulty: 2 },

  // === HARD (3) ===
  { riddle: "I’m the beginning of eternity and the end of time. What am I?", answers: ["e"], difficulty: 3 },
  { riddle: "I live in your past, grow in your mind, and can shape your future. What am I?", answers: ["memory"], difficulty: 3 },
  { riddle: "The more I’m taken from, the bigger I get. What am I?", answers: ["hole"], difficulty: 3 },
  { riddle: "I’m the only thing you can break by speaking. What am I?", answers: ["silence"], difficulty: 3 },
  { riddle: "I’m invisible until I’m gone. What am I?", answers: ["time"], difficulty: 3 },
  { riddle: "I exist only when shared, but vanish when kept. What am I?", answers: ["secret"], difficulty: 3 },
  { riddle: "I can trap you without walls and hold you without chains. What am I?", answers: ["fear"], difficulty: 3 },
  { riddle: "I’m made by everyone but belong to no one. What am I?", answers: ["history"], difficulty: 3 },
  { riddle: "I’m shaped by sound but leave no trace. What am I?", answers: ["echo"], difficulty: 3 },
  { riddle: "I can fly without wings, cry without eyes, and burn without fire. What am I?", answers: ["imagination"], difficulty: 3 }
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
// =======================
// 🌀 LABYRINTH (In-Channel, Ephemeral Steps)
// Runs for 60s. +1 per correct step, +2 bonus on perfect escape (+6 total).
// =======================
async function runLabyrinthAdventure(channel, playerMap) {
  const eventTitle = "🌀 The Labyrinth of Wrong Turns";
  const sessionId = randomUUID(); // isolate this run’s interactions

  // Per-step flavor
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

  // Secret 4-step code (e.g., ["Left","Up","Right","Down"])
  const dirs = ["Left", "Right", "Up", "Down"];
  const correctPath = Array.from({ length: 4 }, () => dirs[Math.floor(Math.random() * dirs.length)]);

  // Per-player state (created lazily on first click too)
  const state = new Map(); // userId -> { step, finished, points, started }

  // Public announcement + first-choice buttons (everyone clicks here)
  const publicRow = new ActionRowBuilder().addComponents(
    dirs.map(d =>
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
      "⏳ **You have 60 seconds to make it through the Labyrinth.**\n" +
      "✅ Each correct step: **+1 point**\n" +
      "🏆 Escape all 4 steps: **+2 bonus** (total **+6**).\n\n" +
      "_Click your **first** turn below. After that, your path continues in **private embeds only you can see**._",
    color: 0x7f00ff,
    image: {
      url: "https://i.imgur.com/MA1CdEC.jpeg"
    }
  }],
  components: [publicRow]
});


  // Build ephemeral step row for a given user
  const stepRowFor = (userId) =>
    new ActionRowBuilder().addComponents(
      dirs.map(d =>
        new ButtonBuilder()
          .setCustomId(`lab:step:${sessionId}:${userId}:${d}`)
          .setLabel(d)
          .setStyle(ButtonStyle.Primary)
      )
    );

  // Collector for both public first click and all subsequent ephemeral steps
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

  // Helper to ensure player exists on the scoreboard
  const ensurePlayer = (user) => {
    if (!playerMap.has(user.id)) {
      playerMap.set(user.id, { id: user.id, username: user.username || "Player", points: 0 });
    }
    if (!state.has(user.id)) {
      state.set(user.id, { step: 0, finished: false, points: 0, started: false });
    }
  };

  const handleProgress = async (interaction, userId, choice, isInitialClick=false) => {
    const s = state.get(userId);
    if (!s || s.finished) {
      try { await interaction.deferUpdate(); } catch {}
      return;
    }

    const isCorrect = (choice === correctPath[s.step]);

    if (isCorrect) {
      s.points += 1;
      s.step += 1;

      // Escape!
      if (s.step >= 4) {
        s.finished = true;
        s.points += 2; // +2 bonus for perfect escape
        const payload = {
          embeds: [{
            title: `${eventTitle} – Escape!`,
            description: `${epicEscapeLore[Math.floor(Math.random() * epicEscapeLore.length)]}\n\n**+${s.points} points earned** (includes **+2** escape bonus)`,
            color: 0x00ff88
          }],
          components: []
        };
        try {
          if (isInitialClick) await interaction.reply({ ...payload, ephemeral: true });
          else await interaction.update(payload);
        } catch {}
        return;
      }

      // Next step (ephemeral)
      const payload = {
        embeds: [{
          title: `${eventTitle} – Step ${s.step + 1}`,
          description: `${correctStepLore[Math.floor(Math.random() * correctStepLore.length)]}\n\nChoose your next path…`,
          color: 0x7f00ff
        }],
        components: [stepRowFor(userId)],
        ephemeral: true
      };

      try {
        if (isInitialClick) {
          await interaction.reply(payload);
        } else {
          await interaction.update({ embeds: payload.embeds, components: payload.components });
        }
      } catch {}
    } else {
      // Wrong turn — end
      s.finished = true;
      const payload = {
        embeds: [{
          title: `${eventTitle} – Dead End`,
          description: `${wrongStepLore[Math.floor(Math.random() * wrongStepLore.length)]}\n\n**Run ends – you earned ${s.points} point${s.points === 1 ? "" : "s"}.**`,
          color: 0xff0066
        }],
        components: []
      };
      try {
        if (isInitialClick) await interaction.reply({ ...payload, ephemeral: true });
        else await interaction.update(payload);
      } catch {}
    }
  };

  collector.on('collect', async (i) => {
    const parts = i.customId.split(":");

    // First public click: lab:init:<sessionId>:<dir>
    if (parts[1] === "init") {
      const dir = parts[3];
      ensurePlayer(i.user);
      const s = state.get(i.user.id);
      if (s.started || s.finished) {
        try { await i.deferUpdate(); } catch {}
        return;
      }
      s.started = true;
      await handleProgress(i, i.user.id, dir, true);
      return;
    }

    // Ephemeral steps: lab:step:<sessionId>:<userId>:<dir>
    if (parts[1] === "step") {
      const userId = parts[3];
      const dir = parts[4];

      if (i.user.id !== userId) {
        try { await i.reply({ content: "That’s not your path to walk.", ephemeral: true }); } catch {}
        return;
      }

      // Make sure scoreboard has this player
      if (!playerMap.has(userId)) {
        playerMap.set(userId, { id: userId, username: i.user.username || "Player", points: 0 });
      }
      if (!state.has(userId)) state.set(userId, { step: 0, finished: false, points: 0, started: true });

      await handleProgress(i, userId, dir, false);
      return;
    }
  });

  return new Promise((resolve) => {
    collector.on('end', async () => {
      // Disable public buttons
      try { await startMsg.edit({ components: [] }); } catch {}

      // Tally & post verdict
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

      resolve(); // ✅ Now runLabyrinthAdventure waits until verdict is posted
    });
  });
}
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
  .setColor(0xff33cc);

if (miniGame.image) {
  embed.setImage(miniGame.image);
}

  const row = new ActionRowBuilder().addComponents(
    miniGame.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`choice${idx + 1}`)
        .setLabel(label)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][idx % 4])
    )
  );

  await channel.send({ embeds: [embed], components: [row] });

  setTimeout(() => channel.send("⏳ 25 seconds left...").catch(() => {}), 10000);
  setTimeout(() => channel.send("⏳ 15 seconds left...").catch(() => {}), 25000);
  setTimeout(() => channel.send("🎲 Time’s up. The charm decides.").catch(() => {}), 40000);

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

  await wait(46000);
  collector.stop();

  await channel.send(`🧮 Mini-game complete. Round ${round} points have been applied.`);
  await wait(5000);

  // === Riddle Phase ===
  await runRiddlePoints(playerMap, channel);
  await wait(5000);

  // ⬇️ INSERT: Intermission mini-adventure after Round 3's riddle
  if (round === 3) {
    await channel.send("🌫️ The floor tilts… a hush falls over the Squigs.");
    await runLabyrinthAdventure(channel, playerMap); // 60s self-contained event
    await wait(2000);
  }

  round++;


  // === RISK IT PHASE BEFORE FINAL ROUND ===
  if (round === 10) {
    await channel.send("🪙 The charm leans in… a chance to **Risk It** before the final chaos.");
    await runRiskItPhase(channel, playerMap);
    await wait(3000);
  }

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

  // clean up per game
  activeGame = null;
  usedMiniGameIndices.clear();
  usedRiddleIndices.clear();
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

  if (miniGame.image) {
    roundIntro.setImage(miniGame.image);
  }

  await channel.send({ embeds: [roundIntro] });
  await wait(5000); // give time to read lore

  // === MINI-GAME CHALLENGE EMBED ===
  const challengeEmbed = new EmbedBuilder()
    .setTitle(`🎲 MINI-GAME CHALLENGE — ${miniGame.title}`)
    .setDescription(`${miniGame.lore}\n⏳ You have 30 seconds to decide.`)
    .setColor(0xff33cc);

  if (miniGame.image) {
    challengeEmbed.setImage(miniGame.image);
  }

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
setTimeout(() => channel.send("⏳ 30 seconds left...").catch(() => {}), 15000);
setTimeout(() => channel.send("⏳ 10 seconds left...").catch(() => {}), 35000);
setTimeout(() => channel.send("🎲 Time’s up. The charm decides.").catch(() => {}), 45000);


  const collector = channel.createMessageComponentCollector({ componentType: 2, time: 45000 });
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
async function runRiskItPhase(channel, playerMap) {
  // Build intro
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
    .setImage(getUglyImageUrl());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("risk_all").setLabel("Risk All").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("risk_half").setLabel("Risk Half").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("risk_quarter").setLabel("Risk Quarter").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("risk_none").setLabel("No Risk").setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [intro], components: [row] });

  // Track choices
  const entrants = new Map(); // userId -> { stake, choiceLabel }
  const optedOut = new Set();
  const seen = new Set();

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 20000
  });

  collector.on("collect", async (i) => {
    if (i.user.bot) return;

    if (seen.has(i.user.id)) {
      return i.reply({ content: "You already locked a choice.", flags: 64 });
    }

    // Ensure player exists
    if (!playerMap.has(i.user.id)) {
      return i.reply({ content: "You’re not on the scoreboard yet — join a round first!", flags: 64 });
    }
    const player = playerMap.get(i.user.id);
    const pts = Math.floor(player.points || 0);

    // Compute stake per button
    let stake = 0;
    let label = "";

    switch (i.customId) {
      case "risk_all":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = pts;
        label = "Risk All";
        break;
      case "risk_half":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = Math.max(1, Math.floor(pts / 2));
        label = "Risk Half";
        break;
      case "risk_quarter":
        if (pts <= 0) return i.reply({ content: "You need **positive points** to risk them.", flags: 64 });
        stake = Math.max(1, Math.floor(pts / 4));
        label = "Risk Quarter";
        break;
      case "risk_none":
        optedOut.add(i.user.id);
        seen.add(i.user.id);
        return i.reply({ content: "You sit out. The charm respects cautious cowards. (Sometimes.)", flags: 64 });
    }

    entrants.set(i.user.id, { stake, choiceLabel: label });
    seen.add(i.user.id);
    return i.reply({ content: `Locked: **${label}** (Stake: ${stake} point${stake === 1 ? "" : "s"})`, flags: 64 });
  });

  // Mid-timer nudge
  setTimeout(() => channel.send("⏳ 10 seconds left to **Risk It**...").catch(() => {}), 10000);

  // Wrap-up
  await new Promise((res) => collector.on("end", res));

  // Disable buttons
  try {
    await msg.edit({ components: [new ActionRowBuilder().addComponents(
      row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
    )] });
  } catch {}

  if (entrants.size === 0) {
    await channel.send("😴 No one dared. The charm yawns and moves on.");
    return;
  }

  // Outcomes: net change relative to stake
  const outcomes = [
    { key: "lose", mult: -1, label: "💀 Lost it all", lore: "The charm nibbles your points like day-old fries." },
    { key: "even", mult: 0,  label: "😮 Broke even",  lore: "Static fizzles; the charm shrugs. Nothing gained, nothing lost." },
    { key: "x1_5", mult: 0.5, label: "✨ Won 1.5×",    lore: "A bright hiss in the air. Luck tastes like ozone." },
    { key: "double", mult: 1, label: "👑 Doubled",     lore: "The charm purrs. Reality briefly applauds." }
  ];

  // Build results
  const lines = [];
  for (const [userId, { stake, choiceLabel }] of entrants.entries()) {
    const player = playerMap.get(userId);
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    // Net delta: -S, 0, +0.5S, +1S
    let delta = outcome.mult === -1 ? -stake : Math.round(stake * outcome.mult);
    player.points = (player.points || 0) + delta;

    const sign = delta > 0 ? "+" : "";
    lines.push(
      `<@${userId}> • **${choiceLabel}** (staked ${stake}) → ${outcome.label} ` +
      `• **${sign}${delta}** • new total: **${player.points}**\n_${outcome.lore}_`
    );
  }

  const resEmbed = new EmbedBuilder()
    .setTitle("🧮 Risk It — Results")
    .setDescription(lines.join("\n\n"))
    .setColor(0xff66cc);

  await channel.send({ embeds: [resEmbed] });
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
