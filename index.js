// === GAUNTLET: SOLO MODE (Ephemeral In-Channel) — Postgres + Monthly Leaderboard (best score; total points tiebreak) ===
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes
} = require('discord.js');

const { Pool } = require('pg');

// ====== ENV ======
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // application (client) id
const GUILD_IDS = (process.env.GUILD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const GAUNTLET_RESET = (process.env.GAUNTLET_RESET || 'true').toLowerCase() === 'true'; // drop & recreate tables on boot

// ====== DB (Postgres only) ======
class PgStore {
  constructor(){
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: getSSL() });
  }
  async init(){
    if (GAUNTLET_RESET) {
      await this.pool.query(`
        DROP TABLE IF EXISTS gauntlet_scores;
        DROP TABLE IF EXISTS gauntlet_plays;
        DROP TABLE IF EXISTS gauntlet_daily;
        DROP TABLE IF EXISTS gauntlet_runs;
        DROP TABLE IF EXISTS gauntlet_lb_messages;
      `);
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_runs (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        month TEXT NOT NULL,
        score INTEGER NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_daily (
        user_id TEXT NOT NULL,
        play_date DATE NOT NULL,
        PRIMARY KEY (user_id, play_date)
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gauntlet_lb_messages (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        month TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id, month)
      );
    `);
  }
  async recordPlay(userId, dateStr){
    await this.pool.query(`INSERT INTO gauntlet_daily(user_id, play_date) VALUES($1, $2) ON CONFLICT DO NOTHING`, [userId, dateStr]);
  }
  async hasPlayed(userId, dateStr){
    const r = await this.pool.query(`SELECT 1 FROM gauntlet_daily WHERE user_id=$1 AND play_date=$2 LIMIT 1`, [userId, dateStr]);
    return r.rowCount > 0;
  }
  async insertRun(userId, username, month, score){
    await this.pool.query(`INSERT INTO gauntlet_runs(user_id, username, month, score) VALUES ($1,$2,$3,$4)`, [userId, username, month, score]);
  }
  async getMonthlyTop(month, limit=10){
    const r = await this.pool.query(`
      SELECT user_id, MAX(username) AS username, MAX(score) AS best, SUM(score) AS total
      FROM gauntlet_runs
      WHERE month=$1
      GROUP BY user_id
      ORDER BY best DESC, total DESC, username ASC
      LIMIT $2
    `,[month, limit]);
    return r.rows;
  }
  async getRecentRuns(month, limit=10){
    const r = await this.pool.query(`
      SELECT user_id, username, score, finished_at
      FROM gauntlet_runs
      WHERE month=$1
      ORDER BY finished_at DESC
      LIMIT $2
    `,[month, limit]);
    return r.rows;
  }
  async upsertLbMessage(guildId, channelId, month, messageId){
    await this.pool.query(`
      INSERT INTO gauntlet_lb_messages(guild_id, channel_id, month, message_id)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (guild_id, channel_id, month)
      DO UPDATE SET message_id = EXCLUDED.message_id
    `,[guildId, channelId, month, messageId]);
  }
  async getLbMessages(month){
    const r = await this.pool.query(`SELECT guild_id, channel_id, message_id FROM gauntlet_lb_messages WHERE month=$1`,[month]);
    return r.rows;
  }
  async getMyMonth(userId, month){
    const r = await this.pool.query(`
      SELECT COALESCE(MAX(score),0) AS best, COALESCE(SUM(score),0) AS total, COUNT(*) AS plays
      FROM gauntlet_runs
      WHERE user_id=$1 AND month=$2
    `,[userId, month]);
    return r.rows[0] || { best:0, total:0, plays:0 };
  }
}

function getSSL(){
  if (!process.env.DATABASE_URL) return undefined;
  return process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false };
}

const Store = new PgStore();

// ====== CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Admins who can post the Start Panel
const AUTHORIZED_ADMINS = (process.env.GAUNTLET_ADMINS || '826581856400179210,1288107772248064044')
  .split(',').map(s=>s.trim());

// ====== UTILS ======
const wait = (ms)=> new Promise(r=>setTimeout(r,ms));
const rand = (arr)=> arr[Math.floor(Math.random()*arr.length)];

function torontoDateStr(d=new Date()){
  return new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
}
function currentMonthStr(d=new Date()){
  const parts = new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Toronto', year:'numeric', month:'2-digit' }).formatToParts(d);
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  return `${y}-${m}`;
}
function nextTorontoMidnight(){
  const fmt = new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'});
  const [y,m,d] = fmt.format(new Date()).split('-').map(Number);
  // Approximate next midnight Toronto local for display purposes
  const next = new Date(Date.UTC(y, m-1, d+1, 4, 0, 0)); // buffer for TZ offset
  return new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Toronto', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(next);
}
function getMonsterImageUrl() {
  const tokenId = Math.floor(Math.random() * 126) + 1;
  return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}
function withScore(embed, player){
  try { return embed.setFooter({ text: `Current score: ${player.points}` }); }
  catch { return embed; }
}

// === Mini-Game Lore Pools & Flavor (FULL) ===
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
  },
  {
    title: "🪁 Ugly Monster Windstorm",
    lore: "The Monster charges in holding a giant kite made of trash bags and noodles. The wind rips it free, sending debris everywhere. You can only grab one thing before it’s gone forever.",
    buttons: ["Flying Shoe", "Noodle Kite", "Crumpled Note", "Monster's Wig"],
    image: "https://i.imgur.com/zCvzLBj.jpeg"
  },
  {
    title: "🎨 Ugly Monster Art Class",
    lore: "The Monster sets up easels, splashing paint on the floor and occasionally on Squigs. It insists you “make art,” but the supplies are… unusual.",
    buttons: ["Crayon Stub", "Mud Brush", "Glitter Bomb", "Soggy Canvas"],
    image: "https://i.imgur.com/5GrVfwD.jpeg"
  },
  {
    title: "🚀 Ugly Monster Space Trip",
    lore: "The Monster unveils a cardboard rocket, duct-taped together and leaking slime. It waves for you to choose a seat. Some look comfy, others… less so.",
    buttons: ["Pilot Seat", "Middle Seat", "Cargo Hold", "Roof Seat"],
    image: "https://i.imgur.com/4kGMixf.jpeg"
  },
  {
    title: "🍉 Ugly Monster Picnic",
    lore: "The Monster flops onto a checkered blanket, unpacking a basket of questionable snacks: pickle cupcakes, spaghetti milkshakes, and glowing fruit that hums. It waves at you to dig in. Some bites might be sweet, some sour, and one may never leave your stomach. The Squigs are already drooling.",
    buttons: ["Glowing Fruit", "Pickle Cupcake", "Spaghetti Milkshake", "Mystery Sandwich"],
    image: "https://i.imgur.com/jFnYqcm.jpeg"
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

// === Riddles (EXPANDED: 50 per tier) ===
const riddles = [
  // EASY (1) — 50
  { riddle: "I have keys but no locks, a space but no room, and you can enter but not go inside. What am I?", answers: ["keyboard"], difficulty: 1 },
  { riddle: "What has an eye but cannot see?", answers: ["needle"], difficulty: 1 },
  { riddle: "What has to be broken before you can use it?", answers: ["egg"], difficulty: 1 },
  { riddle: "What is full of holes but still holds water?", answers: ["sponge"], difficulty: 1 },
  { riddle: "What is always in front of you but can’t be seen?", answers: ["future"], difficulty: 1 },
  { riddle: "What has a neck but no head?", answers: ["bottle", "shirt", "blouse"], difficulty: 1 },
  { riddle: "What can you catch but not throw?", answers: ["cold", "a cold"], difficulty: 1 },
  { riddle: "I have mountains but no trees, and oceans but no water. What am I?", answers: ["map"], difficulty: 1 },
  { riddle: "What is so fragile that saying its name breaks it?", answers: ["silence"], difficulty: 1 },
  { riddle: "What has a thumb and four fingers but is not alive?", answers: ["glove", "mitten"], difficulty: 1 },
  { riddle: "What word is spelled wrong in every dictionary?", answers: ["wrong"], difficulty: 1 },
  { riddle: "What goes up but never comes down?", answers: ["age"], difficulty: 1 },
  { riddle: "What can travel around the world while staying in a corner?", answers: ["stamp"], difficulty: 1 },
  { riddle: "What has to be paid but uses no money?", answers: ["attention"], difficulty: 1 },
  { riddle: "What has no voice but can tell you a story?", answers: ["book"], difficulty: 1 },
  { riddle: "What do you throw away when you need it and take in when you don’t?", answers: ["anchor"], difficulty: 1 },
  { riddle: "What has a tongue but cannot talk?", answers: ["shoe", "boot", "sneaker"], difficulty: 1 },
  { riddle: "What gets wetter the more it dries?", answers: ["towel"], difficulty: 1 },
  { riddle: "What belongs to you but other people use more?", answers: ["name"], difficulty: 1 },
  { riddle: "What has hands but can’t clap?", answers: ["clock", "watch"], difficulty: 1 },
  { riddle: "What has a face and two hands but no arms or legs?", answers: ["clock", "watch"], difficulty: 1 },
  { riddle: "What can fill a room but takes up no space?", answers: ["light"], difficulty: 1 },
  { riddle: "What runs but never walks?", answers: ["water", "river", "nose"], difficulty: 1 },
  { riddle: "What has ears but cannot hear?", answers: ["cornfield", "corn field", "corn"], difficulty: 1 },
  { riddle: "What has many teeth but cannot bite?", answers: ["comb"], difficulty: 1 },
  { riddle: "What gets bigger when turned upside down?", answers: ["nine", "6", "six"], difficulty: 1 },
  { riddle: "What can you hold without ever touching it?", answers: ["breath", "your breath"], difficulty: 1 },
  { riddle: "What kind of room has no doors or windows?", answers: ["mushroom"], difficulty: 1 },
  { riddle: "What has one head, one foot, and four legs?", answers: ["bed"], difficulty: 1 },
  { riddle: "Where does today come before yesterday?", answers: ["dictionary"], difficulty: 1 },
  { riddle: "What kind of coat is best put on wet?", answers: ["paint"], difficulty: 1 },
  { riddle: "What can be cracked, made, told, and played?", answers: ["joke"], difficulty: 1 },
  { riddle: "I shave every day, but my beard stays the same. Who am I?", answers: ["barber"], difficulty: 1 },
  { riddle: "If you drop me I’m sure to crack, but smile at me and I’ll smile back. What am I?", answers: ["mirror"], difficulty: 1 },
  { riddle: "What begins with T, ends with T, and has T in it?", answers: ["teapot", "tea pot"], difficulty: 1 },
  { riddle: "What can you keep after giving it to someone?", answers: ["word", "promise"], difficulty: 1 },
  { riddle: "The more of me there is, the less you see. What am I?", answers: ["darkness", "fog"], difficulty: 1 },
  { riddle: "What has legs but doesn’t move?", answers: ["table"], difficulty: 1 },
  { riddle: "What is made of water but if you put it into water it dies?", answers: ["ice"], difficulty: 1 },
  { riddle: "What can you break without touching it?", answers: ["promise", "silence"], difficulty: 1 },
  { riddle: "I’m tall when I’m young and short when I’m old. What am I?", answers: ["candle"], difficulty: 1 },
  { riddle: "What has a head and a tail but no body?", answers: ["coin"], difficulty: 1 },
  { riddle: "What building has the most stories?", answers: ["library"], difficulty: 1 },
  { riddle: "What kind of tree can you carry in your hand?", answers: ["palm"], difficulty: 1 },
  { riddle: "What can you hear but not see or touch, even though you control it?", answers: ["voice"], difficulty: 1 },
  { riddle: "What gets sharper the more you use it?", answers: ["brain", "mind"], difficulty: 1 },
  { riddle: "What invention lets you look right through a wall?", answers: ["window"], difficulty: 1 },
  { riddle: "What has many keys but can’t open a door?", answers: ["piano", "keyboard"], difficulty: 1 },
  { riddle: "If you have me, you want to share me. Once you share me, you don’t have me. What am I?", answers: ["secret"], difficulty: 1 },
  { riddle: "What has four fingers and a thumb but isn’t alive?", answers: ["glove", "mitten"], difficulty: 1 },

  // MEDIUM (2) — 50
  { riddle: "I can be long or short, made or told, but I cannot be seen. What am I?", answers: ["story", "joke", "tale"], difficulty: 2 },
  { riddle: "I have no life, but I can die. What am I?", answers: ["battery"], difficulty: 2 },
  { riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?", answers: ["m", "letter m", "the letter m"], difficulty: 2 },
  { riddle: "I get bigger the more you take away. What am I?", answers: ["hole"], difficulty: 2 },
  { riddle: "I speak without a mouth and hear without ears. What am I?", answers: ["echo"], difficulty: 2 },
  { riddle: "What has a bed but never sleeps, and runs but never walks?", answers: ["river"], difficulty: 2 },
  { riddle: "What is black when you get it, red when you use it, and gray when you’re done?", answers: ["charcoal", "coal"], difficulty: 2 },
  { riddle: "What loses its head in the morning but gets it back at night?", answers: ["pillow"], difficulty: 2 },
  { riddle: "I can be big or small, round or square, and you can drink me in a cup or a glass. What am I?", answers: ["ice"], difficulty: 2 },
  { riddle: "What can be measured but has no length, width, or height?", answers: ["time"], difficulty: 2 },
  { riddle: "What do you break even when you never pick it up or touch it?", answers: ["promise"], difficulty: 2 },
  { riddle: "What has cities, but no houses; forests, but no trees; and water, but no fish?", answers: ["map"], difficulty: 2 },
  { riddle: "The more there is, the less you see. What is it?", answers: ["fog", "darkness"], difficulty: 2 },
  { riddle: "What begins with E, ends with E, but contains only one letter?", answers: ["envelope"], difficulty: 2 },
  { riddle: "What can be served but never eaten?", answers: ["tennis ball", "justice", "court"], difficulty: 2 },
  { riddle: "What has many rings but no fingers?", answers: ["tree", "tree trunk"], difficulty: 2 },
  { riddle: "I fly without wings and cry without eyes. What am I?", answers: ["cloud"], difficulty: 2 },
  { riddle: "I’m taken from a mine and shut in a wooden case, from which I’m never released, and yet I’m used by almost every person. What am I?", answers: ["pencil lead", "graphite", "lead"], difficulty: 2 },
  { riddle: "I have branches, but no fruit, trunk, or leaves. What am I?", answers: ["bank"], difficulty: 2 },
  { riddle: "What is always coming, but never arrives?", answers: ["tomorrow"], difficulty: 2 },
  { riddle: "I’m not alive, but I grow; I don’t have lungs, but I need air; I don’t have a mouth, but water kills me. What am I?", answers: ["fire"], difficulty: 2 },
  { riddle: "What has wheels and flies, but is not an aircraft?", answers: ["garbage truck", "trash truck"], difficulty: 2 },
  { riddle: "What has one eye but is completely blind?", answers: ["needle", "hurricane", "storm"], difficulty: 2 },
  { riddle: "What can you catch but not throw (besides a cold)?", answers: ["feelings", "love"], difficulty: 2 },
  { riddle: "I’m there at the start of eternity and the end of time and space. I’m essential to creation and I surround every place. What am I?", answers: ["e", "letter e", "the letter e"], difficulty: 2 },
  { riddle: "What is so light that even a feather can’t hold it for long?", answers: ["breath"], difficulty: 2 },
  { riddle: "I can be cracked, I can be made, I can be told, I can be played. What am I?", answers: ["joke"], difficulty: 2 },
  { riddle: "Forward I am heavy, backward I am not. What am I?", answers: ["ton"], difficulty: 2 },
  { riddle: "What begins with P, ends with E, and has thousands of letters?", answers: ["post office", "postoffice"], difficulty: 2 },
  { riddle: "What has many needles but doesn’t sew?", answers: ["pine tree", "pine"], difficulty: 2 },
  { riddle: "What can be seen once in a year, twice in a moment, and never in a thousand years?", answers: ["m", "letter m", "the letter m"], difficulty: 2 },
  { riddle: "What flies when it’s born, lies when it’s alive, and runs when it’s dead?", answers: ["snowflake", "snow"], difficulty: 2 },
  { riddle: "What is easy to lift but hard to throw?", answers: ["feather"], difficulty: 2 },
  { riddle: "I start with M, end with X, and have a never-ending amount of letters. What am I?", answers: ["mailbox", "mail box"], difficulty: 2 },
  { riddle: "I’m light as a feather yet even the strongest person can’t hold me more than a few minutes. What am I?", answers: ["breath"], difficulty: 2 },
  { riddle: "What has a head, a tail, is brown, and has no legs?", answers: ["penny", "coin", "cent"], difficulty: 2 },
  { riddle: "I am an odd number. Take away a letter and I become even. What number am I?", answers: ["seven", "7"], difficulty: 2 },
  { riddle: "I have lakes with no water, mountains with no stone, and cities with no buildings. What am I?", answers: ["map"], difficulty: 2 },
  { riddle: "The person who makes it, sells it. The person who buys it never uses it. What is it?", answers: ["coffin"], difficulty: 2 },
  { riddle: "What tastes better than it smells?", answers: ["tongue"], difficulty: 2 },
  { riddle: "I go all around the world but always stay in a corner. What am I?", answers: ["stamp"], difficulty: 2 },
  { riddle: "What has a heart that doesn’t beat?", answers: ["artichoke", "lettuce"], difficulty: 2 },
  { riddle: "What is so fragile that just speaking it breaks it?", answers: ["silence"], difficulty: 2 },
  { riddle: "What five-letter word becomes shorter when you add two letters to it?", answers: ["short"], difficulty: 2 },
  { riddle: "What starts with a T, ends with a T, and is full of T?", answers: ["teapot", "tea pot"], difficulty: 2 },
  { riddle: "What can run but never walks, has a mouth but never talks, has a head but never weeps, has a bed but never sleeps?", answers: ["river"], difficulty: 2 },
  { riddle: "You see me once in June, twice in November, but not at all in May. What am I?", answers: ["e", "letter e", "the letter e"], difficulty: 2 },
  { riddle: "What do you bury when it is alive and dig up when it is dead?", answers: ["plant", "seed"], difficulty: 2 },
  { riddle: "What has many words but never speaks?", answers: ["book", "dictionary"], difficulty: 2 },

  // HARD (3) — 50
  { riddle: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", answers: ["map"], difficulty: 3 },
  { riddle: "Throw away the outside and cook the inside, then eat the outside and throw away the inside. What is it?", answers: ["corn on the cob", "corn"], difficulty: 3 },
  { riddle: "I have no voice, and yet I speak to you. I tell of all things in the world that people do. What am I?", answers: ["book"], difficulty: 3 },
  { riddle: "I am always hungry, I must always be fed. The finger I touch will soon turn red. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "A box without hinges, key, or lid, yet golden treasure inside is hid. What am I?", answers: ["egg"], difficulty: 3 },
  { riddle: "The more you take, the more you leave behind. What am I?", answers: ["footsteps", "steps"], difficulty: 3 },
  { riddle: "I am not alive, but I grow; I don’t have lungs, but I need air; I don’t have a mouth, and I’m killed by water. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "What has an ear but cannot hear, a tongue but cannot taste, and a soul but cannot die?", answers: ["shoe"], difficulty: 3 },
  { riddle: "I can be cracked, I can be made, I can be told, I can be played; I can be dry, but I’m often wet. What am I?", answers: ["joke"], difficulty: 3 },
  { riddle: "I am lighter than a feather, yet the strongest person can’t hold me for much more than a minute. What am I?", answers: ["breath"], difficulty: 3 },
  { riddle: "If you feed me, I live; if you water me, I die. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "I can only live where there is light, but I die if the light shines on me. What am I?", answers: ["shadow"], difficulty: 3 },
  { riddle: "I am the beginning of the end and the end of time and space. I am essential to creation. What am I?", answers: ["e", "letter e", "the letter e"], difficulty: 3 },
  { riddle: "You measure my life in hours and I serve you by expiring. I’m quick when I’m thin and slow when I’m fat. What am I?", answers: ["candle"], difficulty: 3 },
  { riddle: "I have a heart that doesn’t beat, a face that doesn’t smile, and a soul that doesn’t rest. What am I?", answers: ["artichoke", "statue"], difficulty: 3 },
  { riddle: "I can fly without wings. I can cry without eyes. Wherever I go, darkness follows me. What am I?", answers: ["cloud"], difficulty: 3 },
  { riddle: "The one who makes me doesn’t want me; the one who buys me doesn’t use me; the one who uses me doesn’t know it. What am I?", answers: ["coffin"], difficulty: 3 },
  { riddle: "I have keys but open no locks, I have space but no room, you can enter but not go in. What am I?", answers: ["keyboard"], difficulty: 3 },
  { riddle: "What walks on four legs in the morning, two legs at noon, and three legs in the evening?", answers: ["human", "man", "a man"], difficulty: 3 },
  { riddle: "I can run but never walk; wherever I go, thought follows close behind. What am I?", answers: ["nose"], difficulty: 3 },
  { riddle: "Alive without breath, as cold as death; never thirsty, ever drinking; all in mail, never clinking. What am I?", answers: ["fish"], difficulty: 3 },
  { riddle: "I am taken from a mine and shut up in a wooden case, from which I am never released, and yet I am used by everyone. What am I?", answers: ["pencil lead", "graphite"], difficulty: 3 },
  { riddle: "I have a head, a tail, am brown, and have no legs. What am I?", answers: ["penny", "cent"], difficulty: 3 },
  { riddle: "If you look at the numbers on my face you won’t find 13 anyplace. What am I?", answers: ["clock", "watch"], difficulty: 3 },
  { riddle: "I bind the wind, yet the wind binds me. What am I?", answers: ["sail", "sailboat sail"], difficulty: 3 },
  { riddle: "I am the hole in a ring, the space in a cage, the target of aim. What am I?", answers: ["nothing", "air", "space"], difficulty: 3 },
  { riddle: "What has a tongue that can’t taste, eyes that can’t see, and a soul that can’t die?", answers: ["shoe"], difficulty: 3 },
  { riddle: "I am a king yet wear no crown; I run the realm but have no throne. I rise and fall without a sound. What am I?", answers: ["tide", "ocean tide"], difficulty: 3 },
  { riddle: "It cannot be seen, cannot be felt, cannot be heard, cannot be smelt. It lies behind stars and under hills, and empty holes it fills. What is it?", answers: ["darkness", "dark"], difficulty: 3 },
  { riddle: "I turn once, what is out will not get in. I turn again, what is in will not get out. What am I?", answers: ["key"], difficulty: 3 },
  { riddle: "Feed me and I live, give me a drink and I die. What am I?", answers: ["fire"], difficulty: 3 },
  { riddle: "I have teeth but cannot bite; I’m often used at night. What am I?", answers: ["zipper", "comb"], difficulty: 3 },
  { riddle: "I am always running, yet I have no legs. You always need me, yet I never eat. What am I?", answers: ["water", "nose", "time"], difficulty: 3 },
  { riddle: "Tear one off and scratch my head; what once was red is black instead. What am I?", answers: ["match", "matchstick"], difficulty: 3 },
  { riddle: "I can be written, I can be spoken, I can be exposed, I can be broken. What am I?", answers: ["news", "silence", "secret"], difficulty: 3 },
  { riddle: "The more I dry, the wetter I get. What am I?", answers: ["towel"], difficulty: 3 },
  { riddle: "If you have me, you want to share me. If you share me, you don’t have me. What am I?", answers: ["secret"], difficulty: 3 },
  { riddle: "I have a tail, and I have a head, but I have no body. I am NOT a snake. What am I?", answers: ["coin"], difficulty: 3 },
  { riddle: "I go up and down the stairs without moving. What am I?", answers: ["carpet", "staircase", "rail"], difficulty: 3 },
  { riddle: "I have an end but no beginning, a home but no family, a space without a room. What am I?", answers: ["road"], difficulty: 3 },
  { riddle: "I am a portal without door or hinge. I open to anything and close to none. What am I?", answers: ["imagination", "mind"], difficulty: 3 },
  { riddle: "What can bring back the dead, make us cry, make us laugh, make us young; is born in an instant, yet lasts a lifetime?", answers: ["memory", "memories"], difficulty: 3 },
  { riddle: "I am the mother of all languages, spoken by none. What am I?", answers: ["silence"], difficulty: 3 },
  { riddle: "I’m the beginning of the end, and the end of every place. I’m the beginning of eternity, the end of time and space. What am I?", answers: ["e", "letter e", "the letter e"], difficulty: 3 },
  { riddle: "What room do ghosts avoid?", answers: ["living room", "the living room"], difficulty: 3 },
  { riddle: "What flies forever, rests never?", answers: ["time"], difficulty: 3 },
  { riddle: "I am sometimes found underground, sometimes on a finger, sometimes floating in the sky. What am I?", answers: ["ring"], difficulty: 3 },
  { riddle: "What has roots that nobody sees, is taller than trees, up, up it goes and yet never grows?", answers: ["mountain"], difficulty: 3 },

  // SQUIG SPECIAL (4) — 50 (Ugly Labs / Squig lore)
  { riddle: "The vending machine dispenses a Squig’s favorite snack, shaped like a wobbly cloud. What flavor is it?", answers: ["banana"], difficulty: 4 },
  { riddle: "The portal watcher only accepts one cookie as a toll. Which one?", answers: ["chocolate chip", "choc chip", "chocolate-chip"], difficulty: 4 },
  { riddle: "A humming button sings a single word when pressed. What word?", answers: ["soup"], difficulty: 4 },
  { riddle: "To cheer up the grumpy Squig, you tell a joke. What’s the punchline?", answers: ["burp"], difficulty: 4 },
  { riddle: "Upside-down coffee requires the proper spoon. Which tool works best?", answers: ["wooden", "wooden spoon", "spatula"], difficulty: 4 },
  { riddle: "The charm hums when a particular color-pattern is near. Which one?", answers: ["plaid"], difficulty: 4 },
  { riddle: "Squig socks are inside out. What pattern is on the bottoms?", answers: ["polka dots", "polkadots", "dots", "stripes"], difficulty: 4 },
  { riddle: "The old teapot steeps only one aroma. What does it smell like?", answers: ["whiskey", "stinky"], difficulty: 4 },
  { riddle: "In the Lab’s fridge, there’s one jar that never molds. What’s inside?", answers: ["pickles", "pickle"], difficulty: 4 },
  { riddle: "A Squig librarian stamps books with a single letter. Which letter?", answers: ["s"], difficulty: 4 },
  { riddle: "The charm chooses a lucky number for the day. Which number makes it purr?", answers: ["7", "seven"], difficulty: 4 },
  { riddle: "The Monster’s kite is tied with noodles. Which noodle works best?", answers: ["spaghetti"], difficulty: 4 },
  { riddle: "The arcade cabinet accepts only one coin that screams. Which coin?", answers: ["truth coin", "truth"], difficulty: 4 },
  { riddle: "A Squig chef salts everything with the same seasoning. What is it?", answers: ["glitter"], difficulty: 4 },
  { riddle: "An elevator in the vault moves only when you whisper a snack. Which snack?", answers: ["banana"], difficulty: 4 },
  { riddle: "The Labyrinth guard lets you pass if you offer a smell. Which smell?", answers: ["soup"], difficulty: 4 },
  { riddle: "A mirror shows your best self only if you grin a word. Which word?", answers: ["burp"], difficulty: 4 },
  { riddle: "The Squig Museum awards a ribbon for 'most average art'. What color is it?", answers: ["beige"], difficulty: 4 },
  { riddle: "A radio in the archive plays one station all day. What genre?", answers: ["static"], difficulty: 4 },
  { riddle: "The charm’s favorite sandwich is exactly one ingredient. Which?", answers: ["pickle", "pickles"], difficulty: 4 },
  { riddle: "A Squig fortune cookie always predicts one weather. Which?", answers: ["fog"], difficulty: 4 },
  { riddle: "The slime fountain changes color if you say a fruit. Which fruit?", answers: ["banana"], difficulty: 4 },
  { riddle: "To open the ‘Wiggly Door’, speak a texture. Which texture?", answers: ["sticky"], difficulty: 4 },
  { riddle: "The coin that lies prefers what side up?", answers: ["tails"], difficulty: 4 },
  { riddle: "A Squig calendar skips every day that starts with this letter. Which letter?", answers: ["t"], difficulty: 4 },
  { riddle: "The nap pod counts sheep but only one animal works. Which animal?", answers: ["goat"], difficulty: 4 },
  { riddle: "The charm’s lullaby is one syllable long. Which syllable?", answers: ["mmm"], difficulty: 4 },
  { riddle: "The vending machine jams unless you thank it in which language?", answers: ["burp"], difficulty: 4 },
  { riddle: "An umbrella in the Lab breaks in any weather but one. Which weather?", answers: ["fog"], difficulty: 4 },
  { riddle: "The portal’s password is a condiment. Which?", answers: ["mustard"], difficulty: 4 },
  { riddle: "A Squig eats cereal with a utensil that isn’t a spoon. Which?", answers: ["fork", "spork"], difficulty: 4 },
  { riddle: "The charm declares one vegetable as 'too handsome'. Which?", answers: ["eggplant", "aubergine"], difficulty: 4 },
  { riddle: "A hallway of teeth opens if you whisper a dessert. Which?", answers: ["pudding"], difficulty: 4 },
  { riddle: "The archive cube warms to one syllable. Which syllable?", answers: ["soup"], difficulty: 4 },
  { riddle: "Squig TV stops glitching if tuned to which show?", answers: ["cooking"], difficulty: 4 },
  { riddle: "The coin that screams calms down when flipped onto what?", answers: ["carpet", "rug"], difficulty: 4 },
  { riddle: "The Monster’s wig only sticks with which glue?", answers: ["honey"], difficulty: 4 },
  { riddle: "A riddle board pays double if you answer with which emotion?", answers: ["confident", "confidence"], difficulty: 4 },
  { riddle: "The soup of uncertainty pairs best with which bread?", answers: ["stale bread", "stale"], difficulty: 4 },
  { riddle: "The charm’s favorite season?", answers: ["spooky", "autumn", "fall"], difficulty: 4 },
  { riddle: "Which door hums back when you hum at it?", answers: ["green door", "green"], difficulty: 4 },
  { riddle: "The Squig librarian files screams under which letter?", answers: ["s"], difficulty: 4 },
  { riddle: "What flavor is 'definitely nothing'?", answers: ["vanilla", "nothing"], difficulty: 4 },
  { riddle: "Which chair in the Seat of Consequence is secretly polite?", answers: ["humming chair", "humming"], difficulty: 4 },
  { riddle: "The archive lamp turns on if you tell it your favorite…?", answers: ["soup"], difficulty: 4 },
  { riddle: "The charm gives bonus points if you blink this many times.", answers: ["3", "three"], difficulty: 4 },
  { riddle: "The portal’s favorite number pattern?", answers: ["palindrome"], difficulty: 4 },
  { riddle: "A Squig handshake is replaced with which sound?", answers: ["burp"], difficulty: 4 },
  { riddle: "The safest door is which color today?", answers: ["blue"], difficulty: 4 },
  { riddle: "The Lab’s cat answers only to which name?", answers: ["soup"], difficulty: 4 },
  { riddle: "The charm’s snack break is always at which time?", answers: ["noon", "12", "12:00"], difficulty: 4 },
];


// ====== PER-SESSION PICKERS ======
const pickRiddle = (usedSet)=>{
  const d = rand([1,2,3,4]);
  const pool = riddles.map((r,i)=>({...r,index:i})).filter(r=>r.difficulty===d && !usedSet.has(r.index));
  const avail = pool.length? pool : riddles.map((r,i)=>({...r,index:i})).filter(r=>!usedSet.has(r.index));
  if(!avail.length) return null;
  const chosen = rand(avail); usedSet.add(chosen.index); return chosen;
};
const pickMiniGame = (usedSet)=>{
  const avail = miniGameLorePool.map((g,i)=>({...g,index:i})).filter(g=>!usedSet.has(g.index));
  if(!avail.length){ usedSet.clear(); return pickMiniGame(usedSet); }
  const chosen = rand(avail); usedSet.add(chosen.index); return chosen;
};

// ====== EPHEMERAL HELPERS ======
// ====== EPHEMERAL HELPERS ======
async function sendEphemeral(interaction, payload){
  const { noExpire, ...rest } = payload;
  let msg;

  // use flags: 64 (ephemeral) to avoid deprecation warning
  const base = { ...rest, flags: 64, fetchReply: true };

  if (interaction.deferred || interaction.replied) {
    msg = await interaction.followUp(base);
  } else {
    msg = await interaction.reply(base);
  }

  if (!noExpire) {
    setTimeout(async () => { try { await msg.delete(); } catch {} }, 60_000);
  }
  return msg;
}



async function ephemeralPrompt(interaction, embed, components, timeMs){
  const msg = await sendEphemeral(interaction, { embeds:[embed], components });
  const replyMsg = msg instanceof Promise ? await msg : msg;
  const picked = await replyMsg.awaitMessageComponent({ componentType: ComponentType.Button, time: timeMs }).catch(()=>null);
  try {
    const rows = (components||[]).map(row => new ActionRowBuilder().addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true))));
    await replyMsg.edit({ components: rows });
  } catch {}
  return picked;
}

// ====== ROUNDS (Ephemeral in-channel) ======
async function runMiniGameEphemeral(interaction, player, usedMini){
  const selected = pickMiniGame(usedMini);

  const embed = withScore(
    new EmbedBuilder()
      .setTitle(selected.title)
      .setDescription(`${selected.lore}\n\n_${rand(miniGameFateDescriptions)}_\n\n⏳ You have **30 seconds** to choose.`)
      .setColor(0xff33cc),
    player
  );
  if (selected.image) embed.setImage(selected.image);

  const row = new ActionRowBuilder().addComponents(
    selected.buttons.map((label, i)=> new ButtonBuilder()
      .setCustomId(`mg:${Date.now()}:${i}`)
      .setLabel(label)
      .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][i%4]))
  );

  const click = await ephemeralPrompt(interaction, embed, [row], 30_000);
  if(!click){
    await sendEphemeral(interaction, { content:'⏰ Time’s up — no choice, no change.' });
    return;
  }

  const delta = rand([-2,-1,1,2]);
  player.points += delta;

  const flavorList = pointFlavors[delta>0?`+${delta}`:`${delta}`] || [];
  const flavor = flavorList.length ? rand(flavorList) : '';

  await click.reply({
    content: `You chose **${click.component.label}** → **${delta>0?'+':''}${delta}**. ${flavor}\n**New total:** ${player.points}`,
    ephemeral: true
  });

  // (intentionally no "Mini-game complete" follow-up)
}


async function runRiddleEphemeral(interaction, player, usedRiddle){
  const r = pickRiddle(usedRiddle);
  if(!r){
    await sendEphemeral(interaction,{content:'⚠️ No riddles left. Skipping.'});
    return;
  }

  const difficultyLabel =
    r.difficulty===1? 'EASY' :
    r.difficulty===2? 'MEDIUM' :
    r.difficulty===3? 'HARD' :
    'SQUIG SPECIAL';

  // 1) Show riddle (do NOT auto-expire this one until we finish the flow)
  const embed = withScore(
    new EmbedBuilder()
      .setTitle('🧠 RIDDLE TIME')
      .setDescription(`_${r.riddle}_\n\n🌀 Difficulty: **${difficultyLabel}** — Worth **+${r.difficulty}**.\n⏳ You have **30 seconds**.`)
      .setColor(0xff66cc),
    player
  );
  const answerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('riddle:answer').setLabel('Answer').setStyle(ButtonStyle.Primary)
  );

  const riddleMsg = await sendEphemeral(interaction, {
    embeds:[embed],
    components:[answerRow],
    noExpire: true  // <-- important: don't delete while modal is pending
  });

  const totalWindowMs = 30_000;
  const endAt = Date.now() + totalWindowMs;

  // 2) Wait for the Answer button (same user), within the window
  let buttonClick = null;
  try {
    buttonClick = await riddleMsg.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: totalWindowMs,
      filter: (i) => i.customId === 'riddle:answer' && i.user.id === interaction.user.id
    });
  } catch {/* timeout */}

  // Disable the Answer button (whatever happened)
  try {
    const disabled = new ActionRowBuilder().addComponents(
      answerRow.components.map(b => ButtonBuilder.from(b).setDisabled(true))
    );
    await riddleMsg.edit({ components:[disabled] });
  } catch {}

  // If they never clicked Answer → reveal and exit (blocks until now)
  if (!buttonClick) {
    await sendEphemeral(interaction, { content:`⏰ Time’s up! Correct answer: **${r.answers[0]}**.` });
    // clean up the riddle prompt after a short delay
    setTimeout(async ()=>{ try{ await riddleMsg.delete(); } catch{} }, 1_000);
    return;
  }

  // 3) Show modal and wait for submit ON THE BUTTON INTERACTION
  const remaining = Math.max(1_000, endAt - Date.now());
  const modal = new ModalBuilder().setCustomId('riddle:modal').setTitle('Your Answer');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('riddle:input').setLabel('Type your answer').setStyle(TextInputStyle.Short).setRequired(true)
  ));

  try { await buttonClick.showModal(modal); } catch {/* ignore if already open */ }

  let submit = null;
  try {
    // 🔒 Key change: scope to the button interaction (more reliable than client.awaitModalSubmit)
    submit = await buttonClick.awaitModalSubmit({
      time: remaining,
      filter: (i) => i.customId === 'riddle:modal' && i.user.id === interaction.user.id
    });
  } catch {/* timeout */}

  // 4) Grade OR timeout
  if (!submit) {
    await sendEphemeral(interaction, { content:`⏰ No answer submitted. Correct: **${r.answers[0]}**.` });
    setTimeout(async ()=>{ try{ await riddleMsg.delete(); } catch{} }, 1_000);
    return;
  }

  const ans = submit.fields.getTextInputValue('riddle:input').trim().toLowerCase();
  const correct = r.answers.map(a => a.toLowerCase()).includes(ans);

  try {
    if (correct) {
      player.points += r.difficulty;
      await submit.reply({ content:`✅ Correct! **+${r.difficulty}**. **Current total:** ${player.points}`, flags: 64 });
    } else {
      await submit.reply({ content:`❌ Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`, flags: 64 });
    }
  } catch {
    // Fallback if Discord says "unknown interaction" for the modal (rare)
    await sendEphemeral(interaction, {
      content: correct
        ? `✅ Correct! **+${r.difficulty}**. **Current total:** ${player.points}`
        : `❌ Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`
    });
  }

  // Now it's safe to clear the riddle prompt
  setTimeout(async ()=>{ try{ await riddleMsg.delete(); } catch{} }, 1_000);
}





async function runLabyrinthEphemeral(interaction, player){
  const title = '🌀 The Labyrinth of Wrong Turns';
  const dirPairs = [['Left','Right'],['Up','Down'],['Left','Down'],['Right','Up']];
  const correctPath = Array.from({length:4},(_,i)=> rand(dirPairs[i%dirPairs.length]));

  await sendEphemeral(interaction, {
    embeds:[ withScore(
      new EmbedBuilder()
        .setTitle(title)
        .setDescription('Find the exact **4-step** path.\n✅ Each step **+1**, 🏆 escape **+2**.\n⏳ **60s** total.')
        .setColor(0x7f00ff)
        .setImage('https://i.imgur.com/MA1CdEC.jpeg')
    , player) ]
  });

  let step=0, earned=0, alive=true; const deadline = Date.now()+60_000;
  while(alive && step<4){
    const pair = dirPairs[step%dirPairs.length];
    const row = new ActionRowBuilder().addComponents(
      pair.map((d,i)=> new ButtonBuilder().setCustomId(`lab:${step}:${i}`).setLabel(d).setStyle(ButtonStyle.Primary))
    );
    const prompt = await sendEphemeral(interaction, { content:`Labyrinth step **${step+1}** — choose:`, components:[row] });
    const msg = prompt instanceof Promise ? await prompt : prompt;
    const timeLeft = Math.max(0, deadline - Date.now());
    const click = await msg.awaitMessageComponent({ componentType: ComponentType.Button, time: timeLeft }).catch(()=>null);
    try { await msg.edit({ components:[ new ActionRowBuilder().addComponents(row.components.map(b=>ButtonBuilder.from(b).setDisabled(true))) ] }); } catch {}
    if(!click){ alive=false; break; }
    const label = click.component.label;
    if(label===correctPath[step]){ earned+=1; step+=1; await click.reply({ content:'✅ Correct step!', ephemeral:true }); }
    else { alive=false; await click.reply({ content:'💀 Dead end!', ephemeral:true }); }
  }
  if(step===4){ earned+=2; await sendEphemeral(interaction,{ content:`🏁 You escaped! **+${earned}**`}); }
  else if(earned>0){ await sendEphemeral(interaction,{ content:`🪤 You managed **${earned}** step${earned===1?'':'s'}.`}); }
  else { await sendEphemeral(interaction,{ content:'😵 Lost at the first turn. **0**.'}); }
  player.points += earned;
}

async function runRouletteEphemeral(interaction, player){
  const embed = withScore(
    new EmbedBuilder()
      .setTitle('🎲 Squig Roulette')
      .setDescription('Pick **1–6**. Roll at end. Match = **+2**, else **0**. **30s**.')
      .setColor(0x7f00ff)
      .setImage('https://i.imgur.com/BolGW1m.png')
  , player);
  const row1 = new ActionRowBuilder().addComponents([1,2,3].map(n=> new ButtonBuilder().setCustomId(`rou:${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)));
  const row2 = new ActionRowBuilder().addComponents([4,5,6].map(n=> new ButtonBuilder().setCustomId(`rou:${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)));
  const msg = await sendEphemeral(interaction, { embeds:[embed], components:[row1,row2] });
  const m = msg instanceof Promise ? await msg : msg;
  const click = await m.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000 }).catch(()=>null);
  try {
    const disable = (row)=> new ActionRowBuilder().addComponents(row.components.map(b=> ButtonBuilder.from(b).setDisabled(true)));
    await m.edit({ components:[disable(row1), disable(row2)] });
  } catch {}
  if(!click){ await sendEphemeral(interaction, { content:'😴 No pick. The die rolls away.'}); return; }
  const pick = Number(click.component.label);
  const rolled = 1 + Math.floor(Math.random()*6);
  if(pick===rolled){ player.points += 2; await click.reply({ content:`🎉 You picked **${pick}**. Rolled **${rolled}**. **+2**.`, ephemeral:true }); }
  else { await click.reply({ content:`You picked **${pick}**. Rolled **${rolled}**. No match.`, ephemeral:true }); }
}

async function runRiskItEphemeral(interaction, player){
  const embed = withScore(
    new EmbedBuilder()
      .setTitle('🪙 Risk It')
      .setDescription('Risk **All**, **Half**, **Quarter**, or **None**. **20s**.')
      .setColor(0xffaa00)
      .setImage('https://i.imgur.com/GHztzMk.png')
  , player);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('risk:all').setLabel('Risk All').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('risk:half').setLabel('Risk Half').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('risk:quarter').setLabel('Risk Quarter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('risk:none').setLabel('No Risk').setStyle(ButtonStyle.Success)
  );
  const msg = await sendEphemeral(interaction, { embeds:[embed], components:[row] });
  const m = msg instanceof Promise ? await msg : msg;
  const click = await m.awaitMessageComponent({ componentType: ComponentType.Button, time: 20_000 }).catch(()=>null);
  try { await m.edit({ components:[ new ActionRowBuilder().addComponents(row.components.map(b=>ButtonBuilder.from(b).setDisabled(true))) ] }); } catch {}
  if(!click){ await sendEphemeral(interaction, { content:'⏳ No decision — charm moves on.' }); return; }
  const pts = Math.floor(player.points||0);
  if(click.customId==='risk:none' || pts<=0){ await click.reply({ content: pts<=0? 'You have no points to risk.': 'Sitting out.', ephemeral:true }); return; }
  let stake=0, label='';
  if(click.customId==='risk:all'){ stake=pts; label='Risk All'; }
  if(click.customId==='risk:half'){ stake=Math.max(1,Math.floor(pts/2)); label='Risk Half'; }
  if(click.customId==='risk:quarter'){ stake=Math.max(1,Math.floor(pts/4)); label='Risk Quarter'; }
  const outcomes=[ {mult:-1,label:'💀 Lost it all'}, {mult:0,label:'😮 Broke even'}, {mult:0.5,label:'✨ Won 1.5×'}, {mult:1,label:'👑 Doubled'} ];
  const out = rand(outcomes); const delta = out.mult===-1? -stake : Math.round(stake*out.mult); player.points += delta;
  await click.reply({ content:`${label} → ${out.label}. **${delta>0?'+':''}${delta}**. New total: **${player.points}**`, ephemeral:true });
}

// ====== SOLO ORCHESTRATOR (6 rounds + 2 interludes, all ephemeral) ======
async function runSoloGauntletEphemeral(interaction){
  const player = { id: interaction.user.id, username: interaction.user.username || interaction.user.globalName || 'Player', points: 0 };
  const usedRiddle = new Set(); const usedMini = new Set();

await sendEphemeral(interaction, { 
  embeds:[ withScore(
    new EmbedBuilder().setTitle('⚔️ The Gauntlet — Solo Mode').setDescription('6 rounds. Brain, luck, chaos. Good luck!').setColor(0x00ccff)
  , player) ]
});


  // 1) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 2) Labyrinth
  await runLabyrinthEphemeral(interaction, player);

  // 3) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 4) Squig Roulette
  await runRouletteEphemeral(interaction, player);

  // 5) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 6) Risk It
  await runRiskItEphemeral(interaction, player);

  // Final + persist & refresh LB
  const final = player.points;
  const flavor = final >= 12
    ? "👑 The charm purrs. You wear the static like a crown."
    : final >= 6
      ? "💫 The Squigs nod in approval. You’ll be remembered by at least three of them."
      : final >= 0
        ? "🪵 You survived the weird. The weird survived you."
        : "💀 The void learned your name. It may return it later.";

await sendEphemeral(interaction, { 
  embeds:[ new EmbedBuilder().setTitle('🏁 Your Final Score').setDescription(`**${final}** point${final===1?'':'s'}`).setColor(0x00ff88) ],
  noExpire: true
});


  const month = currentMonthStr();
  await Store.insertRun(interaction.user.id, player.username, month, final);
  await Store.recordPlay(interaction.user.id, torontoDateStr());
  try { await updateAllLeaderboards(interaction.client, month); } catch{}
  return final;
}

// ====== LEADERBOARD RENDER/UPDATE ======
async function renderLeaderboardEmbed(month){
  const rows = await Store.getMonthlyTop(month, 10);
  const lines = rows.length
    ? rows.map((r,i)=> `**#${i+1}** ${r.username || `<@${r.user_id}>`} — **${r.best}**`).join('\n')
    : 'No runs yet.';
  return new EmbedBuilder()
    .setTitle(`🏆 Leaderboard — ${month}`)
    .setDescription(lines)
    .setFooter({ text: 'Ranked by highest single-game score; ties broken by total monthly points.' })
    .setColor(0x00ccff);
}
async function updateAllLeaderboards(client, month){
  const entries = await Store.getLbMessages(month);
  if(!entries.length) return;
  const embed = await renderLeaderboardEmbed(month);
  for(const e of entries){
    try{
      const ch = await client.channels.fetch(e.channel_id);
      const msg = await ch.messages.fetch(e.message_id);
      await msg.edit({ embeds:[embed] });
    }catch{}
  }
}

// ====== COMMAND REGISTRATION ======
async function registerCommands(){
  const commands = [
    new SlashCommandBuilder().setName('gauntlet').setDescription('Post the Gauntlet Start Panel in this channel (admins only).'),
    new SlashCommandBuilder().setName('gauntletlb').setDescription('Show the monthly leaderboard (best score per user, totals tie-break).')
      .addStringOption(o=> o.setName('month').setDescription('YYYY-MM (default: current)').setRequired(false)),
    new SlashCommandBuilder().setName('gauntletrecent').setDescription('Show recent runs this month')
      .addIntegerOption(o=> o.setName('limit').setDescription('How many (default 10)').setRequired(false)),
    new SlashCommandBuilder().setName('gauntletinfo').setDescription('How Solo Gauntlet works (rounds & rules).'),
    new SlashCommandBuilder().setName('mygauntlet').setDescription('Your current-month stats (best, total, plays).')
  ].map(c=>c.toJSON());
  const rest = new REST({ version:'10' }).setToken(TOKEN);
  if(GUILD_IDS.length){
    for(const gid of GUILD_IDS){ await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands }); }
  } else { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); }
}

