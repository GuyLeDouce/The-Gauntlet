// index.js
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

// === PostgreSQL Setup ===
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
  })
  .catch(err => console.error('❌ DB Connection Error:', err));
// === Global Game State ===
let activeGame = null;
let rematchCount = 0;
const maxRematches = 4;
const currentPlayers = new Map(); // userId => { username, lives }
const eliminatedPlayers = new Map(); // userId => { username, eliminatedAt }
const trialMode = false;
let gameChannel = null;
let joinMessageLink = null;
const authorizedUsers = ['826581856400179210', '1288107772248064044'];


// === Lore Arrays ===
const funnyEliminations = [
  "🩴 tripped over their own sandal and fell into the Charmhole.",
  "🧠 tried to outthink the Oracle. Brain exploded like 🍉.",
  "🦴 challenged a Monster to a dance battle. Got breakdanced to death.",
  "🥴 mistook the ritual circle for a beanbag chair. Instant regret.",
  "🔮 stared into the CHARM too long. Now they're a riddle.",
  "🪑 pulled the wrong lever and got chaired into another dimension.",
  "🧻 wrapped themselves in toilet paper for protection. It backfired. Badly.",
  "🦍 tried to arm wrestle a ghost. Lost both arms. Then lost.",
  "🫠 melted after saying 'It’s just a game'. The Gauntlet heard.",
  "🧄 ate the sacred garlic. Became delicious. Then disappeared.",
  "📸 tried to selfie with a Monster. Got photobombed into oblivion.",
  "🪞 challenged their reflection to a duel. Lost. Twice.",
  "👅 licked a cursed toad. Now lives as a sticker on a rock.",
  "🥸 thought they were safe in disguise. The CHARM saw through.",
  "🐸 ribbited once too loud. Summoned something froggier.",
  "🤡 misread the prophecy. Showed up in clown shoes. Slipped. Gone.",
  "📦 hid in a box labeled 'DO NOT OPEN'. Someone opened it.",
  "🍕 offered the Monster a slice. Monster hates pineapple. Rage ensued.",
  "🌶️ thought a hot pepper was a life elixir. It wasn’t.",
  "🪨 tried to skip a sacred rock across the charm pool. It skipped back.",
  "💅 paused mid-event to do their nails. Got glamor-blasted into dust.",
  "🕺 breakdanced too hard during a riddle. Snapped into the ether.",
  "🐔 mocked the Chicken Oracle. Turned into a nugget.",
  "🫧 tried to bathe in the sacred bubbles. Became foam.",
  "📞 called tech support mid-trial. Got put on eternal hold.",
  "🕳️ fell in a pit of expired CHARM tokens. Suffocated on cringe.",
  "🥁 brought a drum to the silent round. Got booted by lore acoustics.",
  "🩰 wore ballet shoes to the Ritual. Pirouetted into non-being.",
  "🧃 drank the Monster’s juice box. Violated ancient lunch law.",
  "🎈 floated off while chanting 'I am the one!' — They weren’t.",
  "🧀 used cheese instead of logic. Rodents summoned. No survivors.",
  "📚 read the fine print. Realized too late: *You already lost*.",
  "🧟‍♂️ fake revived themselves. The bot sued for impersonation.",
  "🩹 tried to patch the charmhole with band-aids. Got sucked in.",
  "🕳️ misidentified a riddle as a pothole. Tried to fill it with sand. Disappeared.",
  "🧤 wore oven mitts to press a fate button. Pressed the wrong one. Twice.",
  "📀 tried to play a cursed VHS tape backwards. Got rewinded out of existence.",
  "💨 farted during a solemn chant. The Gauntlet has no chill.",
  "🎨 painted themselves into the corner. Lore took the brush.",
  "🦷 flossed too aggressively. Opened a dental void.",
  "🧊 slipped on spilled CHARM and slid into 3 alternate timelines. Eliminated in all.",
  "🎃 brought a pumpkin to a Monster fight. Became soup.",
  "🧼 washed their hands during the ritual. Summoned Hygiene Beast. Devoured.",
  "🐌 challenged the Oracle to a race. Lost, obviously.",
  "👃 sniffed the wrong scroll. Nose exploded. Shameful.",
  "🪤 followed a trail of CHARM crumbs. Walked into a giant metaphor.",
  "🧸 hugged the trap. The trap hugged back. Forever.",
  "🪕 sang a folk song at the wrong time. The Ballad of 'Oops'.",
  "🪦 read their own name in the Book of Losses. Spontaneously combusted.",
  "🦀 chose 'scuttle left' instead of 'face your fate'. Got snipped.",
  "🧃 drank expired charmjuice. Became part of the drink.",
  "🛸 looked up and said 'Hey, what’s that—'. Abducted mid-sentence.",
  "🛼 rolled through the event like it was a joke. Tripped on fate.",
  "🎳 bowled with a Monster skull. The pins were ancestors. Bad idea.",
  "🦄 chased a shiny illusion. It chased back.",
  "💬 said the secret word. Out loud. In all caps.",
  "🩰 got caught doing interpretive dance during the Riddle. Eliminated for artistic reasons.",
  "📉 invested all their CHARM in rugcoin. Eliminated by market crash.",
  "🪱 misread the prophecy as a menu. Ordered worm salad.",
  "🎒 opened their inventory mid-fight. Got looted.",
  "📿 wore counterfeit lore beads. Instantly banished by the Lore Bouncer.",
  "🧯 tried to put out the fire of fate. Became steam.",
  "🎥 paused for a cinematic entrance. Got skipped like a cutscene.",
  "🧽 absorbed too much mystery. Squeezed by reality.",
  "🎤 dropped the mic. On their own foot. Eliminated by embarrassment.",
  "🎺 tooted the forbidden horn. The consequences were brass.",
  "🕰️ turned back time. Only for themselves. The Gauntlet disagreed.",
  "🧞‍♂️ wished to win. Genie replied, ‘lol no’.",
  "🦷 tried to bite fate. Broke a tooth. Fate bit back.",
  "🪚 sawed the branch they were standing on. Classic.",
  "🧻 summoned a monster with a tissue. Blown away.",
  "🧲 magnetized themselves to the wrong outcome.",
  "🧃 tried to bottle the CHARM. Bottled themselves instead.",
  "🎲 gambled everything on a 7-sided die. Rolled despair.",
  "📎 challenged reality with a paperclip. Paperclip won."
];
  const frozenLore = [
  "❄️ Froze mid-click and vanished.",
  "🪞 Stared too long at the buttons and became one.",
  "🐌 Moved too slow for the charm to care.",
  "🕳️ Hesitated and fell through a logic hole.",
  "🔕 Ignored fate's whisper. Ignored forever.",
  "⏳ Stalled out. The charm had no patience.",
  "🫥 Looked away for one moment too long.",
  "📵 No signal... or fate just declined the call.",
  "🪰 Swatted a bug instead of clicking. Guess who got squished.",
  "🔮 Got distracted gazing at the Oracle’s toes. Don’t ask.",
  "🐸 Thought they had more time. They were wrong.",
  "🧻 Went to grab toilet paper. Came back to a different timeline.",
  "🎈 Floated away while deciding.",
  "🥴 Got caught buffering mid-thought.",
  "🧼 Slipped on charm goo and never recovered.",
  "📺 Was watching a tutorial on ‘how to choose wisely.’ Too late.",
  "🪑 Got comfy and turned into a chair.",
  "🧊 Literally froze. Not metaphorical. Just ice now.",
  "🧃 Tried to hydrate mid-event. Absorbed by the charm instead.",
  "🎲 Rolled a dice to choose. It rolled off the world.",
  "🥽 Adjusted their VR headset… right into the void.",
  "🧻 Missed their chance while crafting the perfect reply.",
  "🎧 Was vibing to the Gauntlet soundtrack. Missed everything.",
  "🧠 Overthought it. Brain melted.",
  "🥸 Tried to disguise themselves as a button.",
  "📦 Took too long unboxing their fate.",
  "📿 Whispered a prayer. Got muted.",
  "💤 Took a micro-nap. Entered a macro-death.",
  "🐍 Asked the Oracle for advice. The Oracle blinked.",
  "🪤 Distracted by a trap that wasn’t even meant for them.",
  "🔌 Forgot to plug in their fate.",
  "🖲️ Hovered too long over the wrong choice.",
  "🕯️ Lit a candle for clarity. Got summoned instead.",
  "🕷️ Noticed something crawling on their screen. That was the Oracle.",
  "🫧 Popped a bubble of hope. It screamed.",
  "📿 Tried a ritual mid-round. It backfired with glitter.",
  "📘 Checked the Gauntlet manual. It wrote back.",
  "🎤 Said 'Wait, wait!' The charm didn’t.",
  "💽 Buffering… still buffering…"
];
const gainLifeLore = [
  "✨ absorbed ambient CHARM and gained a life!",
  "🫀 stole fate’s heartbeat. +1 life.",
  "🍀 rubbed a lucky token. It pulsed with life.",
  "🧃 drank from the forbidden juice box. It was… rejuvenating.",
  "🪄 caught a stray buff spell meant for someone else.",
  "🫧 bathed in glitchwater and came out stronger.",
  "📼 rewound their timeline by one frame. Gained a breath.",
  "🕯️ relit an extinguished wick deep within.",
  "🌪️ inhaled a tornado. Don’t ask how. It worked.",
  "🔁 undid their last mistake via obscure button.",
  "📦 opened a mystery box and found a heartbeat inside.",
  "🎲 rolled triple sevens on cursed dice. Lucky glitch!",
  "👅 licked a glowing rock *correctly* this time.",
  "🔋 recharged by hugging a Monster while it snored.",
  "👻 high-fived a ghost and felt alive again.",
  "📚 pronounced an ancient word right. The charm approved.",
  "💌 received a love letter from reality. It sparked vitality.",
  "🦴 reassembled themselves slightly better than before.",
  "🎤 dropped a sick verse. The crowd gave life back.",
  "🦠 embraced a charming virus. Side effect: extra life.",
  "💡 solved a riddle retroactively. Life refund granted.",
  "🫧 chewed air bubblegum. Popped into a bonus life.",
  "🛠️ duct taped their spirit back together. Surprisingly effective.",
  "🌕 howled at the moon and got a power-up.",
  "👀 stared into the void until it blinked first.",
  "📀 found a save point. Hit continue.",
  "🪑 sat in the right chair. +1 existential point.",
  "💿 pirated vitality.exe from a cursed mirror.",
  "🧼 cleaned their aura. Found a spare life behind it.",
  "🪞 out-negotiated their reflection. Took its life instead."
];
const reviveLore = [
  "🌪️ twisted their fate and returned to the arena!",
  "🌱 bloomed from the grave like a cursed daisy.",
  "💥 broke back in through pure chaos energy.",
  "🪦 kicked open their own tombstone and climbed out.",
  "🐍 shed their skin… and reappeared stronger.",
  "🧟‍♂️ returned mid-sentence. Death was mid-convo too.",
  "🚪 knocked three times on the wrong door — it opened.",
  "💫 was whispered back to life by a charm chant.",
  "🕳️ reverse-fell out of the void. Somehow intact.",
  "🪞 tricked a mirror into reviving them instead.",
  "🎯 landed a lucky hit on destiny’s reset button.",
  "📜 found an expired resurrection scroll. Still worked.",
  "🦷 bit into a cursed relic and got jolted back.",
  "🩸 bled into the sigil and it answered.",
  "📟 paged the charm from the underworld. Got through.",
  "🧶 unraveled themselves from oblivion. Very itchy.",
  "🧃 drank expired CHARM concentrate. Side effect: rebirth.",
  "👁‍🗨 was seen by the Oracle — and reborn out of pity.",
  "🎩 pulled themselves out of a hat.",
  "🧿 dodged finality with an off-brand evil eye.",
  "🔁 glitched through the timeline. Now they’re back.",
  "💿 hit CTRL+Z on death itself.",
  "🕯️ stole someone else’s candlelight. Typical move.",
  "📦 emerged from a shipping box marked ‘Return to Sender’.",
  "🗡️ stabbed their shadow and took its place.",
  "🫧 bubbled up through memory foam and lived again.",
  "🪤 escaped a trap — by switching roles with fate.",
  "🧷 patched their spirit with leftover CHARM tape.",
  "🔮 guessed the future wrong, but came back anyway.",
  "🧼 scrubbed off the afterlife like it was mold."
];

