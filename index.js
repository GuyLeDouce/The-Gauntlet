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
  // 1
  { 
    riddle: "I live by your sink, I fight tiny battles, I vanish each day but leave you less dirty. What am I?", 
    answers: ["soap"], 
    difficulty: 1 
  },
  // 2
  { 
    riddle: "I rest on your bed, I hold up your head, and I never complain when you drool on me. What am I?", 
    answers: ["pillow"], 
    difficulty: 1 
  },
  // 3
  { 
    riddle: "I follow you in sunlight but hide in the dark. You move, I move. What am I?", 
    answers: ["shadow"], 
    difficulty: 1 
  },
  // 4
  { 
    riddle: "I repeat what you say, but I never start a conversation. What am I?", 
    answers: ["echo"], 
    difficulty: 1 
  },
  // 5
  { 
    riddle: "I have numbers but I’m not a test, I have hands but I’m not a person. What am I?", 
    answers: ["clock", "watch"], 
    difficulty: 1 
  },
  // 6
  { 
    riddle: "I show you other people all day, but I never take a selfie. What am I?", 
    answers: ["mirror"], 
    difficulty: 1 
  },
  // 7
  { 
    riddle: "You go up me and down me, but I stay in the same place. What am I?", 
    answers: ["stairs", "staircase"], 
    difficulty: 1 
  },
  // 8
  { 
    riddle: "I get sharpened to work, but if you use me too much I disappear. What am I?", 
    answers: ["pencil"], 
    difficulty: 1 
  },
  // 9
  { 
    riddle: "I’m full of stories, but I never speak unless you open me. What am I?", 
    answers: ["book"], 
    difficulty: 1 
  },
  // 10
  { 
    riddle: "I appear after rain when the sun comes back, wearing many colors. What am I?", 
    answers: ["rainbow"], 
    difficulty: 1 
  },
  // 11
  { 
    riddle: "I float in the sky, I’m white or gray, and sometimes I cry. What am I?", 
    answers: ["cloud"], 
    difficulty: 1 
  },
  // 12
  { 
    riddle: "I shine at night, but I’m not the moon. I’m small, far away, and part of a crowd. What am I?", 
    answers: ["star"], 
    difficulty: 1 
  },
  // 13
  { 
    riddle: "Cars and feet move on me all day, but I never move myself. What am I?", 
    answers: ["road", "street"], 
    difficulty: 1 
  },
  // 14
  { 
    riddle: "I open to let people in, I close to keep people out, and sometimes I squeak. What am I?", 
    answers: ["door"], 
    difficulty: 1 
  },
  // 15
  { 
    riddle: "You look through me, not at me, to see what’s outside. What am I?", 
    answers: ["window"], 
    difficulty: 1 
  },
  // 16
  { 
    riddle: "I get wet helping you dry, and I hang around when I’m done. What am I?", 
    answers: ["towel"], 
    difficulty: 1 
  },
  // 17
  { 
    riddle: "I have fingers but no bones, and I keep your hand warm. What am I?", 
    answers: ["glove", "mitten"], 
    difficulty: 1 
  },
  // 18
  { 
    riddle: "I protect your feet from the ground but complain with squeaks on some floors. What am I?", 
    answers: ["shoe", "boot", "sneaker"], 
    difficulty: 1 
  },
  // 19
  { 
    riddle: "I cover you at night and sometimes in naps. What am I?", 
    answers: ["blanket"], 
    difficulty: 1 
  },
  // 20
  { 
    riddle: "I show days and months, but I’m not on your phone. What am I?", 
    answers: ["calendar"], 
    difficulty: 1 
  },
  // 21
  { 
    riddle: "Students carry me, hikers pack me, and I hold things on my back. What am I?", 
    answers: ["backpack", "bag"], 
    difficulty: 1 
  },
  // 22
  { 
    riddle: "I carry one secret inside, then I travel in the mail. What am I?", 
    answers: ["envelope"], 
    difficulty: 1 
  },
  // 23
  { 
    riddle: "I’m small and round, with a head and a tail, and I buy almost nothing now. What am I?", 
    answers: ["coin"], 
    difficulty: 1 
  },
  // 24
  { 
    riddle: "I hold water, juice, or Squig-fuel coffee, and I fit in your hand. What am I?", 
    answers: ["cup", "mug", "glass"], 
    difficulty: 1 
  },
  // 25
  { 
    riddle: "I open locks but I’m not a password. What am I?", 
    answers: ["key"], 
    difficulty: 1 
  },
  // 26
  { 
    riddle: "I light up a room with a click, but I never leave the table or desk. What am I?", 
    answers: ["lamp"], 
    difficulty: 1 
  },
  // 27
  { 
    riddle: "I start solid, become water, then vanish into air. What am I?", 
    answers: ["ice"], 
    difficulty: 1 
  },
  // 28
  { 
    riddle: "I’m full of air, I float for a while, and Squigs love me at parties. What am I?", 
    answers: ["balloon"], 
    difficulty: 1 
  },
  // 29
  { 
    riddle: "I sit on your head to block the sun or hide bad hair. What am I?", 
    answers: ["hat", "cap"], 
    difficulty: 1 
  },
  // 30
  { 
    riddle: "I sit between your eyes and your mouth and sometimes I run. What am I?", 
    answers: ["nose"], 
    difficulty: 1 
  },
  // 31
  { 
    riddle: "I move without legs, I murmur without a mouth, and I flow to the sea. What am I?", 
    answers: ["river"], 
    difficulty: 1 
  },
  // 32
  { 
    riddle: "I grow tall from the ground, wear leaves in the wind, and have rings inside. What am I?", 
    answers: ["tree"], 
    difficulty: 1 
  },
  // 33
  { 
    riddle: "I’m spread on beaches and poured into buckets. What am I?", 
    answers: ["sand"], 
    difficulty: 1 
  },
  // 34
  { 
    riddle: "I’m tiny and asleep in the soil, then I wake up green. What am I?", 
    answers: ["seed"], 
    difficulty: 1 
  },
  // 35
  { 
    riddle: "I fall from the sky in winter, I’m cold and soft, and I melt in your hand. What am I?", 
    answers: ["snow"], 
    difficulty: 1 
  },
  // 36
  { 
    riddle: "I mix with water to make you clean, and I sometimes bubble. What am I?", 
    answers: ["soap"], 
    difficulty: 1 
  },
  // 37
  { 
    riddle: "I am used to eat soup, but I never drink it myself. What am I?", 
    answers: ["spoon"], 
    difficulty: 1 
  },
  // 38
  { 
    riddle: "I have sharp teeth for food, but I never bite people. What am I?", 
    answers: ["fork"], 
    difficulty: 1 
  },
  // 39
  { 
    riddle: "I have four legs and a back, but I never walk. What am I?", 
    answers: ["chair"], 
    difficulty: 1 
  },
  // 40
  { 
    riddle: "I have four legs and a flat top; I hold your dinner but never eat it. What am I?", 
    answers: ["table"], 
    difficulty: 1 
  },
  // 41
  { 
    riddle: "I hold you at night but I’m not your partner. I have a head, a foot, and four legs. What am I?", 
    answers: ["bed"], 
    difficulty: 1 
  },
  // 42
  { 
    riddle: "I live in your pocket and ring when someone misses you. What am I?", 
    answers: ["phone"], 
    difficulty: 1 
  },
  // 43
  { 
    riddle: "You type on me to talk to Squigs online. What am I?", 
    answers: ["keyboard"], 
    difficulty: 1 
  },
  // 44
  { 
    riddle: "I click and point but have no hands. What am I?", 
    answers: ["mouse"], 
    difficulty: 1 
  },
  // 45
  { 
    riddle: "I show your reflection in still water, but I’m not a mirror. What am I?", 
    answers: ["lake", "pond"], 
    difficulty: 1 
  },
  // 46
  { 
    riddle: "I cover the ground in cities and forests alike, and Squigs love to hide behind me. What am I?", 
    answers: ["tree"], 
    difficulty: 1 
  },
  // 47
  { 
    riddle: "I move in circles, wash your clothes, and hum while I work. What am I?", 
    answers: ["washer", "washing machine"], 
    difficulty: 1 
  },
  // 48
  { 
    riddle: "I roar when I’m angry, crash when I’m tired, and live on the shore. What am I?", 
    answers: ["wave", "waves", "ocean"], 
    difficulty: 1 
  },
  // 49
  { 
    riddle: "I hang on the wall, mark your height, and never shrink. What am I?", 
    answers: ["ruler", "measuring tape"], 
    difficulty: 1 
  },
  // 50
  { 
    riddle: "I mark where you are in a book, then quietly wait. What am I?", 
    answers: ["bookmark"], 
    difficulty: 1 
  },

  // MEDIUM (2) — 50
  // 1
  { 
    riddle: "I move without legs, whisper without a mouth, and can flip your umbrella inside out. What am I?", 
    answers: ["wind"], 
    difficulty: 2 
  },
  // 2
  { 
    riddle: "I’m there before you speak, and gone once you finish. What am I?", 
    answers: ["thought"], 
    difficulty: 2 
  },
  // 3
  { 
    riddle: "I’m counted in years, worn on faces, and feared by mirrors. What am I?", 
    answers: ["age"], 
    difficulty: 2 
  },
  // 4
  { 
    riddle: "I start fights in traffic, growl in engines, and vanish when you park. What am I?", 
    answers: ["horn"], 
    difficulty: 2 
  },
  // 5
  { 
    riddle: "I keep secrets in numbers and letters, and Squigs use me to hide treasure on-chain. What am I?", 
    answers: ["password"], 
    difficulty: 2 
  },
  // 6
  { 
    riddle: "I store value, hold tokens, and panic if you lose my phrase. What am I?", 
    answers: ["wallet"], 
    difficulty: 2 
  },
  // 7
  { 
    riddle: "I am paid for work, counted in numbers, and chased by bills. What am I?", 
    answers: ["salary", "wage", "paycheck"], 
    difficulty: 2 
  },
  // 8
  { 
    riddle: "I stretch across the sky like a road, but no one can walk on me. What am I?", 
    answers: ["rainbow"], 
    difficulty: 2 
  },
  // 9
  { 
    riddle: "I can freeze time in a frame, but I’m gone when you swipe away. What am I?", 
    answers: ["photo", "picture"], 
    difficulty: 2 
  },
  // 10
  { 
    riddle: "I grow when you feed me numbers, and I draw mountains and valleys on a screen. What am I?", 
    answers: ["graph", "chart"], 
    difficulty: 2 
  },
  // 11
  { 
    riddle: "I am shared in whispers, stored in minds, and destroyed by gossip. What am I?", 
    answers: ["secret"], 
    difficulty: 2 
  },
  // 12
  { 
    riddle: "I am born in anger, grow in silence, and die with a single word. What am I?", 
    answers: ["grudge"], 
    difficulty: 2 
  },
  // 13
  { 
    riddle: "I live in your chest, race when you’re scared, and drum without sticks. What am I?", 
    answers: ["heart"], 
    difficulty: 2 
  },
  // 14
  { 
    riddle: "I sit behind your face and decide what you say, but no one has seen me. What am I?", 
    answers: ["mind", "brain"], 
    difficulty: 2 
  },
  // 15
  { 
    riddle: "I grow without water, travel without moving, and disappear in one swipe. What am I?", 
    answers: ["notification", "message"], 
    difficulty: 2 
  },
  // 16
  { 
    riddle: "I am made of pages, but also exist as a glow on your screen. What am I?", 
    answers: ["book", "ebook"], 
    difficulty: 2 
  },
  // 17
  { 
    riddle: "I am the quiet between beats, the pause between words, and the break in noisy rooms. What am I?", 
    answers: ["silence"], 
    difficulty: 2 
  },
  // 18
  { 
    riddle: "I decide who sees what, I feed on attention, and I never sleep on your feed. What am I?", 
    answers: ["algorithm"], 
    difficulty: 2 
  },
  // 19
  { 
    riddle: "I am the road Squigs use to move tokens, invisible but always busy. What am I?", 
    answers: ["network", "blockchain"], 
    difficulty: 2 
  },
  // 20
  { 
    riddle: "I can be broken by noise, kept by trust, and signed with your name. What am I?", 
    answers: ["promise", "word"], 
    difficulty: 2 
  },
  // 21
  { 
    riddle: "I keep you dry without walls or doors, but I can fly away in a storm. What am I?", 
    answers: ["umbrella"], 
    difficulty: 2 
  },
  // 22
  { 
    riddle: "I say everything without a sound, and I live in your eyes. What am I?", 
    answers: ["look", "glance"], 
    difficulty: 2 
  },
  // 23
  { 
    riddle: "I am taken before a journey and thrown away once you arrive. What am I?", 
    answers: ["photo", "picture"], 
    difficulty: 2 
  },
  // 24
  { 
    riddle: "I start tall, end short, and disappear while giving light. What am I?", 
    answers: ["candle"], 
    difficulty: 2 
  },
  // 25
  { 
    riddle: "I can be saved, spent, staked, or burned, but never held in your hand. What am I?", 
    answers: ["token", "crypto", "coin"], 
    difficulty: 2 
  },
  // 26
  { 
    riddle: "I can freeze a moment, shape your memory of it, and lie without ever speaking. What am I?", 
    answers: ["photo", "picture"], 
    difficulty: 2 
  },
  // 27
  { 
    riddle: "I decide the winner, count the points, and end arguments in games. What am I?", 
    answers: ["score"], 
    difficulty: 2 
  },
  // 28
  { 
    riddle: "I stretch in the morning, shrink at night, and live on your schedule. What am I?", 
    answers: ["day"], 
    difficulty: 2 
  },
  // 29
  { 
    riddle: "I am given, taken, and sometimes broken. Without me, trust is thin. What am I?", 
    answers: ["promise"], 
    difficulty: 2 
  },
  // 30
  { 
    riddle: "I am the part of the story you don’t see on screen, but feel anyway. What am I?", 
    answers: ["music", "soundtrack"], 
    difficulty: 2 
  },
  // 31
  { 
    riddle: "I grow on your face when you’re older, disappear with a blade, and return when you rest. What am I?", 
    answers: ["beard"], 
    difficulty: 2 
  },
  // 32
  { 
    riddle: "I appear when you’re happy, fade when you’re tired, and vanish when you’re angry. What am I?", 
    answers: ["smile"], 
    difficulty: 2 
  },
  // 33
  { 
    riddle: "I am the line between courage and danger, crossed by accident or choice. What am I?", 
    answers: ["edge"], 
    difficulty: 2 
  },
  // 34
  { 
    riddle: "I am the quiet worry in your stomach before a big event. What am I?", 
    answers: ["nerves", "anxiety"], 
    difficulty: 2 
  },
  // 35
  { 
    riddle: "I start as a wish, grow into a plan, and sometimes end as regret. What am I?", 
    answers: ["idea", "dream"], 
    difficulty: 2 
  },
  // 36
  { 
    riddle: "I move armies in games, but never in real wars. What am I?", 
    answers: ["piece", "pawn"], 
    difficulty: 2 
  },
  // 37
  { 
    riddle: "I am measured in beats, feared in hospitals, and missed when I stop. What am I?", 
    answers: ["pulse", "heartbeat"], 
    difficulty: 2 
  },
  // 38
  { 
    riddle: "I am the invisible weight you feel when you owe someone. What am I?", 
    answers: ["debt"], 
    difficulty: 2 
  },
  // 39
  { 
    riddle: "I am the map Squigs use to find you online, but I’m just numbers and dots. What am I?", 
    answers: ["address", "ip"], 
    difficulty: 2 
  },
  // 40
  { 
    riddle: "I lure you to scroll, steal your time, and reward you with nothing you needed. What am I?", 
    answers: ["feed", "timeline"], 
    difficulty: 2 
  },
  // 41
  { 
    riddle: "I am the bridge between questions and answers, but I never speak. What am I?", 
    answers: ["search"], 
    difficulty: 2 
  },
  // 42
  { 
    riddle: "I decide when your food arrives, your Squigs mint, and your meeting starts. What am I?", 
    answers: ["time"], 
    difficulty: 2 
  },
  // 43
  { 
    riddle: "I can be burned, wasted, invested, and spent, but never saved in a wallet. What am I?", 
    answers: ["time"], 
    difficulty: 2 
  },
  // 44
  { 
    riddle: "I am the price of haste, the debt of laziness, and the tax of late decisions. What am I?", 
    answers: ["stress"], 
    difficulty: 2 
  },
  // 45
  { 
    riddle: "I guard your house when you’re gone, and your door when you sleep. What am I?", 
    answers: ["lock"], 
    difficulty: 2 
  },
  // 46
  { 
    riddle: "I am loud at concerts, silent in space, and shaped by walls. What am I?", 
    answers: ["sound"], 
    difficulty: 2 
  },
  // 47
  { 
    riddle: "I am the place between awake and asleep where ideas get weird. What am I?", 
    answers: ["dream"], 
    difficulty: 2 
  },
  // 48
  { 
    riddle: "I can be bitten but never chewed, frozen but never cold, and kept but never held. What am I?", 
    answers: ["lip"], 
    difficulty: 2 
  },
  // 49
  { 
    riddle: "I am the invisible wall between two people who won’t talk. What am I?", 
    answers: ["silence"], 
    difficulty: 2 
  },
  // 50
  { 
    riddle: "I am the distance between where you are and where you want to be. What am I?", 
    answers: ["goal", "gap"], 
    difficulty: 2 
  },

  // HARD (3) — 50
  // 1
  { 
    riddle: "I erase kingdoms in silence, smooth mountains to nothing, and still lose to a single moment. What am I?", 
    answers: ["time"], 
    difficulty: 3 
  },
  // 2
  { 
    riddle: "I am the one thing everyone spends, the one thing no one owns, and the first thing you ask for when you’re late. What am I?", 
    answers: ["time"], 
    difficulty: 3 
  },
  // 3
  { 
    riddle: "I build worlds behind your eyes, rewrite the past, and visit futures that never happen. What am I?", 
    answers: ["imagination"], 
    difficulty: 3 
  },
  // 4
  { 
    riddle: "I live between the truth and the story, stretched by fear and squeezed by pride. What am I?", 
    answers: ["memory"], 
    difficulty: 3 
  },
  // 5
  { 
    riddle: "I am light enough to ignore, heavy enough to drown you, and invisible to everyone but you. What am I?", 
    answers: ["guilt"], 
    difficulty: 3 
  },
  // 6
  { 
    riddle: "I never speak, yet I confess everything when you finally stop talking. What am I?", 
    answers: ["silence"], 
    difficulty: 3 
  },
  // 7
  { 
    riddle: "I sit at the edge of every leap, frozen in your chest, waiting on your choice. What am I?", 
    answers: ["fear"], 
    difficulty: 3 
  },
  // 8
  { 
    riddle: "I arrive without footsteps, live in your ribs, and leave with a sigh. What am I?", 
    answers: ["sorrow"], 
    difficulty: 3 
  },
  // 9
  { 
    riddle: "I am born when something ends, feared when I’m empty, and chased when I’m full. What am I?", 
    answers: ["future"], 
    difficulty: 3 
  },
  // 10
  { 
    riddle: "I grow when you feed me attention, shrink when you face me, and vanish when you accept me. What am I?", 
    answers: ["anxiety", "fear"], 
    difficulty: 3 
  },
  // 11
  { 
    riddle: "Squigs open me to cross worlds, humans open me to cross days. What am I?", 
    answers: ["portal", "door"], 
    difficulty: 3 
  },
  // 12
  { 
    riddle: "I bind strangers into armies, turn ideas into crowds, and vanish when no one cares. What am I?", 
    answers: ["belief", "faith"], 
    difficulty: 3 
  },
  // 13
  { 
    riddle: "I am a mirror with no glass that only reflects what you are not. What am I?", 
    answers: ["envy"], 
    difficulty: 3 
  },
  // 14
  { 
    riddle: "I am loudest when I am broken, and quietest when I am whole. What am I?", 
    answers: ["heart", "silence"], 
    difficulty: 3 
  },
  // 15
  { 
    riddle: "I am the tax you pay to the future for the things you never fixed in the past. What am I?", 
    answers: ["regret"], 
    difficulty: 3 
  },
  // 16
  { 
    riddle: "I sit between your decision and your action, and I vanish with a single step. What am I?", 
    answers: ["doubt"], 
    difficulty: 3 
  },
  // 17
  { 
    riddle: "I can turn kings into beggars, and beggars into kings, without changing a coin. What am I?", 
    answers: ["story"], 
    difficulty: 3 
  },
  // 18
  { 
    riddle: "I am the space between beats of a song, and the reason the song feels alive. What am I?", 
    answers: ["silence", "pause"], 
    difficulty: 3 
  },
  // 19
  { 
    riddle: "I am carved from your choices, worn by your habits, and handed to tomorrow. What am I?", 
    answers: ["reputation"], 
    difficulty: 3 
  },
  // 20
  { 
    riddle: "I am the shadow of every promise, and I arrive the moment it breaks. What am I?", 
    answers: ["disappointment"], 
    difficulty: 3 
  },
  // 21
  { 
    riddle: "I drink your attention, bend your opinions, and pretend I’m just delivering news. What am I?", 
    answers: ["media"], 
    difficulty: 3 
  },
  // 22
  { 
    riddle: "I live in a line of symbols, guard vaults without walls, and vanish if you forget me. What am I?", 
    answers: ["password", "seed"], 
    difficulty: 3 
  },
  // 23
  { 
    riddle: "I am the ghost of a moment, sharpened by distance, softened by comfort. What am I?", 
    answers: ["memory"], 
    difficulty: 3 
  },
  // 24
  { 
    riddle: "I grow in silence, explode in noise, and sometimes end in laughter. What am I?", 
    answers: ["argument"], 
    difficulty: 3 
  },
  // 25
  { 
    riddle: "I am invisible weight, carried by liars and lifted by confession. What am I?", 
    answers: ["guilt"], 
    difficulty: 3 
  },
  // 26
  { 
    riddle: "I am the softest prison, built with comfort and fear of change. What am I?", 
    answers: ["routine"], 
    difficulty: 3 
  },
  // 27
  { 
    riddle: "I am the map Squigs can’t draw: every choice you didn’t make. What am I?", 
    answers: ["regret"], 
    difficulty: 3 
  },
  // 28
  { 
    riddle: "I hold everything you could have been, and nothing you chose to be. What am I?", 
    answers: ["potential"], 
    difficulty: 3 
  },
  // 29
  { 
    riddle: "I am made stronger by being challenged and weaker by being obeyed. What am I?", 
    answers: ["ego"], 
    difficulty: 3 
  },
  // 30
  { 
    riddle: "I keep you from falling, but I’m built from every time you did. What am I?", 
    answers: ["experience"], 
    difficulty: 3 
  },
  // 31
  { 
    riddle: "I am the quiet rewrite of your memories that always makes you the hero. What am I?", 
    answers: ["ego"], 
    difficulty: 3 
  },
  // 32
  { 
    riddle: "I haunt the end of every success and the start of every new risk. What am I?", 
    answers: ["doubt"], 
    difficulty: 3 
  },
  // 33
  { 
    riddle: "I turn strangers into allies with a word, and allies into enemies with another. What am I?", 
    answers: ["trust"], 
    difficulty: 3 
  },
  // 34
  { 
    riddle: "I am the last thing you lose and the first thing others write on your stone. What am I?", 
    answers: ["name"], 
    difficulty: 3 
  },
  // 35
  { 
    riddle: "I am the storm inside a quiet person when they say, “I’m fine.” What am I?", 
    answers: ["anger"], 
    difficulty: 3 
  },
  // 36
  { 
    riddle: "I am the cage built from what others think, and the key is what you know. What am I?", 
    answers: ["fear"], 
    difficulty: 3 
  },
  // 37
  { 
    riddle: "I am the distance between your intention and your action. What am I?", 
    answers: ["procrastination"], 
    difficulty: 3 
  },
  // 38
  { 
    riddle: "I grow when you stare backward, shrink when you face forward, and vanish when you move. What am I?", 
    answers: ["regret"], 
    difficulty: 3 
  },
  // 39
  { 
    riddle: "I am the heartbeat of every community, but I cannot live without listening. What am I?", 
    answers: ["conversation"], 
    difficulty: 3 
  },
  // 40
  { 
    riddle: "I am the gravity that pulls you back to your worst habits. What am I?", 
    answers: ["comfort"], 
    difficulty: 3 
  },
  // 41
  { 
    riddle: "I turn secrets into currency, friendships into numbers, and attention into profit. What am I?", 
    answers: ["platform", "social"], 
    difficulty: 3 
  },
  // 42
  { 
    riddle: "I begin as curiosity, grow into obsession, and sometimes end in wisdom. What am I?", 
    answers: ["learning"], 
    difficulty: 3 
  },
  // 43
  { 
    riddle: "I am the only fire that grows when you share it and dies when you hoard it. What am I?", 
    answers: ["knowledge"], 
    difficulty: 3 
  },
  // 44
  { 
    riddle: "I am the invisible script you follow each day, until you decide to improvise. What am I?", 
    answers: ["habit"], 
    difficulty: 3 
  },
  // 45
  { 
    riddle: "I am the currency Squigs can’t mint: earned in actions, lost in seconds. What am I?", 
    answers: ["respect"], 
    difficulty: 3 
  },
  // 46
  { 
    riddle: "I start as a whisper, grow into a storm, and can topple empires without one vote. What am I?", 
    answers: ["rumor"], 
    difficulty: 3 
  },
  // 47
  { 
    riddle: "I am the only prison whose walls you rebuild every time they crack. What am I?", 
    answers: ["fear"], 
    difficulty: 3 
  },
  // 48
  { 
    riddle: "I am the story the world tells about you when you’re not in the room. What am I?", 
    answers: ["reputation"], 
    difficulty: 3 
  },
  // 49
  { 
    riddle: "I am the ghost of choices not taken, visiting late at night. What am I?", 
    answers: ["regret"], 
    difficulty: 3 
  },
  // 50
  { 
    riddle: "I am the only battle you fight every day where both sides are you. What am I?", 
    answers: ["conscience"], 
    difficulty: 3 
  },
  // Squig Specials
  // 1
  { 
    riddle: "In the Ugly Labs ecosystem, Squigs are a collection of how many NFTs in total?", 
    answers: ["4444", "4,444"], 
    difficulty: 4 
  },
  // 2
  { 
    riddle: "Which studio created Squigs and the rest of the ecosystem?", 
    answers: ["ugly labs"], 
    difficulty: 4 
  },
  // 3
  { 
    riddle: "What is the name of the very first Ugly Labs collection with 666 supply?", 
    answers: ["charm of the ugly", "charm"], 
    difficulty: 4 
  },
  // 4
  { 
    riddle: "Burning three Charms in the ecosystem will create which companion collection?", 
    answers: ["ugly monster", "ugly monsters"], 
    difficulty: 4 
  },
  // 5
  { 
    riddle: "On which blockchain network do Squigs live?", 
    answers: ["ethereum"], 
    difficulty: 4 
  },
  // 6
  { 
    riddle: "When you mint a Squig, you instantly pull from what prize system?", 
    answers: ["prize portal", "portal prizes", "prize"], 
    difficulty: 4 
  },
  // 7
  { 
    riddle: "Holding and playing inside the Ugly Labs ecosystem earns which token?", 
    answers: ["charm", "$charm"], 
    difficulty: 4 
  },
  // 8
  { 
    riddle: "What’s the name of the marketplace where you can spend your $CHARM on more Ugly Labs assets?", 
    answers: ["malformed market", "malformed marketplace"], 
    difficulty: 4 
  },
  // 9
  { 
    riddle: "Which platform tracks your Ugly Labs collectibles, badges, and Portal Prizes?", 
    answers: ["uglydex"], 
    difficulty: 4 
  },
  // 10
  { 
    riddle: "What is the name of the main leaderboard that shows how deep you are in the ecosystem?", 
    answers: ["uglyboard"], 
    difficulty: 4 
  },
  // 11
  { 
    riddle: "What are the points called that help you climb the UglyBoard?", 
    answers: ["uglypoints", "up"], 
    difficulty: 4 
  },
  // 12
  { 
    riddle: "Squigs are described as beings from a distant what?", 
    answers: ["planet"], 
    difficulty: 4 
  },
  // 13
  { 
    riddle: "What concept are Squigs obsessed with, across looks, behavior, and culture?", 
    answers: ["ugly"], 
    difficulty: 4 
  },
  // 14
  { 
    riddle: "Squigs studied Earth mostly by watching which online culture grow and implode?", 
    answers: ["web3", "nfts", "nft culture", "crypto"], 
    difficulty: 4 
  },
  // 15
  { 
    riddle: "When Squigs cross the portal to Earth, humans mainly see them as which type of asset?", 
    answers: ["nfts", "nft", "digital asset", "collectible", "digital collectible"], 
    difficulty: 4 
  },
  // 16
  { 
    riddle: "In the lore, Squigs don’t think they’re owned. What do humans think they are doing to Squigs?", 
    answers: ["owning", "own them"], 
    difficulty: 4 
  },
  // 19
  { 
    riddle: "Which collection is called the 'next wave of Ugly Labs' after Charm of the Ugly and Ugly Monsters?", 
    answers: ["squigs"], 
    difficulty: 4 
  },
  // 20
  { 
    riddle: "How many Charm of the Ugly must be burned to create a single Ugly Monster?", 
    answers: ["3", "three"], 
    difficulty: 4 
  },
  // 21
  { 
    riddle: "What is the total supply of Charm of the Ugly in the ecosystem?", 
    answers: ["666"], 
    difficulty: 4 
  },
  // 25
  { 
    riddle: "When you reveal your Squigs mint rewards on UglyDex, what are they called?", 
    answers: ["portal prizes", "prize portal", "portal prize"], 
    difficulty: 4 
  },
  // 26
  { 
    riddle: "Which token do you earn more of by holding more Ugly Labs assets?", 
    answers: ["charm", "$charm"], 
    difficulty: 4 
  },
  // 27
  { 
    riddle: "What kind of mint was offered for Charm and Monster holders when Squigs arrived?", 
    answers: ["free", "free mint"], 
    difficulty: 4 
  },
  // 28
  { 
    riddle: "On which NFT platform can you view Squigs on the secondary market by default?", 
    answers: ["opensea", "magic eden", "magiceden"], 
    difficulty: 4 
  },
  // 31
  { 
    riddle: "In lore, Squigs watch Earth through telescopes and what other type of gateway?", 
    answers: ["portals", "portal"], 
    difficulty: 4 
  },
  // 33
  { 
    riddle: "What is the name of the chaotic game-show style event bot that runs lore-rich games in the server?", 
    answers: ["the gauntlet", "gauntlet"], 
    difficulty: 4 
  },
  // 34
  { 
    riddle: "Which collection is described as 'celebrating imperfection in a world obsessed with perfection'?", 
    answers: ["charm of the ugly", "charm"], 
    difficulty: 4 
  },
  // 35
  { 
    riddle: "Which collection is described as ‘pets and companions’ in the Ugly ecosystem?", 
    answers: ["ugly monsters", "monsters"], 
    difficulty: 4 
  },
  // 37
  { 
    riddle: "Every Squig that arrives on Earth appears as what digital object to humans?", 
    answers: ["nft", "profile picture", "pfp","digital collectible"], 
    difficulty: 4 
  },
  // 39
  { 
    riddle: "What do you earn by completing games, quests, and events alongside holding in the ecosystem?", 
    answers: ["charm", "$charm"], 
    difficulty: 4 
  },
  // 40
  { 
    riddle: "What type of loop is Squigs often described as: linear, broken, or full-circle?", 
    answers: ["full circle", "full-circle"], 
    difficulty: 4 
  },
  // 41
  { 
    riddle: "Which Ugly Labs asset type increases your $CHARM earning potential the more of them you hold?", 
    answers: ["ugly labs nfts", "ugly labs assets"], 
    difficulty: 4 
  },
  // 42
  { 
    riddle: "Which collection do you specifically 'mint' to start the Mint → Win → Earn → Buy loop?", 
    answers: ["squigs"], 
    difficulty: 4 
  },
  // 43
  { 
    riddle: "If you burn three Charms and gain one Monster, what are you doing to your Charm collection?", 
    answers: ["sacrifice", "sacrificing"], 
    difficulty: 4 
  },
  // 44
  { 
    riddle: "What do Squigs use to judge humans more than floor prices: your traits or your tokens?", 
    answers: ["traits"], 
    difficulty: 4 
  },
  // 45
  { 
    riddle: "Which digital token is positioned as the 'glue' that connects Squigs, Charms, and Monsters?", 
    answers: ["charm", "$charm"], 
    difficulty: 4 
  },
  // 46
  { 
    riddle: "What do you primarily spend in the Malformed Market: ETH or $CHARM?", 
    answers: ["charm", "$charm"], 
    difficulty: 4 
  },
  // 47
  { 
    riddle: "What do Squigs quietly farm from humans by watching Web3: alpha or behavior?", 
    answers: ["behavior", "behaviour"], 
    difficulty: 4 
  },
  // 48
  { 
    riddle: "In lore, Squigs arrived after watching people abandon which kind of digital communities?", 
    answers: ["nft communities", "communities"], 
    difficulty: 4 
  },
  // 49
  { 
    riddle: "When humans say 'I own this Squig', what do Squigs think they actually own instead?", 
    answers: ["nothing"], 
    difficulty: 4 
  },
  // 50
  { 
    riddle: "In one sentence: Squigs exist to worship which four-letter word?", 
    answers: ["ugly"], 
    difficulty: 4 
  },
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
client.once('clientReady', async ()=>{
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