function startPanelEmbed(){
  return new EmbedBuilder()
    .setTitle('🎮 The Gauntlet — Solo Mode')
    .setDescription([
      'Click **Start** to play privately via **ephemeral** messages in this channel.',
      'You can play **once per day** (Toronto time). Every run is **saved**. Monthly LB shows **best** per user (total points = tiebreaker).',
      '',
      '**Rounds (6):**',
      '1) MiniGame + Riddle',
      '2) The Labyrinth',
      '3) MiniGame + Riddle',
      '4) Squig Roulette',
      '5) MiniGame + Riddle',
      '6) Risk It',
    ].join('\n'))
    .setColor(0xaa00ff)
    .setImage("https://i.imgur.com/MKHosuC.png");  // static image now
}
function startPanelRow(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gauntlet:start').setLabel('Start').setStyle(ButtonStyle.Success)
  );
}
function isAdminUser(interaction){
  if (AUTHORIZED_ADMINS.includes(interaction.user.id)) return true;
  const member = interaction.member; if (!member || !interaction.inGuild()) return false;
  return member.permissions?.has(PermissionFlagsBits.ManageGuild) || member.permissions?.has(PermissionFlagsBits.Administrator);
}

// ====== EVENTS ======
client.once('ready', async ()=>{
  console.log(`✅ Logged in as ${client.user.tag}`);
  await Store.init();
  try { await registerCommands(); } catch(e){ console.warn('Command registration failed:', e.message); }
});