// === Mini-Game Lore Pool (20 Variants) ===
const miniGameLorePool = [
  {
    title: "🌪️ Vortex of Options",
    lore: "The wind howls with malice. Choose a button and face the storm.",
    buttons: ["Step into the gale", "Anchor to stone", "Whisper to the wind", "Leap toward the eye"]
  },
  {
    title: "🕯️ Candle of Fate",
    lore: "Each flame flickers with a different destiny. Which light do you trust?",
    buttons: ["Snuff the tall wick", "Light the blue flame", "Shield the flicker", "Blow gently"]
  },
  {
    title: "🎭 Masked Choices",
    lore: "Behind each mask lies your fate. Will it smile or snuff you out?",
    buttons: ["Put on the grin", "Don the blank face", "Hide behind sorrow", "Try the gold mask"]
  },
  {
    title: "🧪 Potions of Peril",
    lore: "Four vials shimmer before you. Sip one... if you dare.",
    buttons: ["Drink the red vial", "Smell the green fizz", "Lick the black ooze", "Swirl the gold dust"]
  },
  {
    title: "📜 Scrolls of the Unknown",
    lore: "Ancient scrolls rustle with secrets. One holds salvation.",
    buttons: ["Read the blood-stained scroll", "Unravel the burning one", "Touch the invisible ink", "Seal the parchment"]
  },
  {
    title: "🔮 Crystal Collapse",
    lore: "The orb pulses. You must touch one facet. One will shatter you.",
    buttons: ["Tap the violet shard", "Crack the green gleam", "Polish the smooth blue", "Peer into the cracked one"]
  },
  {
    title: "🎁 Ugly Gift Bags",
    lore: "They jiggle ominously. That’s probably fine.",
    buttons: ["Open the spotted sack", "Shake the slimy gift", "Reach in blind", "Sniff it first"]
  },
  {
    title: "🍀 Misfortune Cookies",
    lore: "Crack one open. Let’s hope it’s dessert and not doom.",
    buttons: ["Eat the broken one", "Crack the largest", "Pick the burnt edge", "Snap the clean shell"]
  },
  {
    title: "🧲 Magnetic Mayhem",
    lore: "Each choice draws you to a different end. Or beginning.",
    buttons: ["Choose north pull", "Align with chaos", "Countercharge fate", "Invert polarity"]
  },
  {
    title: "🕳️ Charmholes",
    lore: "Jump into one. Guess what’s on the other side.",
    buttons: ["Dive into the swirl", "Step into shadows", "Slide into the green glow", "Fall with eyes closed"]
  },
{
  title: "🧸 Twisted Toybox",
  lore: "An old toybox creaks open. Inside: relics from a forgotten childhood. Some bite.",
  buttons: ["Hug the patched bear", "Wind the rusty clown", "Pull the doll's string", "Open the music box"]
},
{
  title: "🪓 The Chopping Block",
  lore: "A game of choices—four levers, one blade. Will you kneel or rebel?",
  buttons: ["Pull the green lever", "Smash the red one", "Whisper to the white", "Yank the black cord"]
},
{
  title: "🐌 Slime Shrine",
  lore: "The goo bubbles and beckons. The shrine demands tribute.",
  buttons: ["Offer a tooth", "Touch the core", "Kiss the slime", "Throw in your shoe"]
},
{
  title: "🖼️ Living Portraits",
  lore: "Each painting shifts when you blink. Step into one… if you dare.",
  buttons: ["Enter the storm scene", "Crawl through the fire", "Climb the spiral stairs", "Stand on the floating rock"]
},
{
  title: "💤 Dream Shards",
  lore: "You are half-asleep. Four doors appear in your dream. One leads home.",
  buttons: ["Open the door of laughter", "Walk into the fog", "Slide beneath the mirror", "Fly into the crackling void"]
},
{
  title: "🧤 Gloves of Fate",
  lore: "These gloves don’t fit. They choose *you*. Which one will you wear?",
  buttons: ["Glove of thorns", "Glove of whispers", "Glove of ink", "Glove of eyes"]
},
{
  title: "🐀 Lab Maze",
  lore: "The lights flicker. You are the experiment. Time to run.",
  buttons: ["Turn left at the scratching", "Climb the air vent", "Follow the cheese", "Kick open the trapdoor"]
},
{
  title: "🎓 Cursed Classroom",
  lore: "A bell rings. You’re late. Four desks. One assignment. All graded by the charm.",
  buttons: ["Read the dark textbook", "Sharpen the floating pencil", "Copy from the pale kid", "Hide under the desk"]
},
{
  title: "🛁 Bathtub of Secrets",
  lore: "It’s full. It’s warm. Something is… breathing inside.",
  buttons: ["Reach below the foam", "Turn on the red tap", "Light the candle", "Whistle a lullaby"]
},
{
  title: "🧵 Thread of Destiny",
  lore: "Four threads dangle before you. Snip one, and weave your fate anew.",
  buttons: ["Snip the gold thread", "Tie the frayed black", "Untangle the red spiral", "Burn the green loop"]
}

  
];

// === Fate Lore Intros ===
const miniGameFateDescriptions = [
  "The charm stirs. Only one choice uplifts, the rest consume.",
  "Fate is sealed by your fingertip. Pick wrong and be erased.",
  "One button saves. The rest… echo with screams.",
  "The Oracle whispers: ‘Only one path leads back.’",
  "Choose quickly. The floor is melting.",
  "Pick a glyph. The charm decides who returns and who burns.",
  "Some paths heal. Others hex. All shimmer with deceit.",
  "Every option beckons. Not all forgive.",
  "Whispers curl around your ear: 'Click... and suffer.'",
  "A hum builds behind the buttons. One pulses with power.",
  "The charm watches silently. It hungers for bold choices.",
  "You feel eyes behind the veil. One choice opens them wider.",
  "They say minting guards you... They say a lot of things.",
  "A hidden rune glows brighter the more you've sacrificed.",
  "The Monster shifts in its slumber. Choose before it wakes.",
  "Three options lie. One offers a path to the next phase.",
  "The charm marks the faithful. Are you marked?",
  "Even the cursed may be spared... if they mint wisely.",
  "One path leads to the Malformed Market. The others, oblivion.",
  "If you've minted, the charm might show mercy.",
  "The air warps. The charm is testing your worthiness.",
  "Minted souls leave deeper footprints. One trail is safe.",
  "The buttons pulse in rhythm with your mint count.",
  "The more you've given, the more the charm may grant.",
  "Those who hoard CHARM may lose it. Those who spend, may rise."
];