client.on('interactionCreate', async (interaction)=>{
  try {
    // /gauntlet (post panel)
    if (interaction.isChatInputCommand() && interaction.commandName==='gauntlet'){
      if(!isAdminUser(interaction)) return interaction.reply({ content:'⛔ Only admins can post the Gauntlet panel.', ephemeral:true });
      return interaction.reply({ embeds:[startPanelEmbed()], components:[startPanelRow()] });
    }
    // /gauntletlb
    if (interaction.isChatInputCommand() && interaction.commandName==='gauntletlb'){
      const month = interaction.options.getString('month') || currentMonthStr();
      const embed = await renderLeaderboardEmbed(month);
      const sent = await interaction.reply({ embeds:[embed], fetchReply:true });
      try { await Store.upsertLbMessage(interaction.guildId, interaction.channelId, month, sent.id); } catch{}
      return;
    }
    // /gauntletrecent
    if (interaction.isChatInputCommand() && interaction.commandName==='gauntletrecent'){
      const month = currentMonthStr();
      const limit = interaction.options.getInteger('limit') || 10;
      const rows = await Store.getRecentRuns(month, limit);
      const lines = rows.length
        ? rows.map(r=> `• <@${r.user_id}> — **${r.score}**  _(at ${new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Toronto', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(r.finished_at))})_`).join('\n')
        : 'No recent runs.';
      const embed = new EmbedBuilder().setTitle(`🧾 Recent Runs — ${month}`).setDescription(lines).setColor(0x00ccff);
      return interaction.reply({ embeds:[embed] });
    }
    // /gauntletinfo
    if (interaction.isChatInputCommand() && interaction.commandName==='gauntletinfo'){
      const embed = new EmbedBuilder()
        .setTitle("📖 Welcome to The Gauntlet — Solo Edition")
        .setDescription([
          "Play **any time** via ephemeral messages. One run per day (Toronto time).",
          "",
          "**Flow:**",
          "1) MiniGame → Riddle",
          "2) Labyrinth  🔸 Interlude: Ugly Selector",
          "3) MiniGame → Riddle",
          "4) Squig Roulette",
          "5) MiniGame → Riddle  🔸 Interlude: Trust or Doubt",
          "6) Risk It",
          "",
          "**Scoring:** Luck, riddles, labyrinth steps, roulette, risk bonuses.",
          "Leaderboard ranks **highest single-game score**, with **total monthly points** as tiebreaker."
        ].join('\n'))
        .setColor(0x00ccff);
      return interaction.reply({ embeds:[embed], ephemeral:true });
    }
    // /mygauntlet
    if (interaction.isChatInputCommand() && interaction.commandName==='mygauntlet'){
      const month = currentMonthStr();
      const mine = await Store.getMyMonth(interaction.user.id, month);
      const embed = new EmbedBuilder()
        .setTitle(`📊 Your Gauntlet — ${month}`)
        .setDescription(`**Best:** ${mine.best}\n**Total:** ${mine.total}\n**Plays:** ${mine.plays}`)
        .setColor(0x00ccff);
      return interaction.reply({ embeds:[embed], ephemeral:true });
    }

    // Start button → daily limit check → run (ephemeral in-channel)
    if (interaction.isButton() && interaction.customId==='gauntlet:start'){
      const today = torontoDateStr();
      const played = await Store.hasPlayed(interaction.user.id, today);
      if(played){
        const when = nextTorontoMidnight();
        return interaction.reply({ content:`⛔ You\'ve already played today. Come back after **${when} (Toronto)**.`, ephemeral:true });
      }
      await interaction.reply({ content:'🎬 Your Gauntlet run begins now (ephemeral). Good luck!', ephemeral:true });
      const final = await runSoloGauntletEphemeral(interaction);
      try { await interaction.followUp({ content:`✅ <@${interaction.user.id}> finished a run with **${final}** points.`, ephemeral:false }); } catch {}
      return;
    }
  } catch(err){
    console.error('interaction error:', err);
    if(interaction.isRepliable()){
      try { await interaction.reply({ content:'❌ Something went wrong.', ephemeral:true }); } catch {}
    }
  }
});

client.login(TOKEN);