const riddles = [
  { riddle: "I speak without a mouth and hear without ears. What am I?", answer: "echo" },
  { riddle: "The more you take, the more you leave behind. What are they?", answer: "footsteps" },
  { riddle: "What has to be broken before you can use it?", answer: "egg" },
  { riddle: "What runs but never walks, has a bed but never sleeps?", answer: "river" },
  { riddle: "I am always hungry, must always be fed. What am I?", answer: "fire" },
  { riddle: "I shrink smaller every time I take a bath. What am I?", answer: "soap" },
  { riddle: "The more you remove, the bigger I get. What am I?", answer: "hole" },
  { riddle: "I come once in a minute, twice in a moment, but never in a thousand years. What am I?", answer: "m" },
  { riddle: "What invention lets you look through walls?", answer: "window" },
  { riddle: "What can travel around the world while staying in the corner?", answer: "stamp" },
  { riddle: "I have cities but no houses, forests but no trees, and rivers but no water. What am I?", answer: "map" },
  { riddle: "What has a head, a tail, but no body?", answer: "coin" },
  { riddle: "What has hands but can’t clap?", answer: "clock" },
  { riddle: "The more you take away from me, the bigger I get. What am I?", answer: "hole" },
  { riddle: "What has one eye but can’t see?", answer: "needle" },
  { riddle: "What gets wetter as it dries?", answer: "towel" },
  { riddle: "What belongs to you but other people use it more than you do?", answer: "your name" },
  { riddle: "What has a neck but no head?", answer: "bottle" },
  { riddle: "What can you catch but not throw?", answer: "cold" },
  { riddle: "What has an eye but cannot see?", answer: "hurricane" },
  { riddle: "What goes up but never comes down?", answer: "age" },
  { riddle: "What comes once in a year, twice in a week, but never in a day?", answer: "e" },
  { riddle: "What gets broken without being held?", answer: "promise" },
  { riddle: "What kind of room has no doors or windows?", answer: "mushroom" },
  { riddle: "What can fill a room but takes up no space?", answer: "light" },
  { riddle: "What has many keys but can’t open a single lock?", answer: "piano" },
  { riddle: "If you drop me, I’m sure to crack, but give me a smile and I’ll always smile back. What am I?", answer: "mirror" },
  { riddle: "What can be cracked, made, told, and played?", answer: "joke" },
  { riddle: "What can you break, even if you never pick it up or touch it?", answer: "promise" },
  { riddle: "Where does today come before yesterday?", answer: "dictionary" },
  { riddle: "What begins with T, ends with T, and has T in it?", answer: "teapot" },
  { riddle: "What kind of band never plays music?", answer: "rubber band" },
  { riddle: "What goes through cities and fields, but never moves?", answer: "road" },
  { riddle: "What kind of tree can you carry in your hand?", answer: "palm" },
  { riddle: "What has four wheels and flies?", answer: "garbage truck" },
  { riddle: "What is full of holes but still holds water?", answer: "sponge" },
  { riddle: "If you have me, you want to share me. If you share me, you don’t have me. What am I?", answer: "secret" },
  { riddle: "What comes down but never goes up?", answer: "rain" },
  { riddle: "What has a thumb and four fingers but is not alive?", answer: "glove" },
  { riddle: "What begins with an E, but only contains one letter?", answer: "envelope" },
  { riddle: "What do you throw out when you want to use it but take in when you don’t want to use it?", answer: "anchor" },
  { riddle: "What has teeth but can’t bite?", answer: "comb" },
  { riddle: "The more there is, the less you see. What is it?", answer: "darkness" },
  { riddle: "What can run but never walks, has a mouth but never talks?", answer: "river" },
  { riddle: "What has legs but doesn’t walk?", answer: "table" },
  { riddle: "What kind of coat is best put on wet?", answer: "paint" },
  { riddle: "What flies without wings?", answer: "time" },
  { riddle: "What has roots as nobody sees, is taller than trees, up, up it goes, and yet never grows?", answer: "mountain" },
  { riddle: "What can't be used until it is broken?", answer: "egg" },
  { riddle: "What is so fragile that saying its name breaks it?", answer: "silence" },
  { riddle: "What has a bottom at the top?", answer: "leg" },
  { riddle: "What is easy to lift but hard to throw?", answer: "feather" },
  { riddle: "What runs all around a backyard, yet never moves?", answer: "fence" },
  { riddle: "What kind of cup can’t hold water?", answer: "cupcake" },
  { riddle: "What has ears but cannot hear?", answer: "corn" },
  { riddle: "What comes in many colors and is a favorite of children all over the world, yet it can’t be eaten?", answer: "crayon" },
  { riddle: "What gets sharper the more you use it?", answer: "brain" },
  { riddle: "What kind of ship has two mates but no captain?", answer: "relationship" },
  { riddle: "What disappears the moment you say its name?", answer: "silence" },
  { riddle: "What has a ring but no finger?", answer: "telephone" },
  { riddle: "What goes up and down but never moves?", answer: "staircase" },
  { riddle: "What can’t talk but will reply when spoken to?", answer: "echo" },
  { riddle: "What can be seen once in a minute, twice in a moment, and never in a thousand years?", answer: "m" },
  { riddle: "What has words but never speaks?", answer: "book" },
  { riddle: "What has a spine but no bones?", answer: "book" },
  { riddle: "I’m tall when I’m young, and I’m short when I’m old. What am I?", answer: "candle" },
  { riddle: "What comes after thunder?", answer: "lightning" },
  { riddle: "You buy me to eat but never eat me. What am I?", answer: "plate" },
  { riddle: "What lives if fed, but dies if you give it a drink?", answer: "fire" },
  { riddle: "What two things can you never eat for breakfast?", answer: "lunch and dinner" },
  { riddle: "What travels faster: heat or cold?", answer: "heat" },
  { riddle: "What has a face and two hands but no arms or legs?", answer: "clock" },
  { riddle: "I’m always in front of you but can’t be seen. What am I?", answer: "future" },
  { riddle: "What can you hold in your left hand but not your right?", answer: "your right elbow" },
  { riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?", answer: "m" }
];


// === NFT Image Fetching ===
function getUglyImageUrl() {
  const tokenId = Math.floor(Math.random() * 615) + 1;
  return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
}

function getMonsterImageUrl() {
  const tokenId = Math.floor(Math.random() * 126) + 1;
  return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}

// === Utility ===
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
// === Gauntlet Command: Public Join Phase ===
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!gauntlet')) {
  if (!authorizedUsers.includes(message.author.id)) {
    return message.reply("⛔ Only authorized users can start the Gauntlet.");
  }

    const minutes = parseFloat(message.content.split(' ')[1]) || 1;
    if (activeGame) return message.reply('⛔ A Gauntlet is already running!');

    const players = new Map();
    gameChannel = message.channel;

    const joinButton = new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Primary);

    const joinRow = new ActionRowBuilder().addComponents(joinButton);

const joinEmbed = new EmbedBuilder()
  .setTitle('⚔️ A New Gauntlet Is Forming...')
  .setDescription(`Click the button below to enter the arena!\n\n⏳ Starts in **${minutes} minute(s)**\n👥 Joined: **0** players`)
  .setImage('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?ex=683bc2ca&is=683a714a&hm=f9ca4a5ebcb5a636b7ce2946fd3c4779f58809b183ea1720a44d04f45c3b8b36&=&format=webp&quality=lossless&width=930&height=930') // ⬅️ Update this URL
  .setColor(0x880088);


    const msg = await message.channel.send({
      content: '@everyone ⚔️ A new Gauntlet is forming!',
      embeds: [joinEmbed],
      components: [joinRow]
    });

    joinMessageLink = msg.url;

    const collector = msg.createMessageComponentCollector({ time: minutes * 60_000 });

    collector.on('collect', async i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });

        const updatedEmbed = EmbedBuilder.from(joinEmbed)
          .setDescription(`Click the button below to enter the arena!\n\n⏳ Starts in **${minutes} minute(s)**\n👥 Joined: **${players.size}** players`);

        await msg.edit({ embeds: [updatedEmbed], components: [joinRow] });

        await i.reply({ content: '⚔️ You’ve joined The Gauntlet!', flags: 64 });
      } else {
        await i.reply({ content: '🌀 You’re already in!', flags: 64 });
      }
    });

    const reminderTimes = [1 / 3, 2 / 3].map(f => Math.floor(minutes * 60_000 * f));
    for (const t of reminderTimes) {
      setTimeout(() => {
        message.channel.send(`@everyone ⏳ Still time to join The Gauntlet! ${joinMessageLink}`);
      }, t);
    }

    setTimeout(async () => {
      if (players.size < 3) return message.channel.send('❌ Not enough players to run the Gauntlet.');

      activeGame = { players: new Map(players), startTime: Date.now() };
      message.channel.send(`🎮 Join phase ended. **${players.size}** players are entering The Gauntlet...`);
      await runBossVotePhase(players, message.channel);
    }, minutes * 60_000);
  }
});
client.on('messageCreate', async (message) => {
  if (message.content === '!testgauntlet') {
  if (!authorizedUsers.includes(message.author.id)) {
    return message.reply("⛔ You don't have permission to run test Gauntlets.");
  }
    if (activeGame) return message.reply('⛔ A Gauntlet is already running!');

    const players = new Map();
    gameChannel = message.channel;

    const joinButton = new ButtonBuilder()
      .setCustomId('join_gauntlet_test')
      .setLabel('Join the Gauntlet')
      .setStyle(ButtonStyle.Primary);

    const joinRow = new ActionRowBuilder().addComponents(joinButton);

    let joinEmbed = new EmbedBuilder()
      .setTitle('⚔️ Test Gauntlet Forming...')
      .setDescription(`Click below to enter!\n\n⏳ Starts in **8 seconds**\n\n**Players Joined: 0**`)
      .setImage('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?ex=683bc2ca&is=683a714a&hm=f9ca4a5ebcb5a636b7ce2946fd3c4779f58809b183ea1720a44d04f45c3b8b36&=&format=webp&quality=lossless&width=930&height=930')
      .setColor(0x0077ff);

    const msg = await message.channel.send({ content: '🧪 Test Gauntlet is forming!', embeds: [joinEmbed], components: [joinRow] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });

    collector.on('collect', async i => {
      if (!players.has(i.user.id)) {
        players.set(i.user.id, { id: i.user.id, username: i.user.username, lives: 1 });
        await i.reply({ content: `✅ You're in!`, flags: 64 });

        // Update embed with new player count
        joinEmbed.setDescription(`Click below to enter!\n\n⏳ Starts in **8 seconds**\n\n**Players Joined: ${players.size}**`);
        await msg.edit({ embeds: [joinEmbed] });
      } else {
        await i.reply({ content: `🌀 Already joined.`, flags: 64 });
      }
    });

    collector.on('end', async () => {
      // Add mock players to hit 20 total
      const needed = 20 - players.size;
      for (let i = 0; i < needed; i++) {
        const id = `mock_${i}`;
        players.set(id, { id, username: `Mock${i + 1}`, lives: 1 });
      }

      activeGame = { players: new Map(players), startTime: Date.now() };
      await message.channel.send(`🎮 Join phase ended. **${players.size}** players are entering The Gauntlet...`);
      await runBossVotePhase(players, message.channel);
    });
  }
});

async function runBossVotePhase(players, channel) {
  const candidates = [...players.values()].sort(() => 0.5 - Math.random()).slice(0, 5);
  const row = new ActionRowBuilder();
  candidates.forEach(p => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bossvote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('👁️ BOSS VOTE!')
    .setDescription('Choose who should become **Extra Ugly** and earn 1 bonus life.\nVote wisely...')
    .setColor(0xff00ff);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const votes = {};
  const collector = msg.createMessageComponentCollector({ time: 10_000 });
  collector.on('collect', i => {
    if (!votes[i.user.id]) {
      const voted = i.customId.replace('bossvote_', '');
      votes[i.user.id] = voted;
      i.reply({ content: '🗳️ Vote cast!', flags: 64 });
    } else {
      i.reply({ content: '❌ You already voted!', flags: 64 });
    }
  });

  collector.on('end', async () => {
    const tally = {};
    Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);
    const winnerId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || candidates[0].id;
    const winner = players.get(winnerId);
    winner.lives += 1;

    const announce = new EmbedBuilder()
      .setTitle('👑 The Extra Ugly Is Chosen!')
      .setDescription(`🎉 **${winner.username}** was voted the Boss and now has **2 lives!**`)
      .setColor(0xff66ff);

    await channel.send({ embeds: [announce] });
    await wait(2000);
    runGauntlet(players, channel);
  });
}
// === Main Gauntlet Game Loop ===
async function runGauntlet(players, channel) {
  const playerMap = new Map(players);
  let eliminated = new Map();
  let eventNumber = 1;
  let incentiveTriggered = false;
  let active = [...playerMap.values()];
  const maxEvents = 100;

  while (active.length > 3 && eventNumber <= maxEvents) {
    const eventTitle = `⚔️ Event #${eventNumber}`;
    const loreIntro = `🌀 *The warp churns... new horrors rise...*`;
    const nftImg = getUglyImageUrl();

    // === Embed 1: Lore & Ugly Image ===
    const introEmbed = new EmbedBuilder()
      .setTitle(eventTitle)
      .setDescription(loreIntro)
      .setImage(nftImg)
      .setColor(0xaa00ff);

    await channel.send({ embeds: [introEmbed] });
    await wait(2000);

    // === Embed 2: Run Mini-Game (with countdown) ===
    const miniGameResults = await runMiniGameEvent(active, channel, eventNumber);

    // === Embed 3: Show Elimination Results One-by-One ===
    await displayEliminations(miniGameResults, channel);

    // === Riddle Phase with Countdown and Pause ===
    await runRiddleEvent(channel, active);

    // === Remove Dead Players ===
    for (let player of active) {
      if (player.lives <= 0 && !eliminated.has(player.id)) {
        eliminated.set(player.id, player);
        currentPlayers.delete(player.id);
      }
    }

    active = [...playerMap.values()].filter(p => !eliminated.has(p.id));
// === Incentive Unlock Trigger ===
const originalCount = players.length;
if (!incentiveTriggered && active.length <= Math.floor(originalCount / 2)) {
  incentiveTriggered = true;
  await runIncentiveUnlock(channel);
}
    eventNumber++;
    await wait(3000);
  }

  await showPodium(channel, [...playerMap.values()]);
  activeGame = null;
  rematchCount++;
  if (rematchCount < maxRematches) await showRematchButton(channel, [...playerMap.values()]);
}
// === Mini-Game Event with Countdown and Secret Outcome ===
async function runMiniGameEvent(players, channel, eventNumber) {
  const outcomeTypes = ['lose', 'gain', 'eliminate', 'safe'];
  const randomOutcome = () => outcomeTypes[Math.floor(Math.random() * outcomeTypes.length)];
  const randomStyle = () => [
    ButtonStyle.Primary,
    ButtonStyle.Danger,
    ButtonStyle.Secondary,
    ButtonStyle.Success
  ][Math.floor(Math.random() * 4)];

  const resultMap = new Map();
  const clickedPlayers = new Set();
  const chosenLore = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
  const fateLine = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];
  const buttonLabels = chosenLore.buttons;
  const buttons = ['A', 'B', 'C', 'D'];
  const outcomeMap = new Map();

  buttons.forEach(label => outcomeMap.set(label, randomOutcome()));

  const timestamp = Date.now();
  const row = new ActionRowBuilder();
  buttons.forEach((label, index) => {
    const uniqueId = `mini_${label}_evt${eventNumber}_${timestamp}`;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(uniqueId)
        .setLabel(buttonLabels[index])
        .setStyle(randomStyle())
    );
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎲 Event #${eventNumber}: ${chosenLore.title}`)
    .setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **20 seconds**`)
    .setColor(0xff66cc);

  const message = await channel.send({ embeds: [embed], components: [row] });

  // === Start the collector immediately for 20 seconds ===
  const collector = message.createMessageComponentCollector({ time: 20000 });

  collector.on('collect', async i => {
    const labelMatch = i.customId.match(/mini_([A-D])_evt/);
    if (!labelMatch) return;

    const label = labelMatch[1];
    const outcome = outcomeMap.get(label);
    const labelIndex = buttons.indexOf(label);
    const displayText = buttonLabels[labelIndex];

    clickedPlayers.add(i.user.id);
    resultMap.set(i.user.id, outcome);
    let player = players.find(p => p.id === i.user.id);

    if (!player) {
      if (outcome === 'gain') {
        const revived = { id: i.user.id, username: i.user.username, lives: 1 };
        players.push(revived);
        activeGame.players.set(i.user.id, revived);
        currentPlayers.set(i.user.id, revived);
        await i.reply({ content: `💫 You selected **${displayText}** and were PULLED INTO THE GAUNTLET!`, flags: 64 });
      } else {
        return i.reply({ content: `❌ You selected **${displayText}** but fate denied your re-entry.`, flags: 64 });
      }
    } else {
      if (outcome === 'eliminate') player.lives = 0;
      else if (outcome === 'lose') player.lives -= 1;
      else if (outcome === 'gain') player.lives += 1;

      const emojiMap = {
        gain: '❤️ You gained a life!',
        lose: '💢 You lost a life!',
        eliminate: '💀 You were instantly eliminated!',
        safe: '😶 You survived untouched.'
      };

      await i.reply({ content: `🔘 You selected **${displayText}** → ${emojiMap[outcome]}`, flags: 64 });
    }
  });

  // === Countdown UI updates ===
  for (let timeLeft of [15, 10, 5]) {
    await wait(5000);
    embed.setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **${timeLeft} seconds**`);
    await message.edit({ embeds: [embed] });
  }

  await wait(5000); // Final 5 seconds

  // === Collector ends after 20s; now evaluate non-clickers ===
  const frozenPlayers = [];
  for (let player of players) {
    if (!clickedPlayers.has(player.id)) {
      const eliminated = Math.random() < 0.5;
      resultMap.set(player.id, eliminated ? 'eliminate' : 'ignored');
      if (eliminated) player.lives = 0;

      frozenPlayers.push({
        username: player.username,
        eliminated,
        lore: frozenLore[Math.floor(Math.random() * frozenLore.length)]
      });
    }
  }

  return resultMap;
}


// === Mint Incentive Ops ===
async function runIncentiveUnlock(channel) {
  const targetNumber = Math.floor(Math.random() * 50) + 1;
  const guesses = new Map(); // user.id => guessed number

  const incentiveRewards = [
    '🎁 Mint 3 Uglys → Get 1 Free!',
    '💸 Every mint earns **double $CHARM**!',
    '👹 Only 2 burns needed to summon a Monster!',
    ];

  const monsterImg = getMonsterImageUrl();

  // --- Initial prompt
  const embed = new EmbedBuilder()
    .setTitle('🧠 Incentive Unlock Challenge')
    .setDescription(
      `An eerie silence falls over the arena... but the air tingles with potential.\n\n` +
      `**Guess a number between 1 and 50.**\n` +
      `If ANYONE gets it right, a global community incentive will be unlocked!\n\n` +
      `⏳ You have 10 seconds...`
    )
    .setImage(monsterImg)
    .setColor(0xff6600)
    .setFooter({ text: 'Type your number in the chat now. Only 1 try!' });

  await channel.send({ embeds: [embed] });

  const filter = m => {
    const guess = parseInt(m.content.trim());
    return !isNaN(guess) && guess >= 1 && guess <= 50 && !guesses.has(m.author.id);
  };

  const collector = channel.createMessageCollector({ filter, time: 10000 });

  collector.on('collect', msg => {
    guesses.set(msg.author.id, parseInt(msg.content.trim()));
  });

  collector.on('end', async () => {
    const winners = [...guesses.entries()].filter(([_, num]) => num === targetNumber).map(([id]) => `<@${id}>`);

    if (winners.length > 0) {
      const incentive = incentiveRewards[Math.floor(Math.random() * incentiveRewards.length)];

      const winEmbed = new EmbedBuilder()
        .setTitle('🎉 Incentive Unlocked!')
        .setDescription(
          `🧠 The magic number was **${targetNumber}**.\n` +
          `✅ ${winners.join(', ')} guessed correctly!\n\n` +
          `🎁 **New Community Incentive Unlocked:**\n${incentive}\n\n` +
          `📩 Open a ticket to claim. This expires in **24 hours** — act fast!`
        )
        .setImage(monsterImg)
        .setColor(0x33ff66)
        .setFooter({ text: 'Unlocked by the power of the malformed minds.' });

      await channel.send({ embeds: [winEmbed] });

    } else {
      const failEmbed = new EmbedBuilder()
        .setTitle('🧤 The Offer Remains Sealed...')
        .setDescription(
          `No one guessed the correct number (**${targetNumber}**).\n\n` +
          `The incentive stays locked, its power fading into the void... for now.`
        )
        .setImage(monsterImg)
        .setColor(0x990000)
        .setFooter({ text: 'The Charm rewards those who dare... and guess well.' });

      await channel.send({ embeds: [failEmbed] });
    }
  });
}


// === Display Unified Results ===
async function displayEliminations(resultMap, channel) {
  const eliminated = [];
  const revived = [];
  const gainedLife = [];
  const inactiveEliminations = [];

  // Track who didn't click
  const players = [...activeGame.players.values()];
  const clickedIds = [...resultMap.keys()];

  for (let player of players) {
    if (!clickedIds.includes(player.id)) {
      const eliminatedByInactivity = Math.random() < 0.5;
      resultMap.set(player.id, eliminatedByInactivity ? 'frozen' : 'ignored');
      if (eliminatedByInactivity) {
        player.lives = 0;
        inactiveEliminations.push(player);
      }
    }
  }

  for (let [userId, outcome] of resultMap.entries()) {
    const player = activeGame.players.get(userId);
    if (!player) continue;

    if (outcome === 'eliminate') eliminated.push(player);
    else if (outcome === 'gain' && player.lives === 1) revived.push(player); // Revived from dead
    else if (outcome === 'gain') gainedLife.push(player);
    else if (outcome === 'frozen') inactiveEliminations.push(player);
  }

  // Prepare sections (randomized order)
  const categories = [
    { title: "__Mini Game Eliminations__", data: eliminated, emoji: "💀", lore: funnyEliminations },
    { title: "__Revived Players__", data: revived, emoji: "💫", lore: reviveLore },
    { title: "__Additional Lives__", data: gainedLife, emoji: "❤️", lore: gainLifeLore },
    { title: "__Inactive Eliminations__", data: inactiveEliminations, emoji: "🧊", lore: frozenLore }
  ].sort(() => Math.random() - 0.5);

  const embed = new EmbedBuilder()
    .setTitle('📜 Results Round')
    .setDescription('Processing the outcome of this trial...')
    .setColor(0xff5588);

  const msg = await channel.send({ embeds: [embed] });

  for (const cat of categories) {
    if (cat.data.length === 0) continue;

    embed.data.description += `\n\n**${cat.title}**\n`;

    for (let p of cat.data) {
      const line = `${cat.emoji} <@${p.id}> ${cat.lore[Math.floor(Math.random() * cat.lore.length)]}`;
      embed.data.description += line + `\n`;
      await msg.edit({ embeds: [embed] });
      await wait(400);
    }
  }

  if (embed.data.description.trim() === 'Processing the outcome of this trial...') {
    embed.setDescription('The charm is silent. No one was claimed, no one returned.');
    await msg.edit({ embeds: [embed] });
  }
}

// === Riddle Phase with Countdown & Monster Image ===
async function runRiddleEvent(channel, players) {
  const { riddle, answer } = riddles[Math.floor(Math.random() * riddles.length)];
  const monsterImg = getMonsterImageUrl();

  let countdown = 30;
  const embed = new EmbedBuilder()
    .setTitle('🧠 Ugly Oracle Riddle')
    .setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${countdown} seconds**`)
    .setImage(monsterImg)
    .setColor(0x00ffaa)
    .setFooter({ text: `Only one may earn the Oracle's favor...` });

  const msg = await channel.send({ embeds: [embed] });

  const correctPlayers = new Set();
  const filter = m => {
    return players.some(p => p.id === m.author.id) && m.content.toLowerCase().includes(answer.toLowerCase());
  };

  const collector = channel.createMessageCollector({ filter, time: countdown * 1000 });

  collector.on('collect', async msg => {
    if (!correctPlayers.has(msg.author.id)) {
      correctPlayers.add(msg.author.id);

      const player = players.find(p => p.id === msg.author.id);
      if (player) player.lives += 1;

      // Delete answer to keep it hidden
      await msg.delete().catch(() => {});

      // Ephemeral confirmation
      await channel.send({
        content: `🔮 You answered correctly — the Oracle grants you **+1 life**.`,
        flags: 64,
        allowedMentions: { users: [msg.author.id] },
        embeds: [],
        components: []
      }).catch(() => {});
    } else {
      await msg.delete().catch(() => {});
    }
  });

  // Countdown embed updater
  const countdownIntervals = [25, 20, 15, 10, 5];
  for (const secondsLeft of countdownIntervals) {
    await wait(5000);
    embed.setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${secondsLeft} seconds**`);
    await msg.edit({ embeds: [embed] });
  }

  collector.on('end', async () => {
    if (correctPlayers.size === 0) {
      await channel.send(`⏳ The Oracle received no answer this time...`);
    } else {
      const summary = [...correctPlayers].map(id => `<@${id}>`).join(', ');
      await channel.send(`🌟 The Oracle blesses ${summary} with +1 life.`);
    }
  });

  await wait(5000);
}

// === Show Final Podium ===
async function showPodium(channel, players) {
  const alive = players.filter(p => p.lives > 0);
  const ranked = [...alive].sort((a, b) => b.lives - a.lives);

  // Fill up to 3 if fewer than 3 survived
  while (ranked.length < 3) {
    const fillers = players.filter(p => !ranked.includes(p)).slice(0, 3 - ranked.length);
    ranked.push(...fillers);
  }

  // Determine top 3 by lives
  const top3 = ranked.slice(0, 3);
  const maxLives = top3[0]?.lives || 0;
  const tied = top3.filter(p => p.lives === maxLives);

  const medals = ['🥇', '🥈', '🥉'];
  const fields = top3.map((p, i) => ({
    name: `${medals[i]} ${p.username}`,
    value: `Lives remaining: **${p.lives}**`,
    inline: true
  }));

  const embed = new EmbedBuilder()
    .setTitle('🏁 The Gauntlet Has Ended!')
    .setDescription('Here are the Top 3 survivors of the Ugly Trials:')
    .addFields(fields)
    .setColor(0xf5c518);

  await channel.send({ embeds: [embed] });

  // If there’s a full tie for first (2 or 3 players), do a sudden death round
  if (tied.length > 1) {
    await channel.send(`⚖️ Tiebreaker required! ${tied.map(p => p.username).join(', ')} all have ${maxLives} lives!`);
    await runTiebreaker(channel, tied);
  }
}


// === Sudden Death Button Duel ===
async function runTiebreaker(channel, tiedPlayers) {
  const row = new ActionRowBuilder();
  tiedPlayers.forEach((p, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tie_${p.id}`)
        .setLabel(p.username)
        .setStyle([ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Success][i % 3])
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Sudden Death!')
    .setDescription(`All tied players must act! Click your name first to survive.\nOnly one will move on...`)
    .setColor(0xdd2222);

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 10_000 });
  const alreadyClicked = new Set();

  collector.on('collect', async i => {
    if (alreadyClicked.has(i.user.id)) {
      return i.reply({ content: '⏳ You already acted!', flags: 64 });
    }

    const winner = tiedPlayers.find(p => `tie_${p.id}` === i.customId);
    if (winner) {
      alreadyClicked.add(i.user.id);
      await channel.send(`🎉 **${winner.username}** wins the sudden death tiebreaker!`);
      collector.stop();
    }
  });

  collector.on('end', async collected => {
    if (!collected.size) {
      await channel.send(`💤 No one clicked in time. The Gauntlet claims all the tied souls.`);
    }
  });
}
// === Show Rematch Button & Wait for Votes ===
async function showRematchButton(channel, finalPlayers) {
  const requiredVotes = Math.ceil(finalPlayers.length * 0.75);
  const votes = new Set();

  const voteButton = new ButtonBuilder()
    .setCustomId('rematch_vote')
    .setLabel(`🔁 Run It Back (0/${requiredVotes})`)
    .setStyle(ButtonStyle.Success);

  const rematchRow = new ActionRowBuilder().addComponents(voteButton);

  const msg = await channel.send({
    content: `🏁 The Gauntlet has ended. Want to play again?\nAt least **75%** of players must vote to rematch.\nFinal players: **${finalPlayers.length}**`,
    components: [rematchRow]
  });

  const collector = msg.createMessageComponentCollector({ time: 30_000 });

  collector.on('collect', async i => {
    if (!finalPlayers.find(p => p.id === i.user.id)) {
      return i.reply({ content: `⛔ Only final players can vote.`, flags: 64 });
    }

    if (votes.has(i.user.id)) {
      return i.reply({ content: `✅ Already voted!`, flags: 64 });
    }

    votes.add(i.user.id);
    await i.reply({ content: `🔁 You're in for another round!`, flags: 64 });

    const newButton = ButtonBuilder.from(voteButton)
      .setLabel(`🔁 Run It Back (${votes.size}/${requiredVotes})`);

    const newRow = new ActionRowBuilder().addComponents(newButton);
    await msg.edit({ components: [newRow] });
  });

  collector.on('end', async () => {
    const percent = (votes.size / finalPlayers.length) * 100;
    if (percent >= 75 && rematchCount < maxRematches) {
      channel.send(`✅ **${votes.size}** voted to restart! The Gauntlet begins anew...`);
      const playerMap = new Map();
      finalPlayers.forEach(p => {
        playerMap.set(p.id, { id: p.id, username: p.username, lives: 1 });
      });
      activeGame = { players: playerMap, rematch: true };
      await runBossVotePhase(playerMap, channel);
    } else {
      rematchCount = 0;
      channel.send(`🛑 Rematch cancelled or max streak reached. Rest well, warriors.`);
    }
  });
}

// === Leaderboard Command ===
client.on('messageCreate', async (message) => {
  if (message.content === '!leaderboard') {
    const result = await db.query(`
      SELECT username, wins FROM player_stats
      ORDER BY wins DESC
      LIMIT 10;
    `);

    const top = result.rows.map((row, i) => `**#${i + 1}** ${row.username} — ${row.wins} wins`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Gauntlet Leaderboard')
      .setDescription(top || 'No games played yet!')
      .setColor(0x00ccff);

    message.channel.send({ embeds: [embed] });
  }
});
// === Check Lives Remaining ===
client.on('messageCreate', async (message) => {
  if (message.content === '!life') {
    if (!activeGame || !activeGame.players) {
      return message.reply('⚠️ No Gauntlet is currently running.');
    }

    const player = activeGame.players.get(message.author.id);
    if (!player) {
      return message.reply('💀 You are not currently in the Gauntlet or have been eliminated.');
    }

    return message.reply(`❤️ You currently have **${player.lives}** life${player.lives === 1 ? '' : 's'}.`);
  }
});

// === Stats Command ===
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!stats')) {
    const target = message.mentions.users.first() || message.author;

    const { rows } = await db.query(`
      SELECT * FROM player_stats
      WHERE user_id = $1
      LIMIT 1;
    `, [target.id]);

    if (!rows.length) {
      return message.reply(`No stats found for ${target.username}.`);
    }

    const stats = rows[0];
    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${stats.username}`)
      .setDescription(`Wins: ${stats.wins}\nRevives: ${stats.revives}\nDuels Won: ${stats.duels_won}\nGames Played: ${stats.games_played}`)
      .setColor(0xdddd00);

    message.channel.send({ embeds: [embed] });
  }
});
// === On Bot Ready ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Start Bot ===
client.login(TOKEN);
