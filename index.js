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
 db = new PgClient({
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
 maxRematches = 4;
 currentPlayers = new Map(); // userId => { username, lives }
 eliminatedPlayers = new Map(); // userId => { username, eliminatedAt }
 trialMode = false;
let gameChannel = null;
let joinMessageLink = null;
 authorizedUsers = ['826581856400179210', '1288107772248064044'];


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
const lostLifeMoments = [
  "🥴 tried to freestyle a chant. Summoned a headache and lost a life.",
  "🪙 flipped a CHARM coin and called ‘banana.’ Wrong.",
  "💅 paused to touch up their glam. The ritual did not approve.",
  "🍄 stepped on a glowing mushroom. Now slightly glitchy.",
  "📦 hid in a box labeled ‘Definitely Not Me’. It almost worked.",
  "📀 rewound a cursed VHS. Got flashbanged by 1997.",
  "🎯 aimed for glory. Hit a tree.",
  "🪩 brought a disco ball to the silence round. Lost a vibe… and a life.",
  "🧤 wore slippery gloves. Fate button slid. Oops.",
  "🐟 slapped a Monster with a fish. It was not amused.",
  "📢 shouted 'I GOT THIS!' — didn’t.",
  "🛹 ollied over the Oracle. Landed in a plot hole.",
  "📎 tried to unlock a fate door with a paperclip. Got zapped.",
  "🥒 mistook a relic for a pickle. Bit into doom.",
  "🍳 cooked breakfast during the trial. Got lightly scrambled.",
  "🧃 sipped ancient charmjuice. Lost a life and maybe some dignity.",
  "👑 declared themselves Champion. The Gauntlet rolled its eyes.",
  "🎩 pulled a worm from their hat. Wrong ritual.",
  "🪕 strummed a forbidden chord. Lore vibrated them backwards.",
  "🧦 wore mismatched socks. Slipped through dimensions slightly.",
  "🐌 raced a snail. Lost. Shame cost them 1 life.",
  "💼 opened a briefcase of secrets. Lost 1 life and 3 braincells.",
  "🕹️ mashed buttons like it was a game. The Gauntlet noticed.",
  "🧊 tried to cool off in the Charmhole. Caught a cold. Lost a life.",
  "📺 stared at static for too long. Mind melted a bit.",
  "🧤 slapped fate with a velvet glove. Fate slapped back.",
  "🎈 floated mid-trial chanting ‘I am air.’ Popped.",
  "🪑 chose the comfy chair. It bit them.",
  "🪥 brushed their teeth with Monster paste. Tingly… then ouch.",
  "🐸 kissed the wrong frog. Lost a life, gained regrets.",
  "📿 juggled fate beads. Dropped one. The important one.",
  "🥽 wore safety goggles. Still lost a life. Irony.",
  "🍔 ordered food from the Lore Café. Bit into mystery. Lost a life.",
  "🛁 took a bubble bath in cursed foam. Still squeaky clean, just minus 1 life.",
  "🎮 tried the Konami Code. Got a lore strike instead.",
  "🍌 slipped on an imaginary banana. It worked.",
  "🕳️ peeked into a metaphor. Fell halfway in.",
  "🧻 TP’d the Charm Tree. It TP’d them back.",
  "🎣 tried to fish in the Portal Pool. Hooked a whisper.",
  "🔋 licked a fate battery. Buzzed. Lost 1 life.",
  "🪞 winked at their reflection. It winked first. Confidence shook.",
  "🥤 spilled charmshake on the floor. Slipped in consequences.",
  "📖 skipped the footnotes. They were important.",
  "🪰 annoyed the Ritual Fly. Got divebombed by fate.",
  "🛎️ rang the forbidden bell. Got dinged for 1 life.",
  "📸 photobombed the Oracle. The photo came out cursed.",
  "🧻 wrote their name in the Book of Maybe. It updated to ‘Probably.’",
  "🕯️ blew out a ritual candle. Mood ruined. Life lost.",
  "🐍 tried to high five a snake. Got hissed into minus one.",
  "🧲 magnetized themselves to the wrong timeline. Had to wiggle free.",
  "🍭 licked the mystery lolly. Flavor: ‘1 less life.’",
  "🛷 sledded down Lore Hill. Bonked a prophecy.",
  "🪩 threw a dance party. Lost a life to the beat drop."
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
    title: "🎪 The Carnival Collapse",
    lore: "A haunted calliope screams. Four rides spin—one spirals into another realm.",
    buttons: ["Ride the Upside-Down Ferris", "Enter the Mirror Tent", "Chew the Cotton Scream", "Pet the Laughing Pony"]
  },
  {
    title: "📦 The Mystery Box Quadrant",
    lore: "Four boxes sit before you. Each hisses in a different accent.",
    buttons: ["Open the box with teeth marks", "Sniff the soggy one", "Kick the humming crate", "Whisper to the warm one"]
  },
  {
    title: "🌡️ Fever Dreams",
    lore: "You’re burning up. The charm offers four icy visions. Pick one to cool your core.",
    buttons: ["Swim in static", "Chew the ice mirror", "Melt into a song", "Lick the frost ghost"]
  },
  {
    title: "🔋 Battery Ritual",
    lore: "Each battery crackles with power—only one won’t fry your soul.",
    buttons: ["Lick the AA", "Swallow the glowing C", "Sit on the D", "Charge yourself with the ZZZ"]
  },
  {
    title: "🍽️ Dinner with the Charm",
    lore: "Dinner is served. It’s still moving. Pick your entrée.",
    buttons: ["Slurp the screaming soup", "Nibble the bone pie", "Sniff the neon salad", "Chomp the shadow steak"]
  },
  {
    title: "📺 Reality Tuner",
    lore: "Four TVs flicker with strange channels. Only one shows... yourself.",
    buttons: ["Tune to Static 13", "Rotate the cursed knob", "Plug into your spine", "Speak into the screen"]
  },
  {
    title: "🌙 Moonlight Bargain",
    lore: "The moon grins. You are offered four pacts. Only one doesn’t bite.",
    buttons: ["Kiss the night ink", "Trade your shadow", "Swear on a toad", "Offer your reflection"]
  },
  {
    title: "🧻 Toilet Choices",
    lore: "An abandoned gas station restroom. Four stalls. Something beckons.",
    buttons: ["Choose the graffiti stall", "Kick open the bloody one", "Crawl under the silent stall", "Flush them all at once"]
  },
  {
    title: "🧼 Soap Opera",
    lore: "Four talking soaps argue about who is cursed. Wash your hands of one.",
    buttons: ["Grab the foamy screamer", "Rub the cube with teeth", "Pick the weeping lavender", "Toss the flirty lemon"]
  },
  {
    title: "📅 Calendar of Catastrophe",
    lore: "One of these days is your lucky day. The others… you don’t want to know.",
    buttons: ["Circle Monday the 13th", "Rip out Wednesday", "Fold Sunday backwards", "Lick the leap day"]
  },
  {
    title: "🪑 Chair of Choices",
    lore: "One chair is safe. The rest bite, collapse, or whisper secrets you can’t unhear.",
    buttons: ["Sit on the cracked throne", "Balance on the slime stool", "Spin the carnival seat", "Float above the air chair"]
  },
  {
    title: "🎂 Forgotten Birthdays",
    lore: "Four cakes. One’s for you. The rest are... for others.",
    buttons: ["Blow out all the candles", "Taste the sour frosting", "Eat the candle", "Cut the cake with a bone"]
  },
  {
    title: "🐛 The Larva Lottery",
    lore: "Each larva wiggles with potential. One becomes a butterfly. The rest? Problems.",
    buttons: ["Adopt the chunky one", "Name the translucent squirm", "Pet the fuzzy mistake", "Feed the glowing worm"]
  },
  {
    title: "📠 Fax From Beyond",
    lore: "A dusty fax machine prints cryptic commands. Choose one and obey.",
    buttons: ["Sign in blood", "Call the number back", "Fold the fax into origami", "Fax yourself instead"]
  },
  {
    title: "🪚 Toolbox of Torment",
    lore: "Each tool knows your secrets. They whisper to be chosen.",
    buttons: ["Pick the laughing wrench", "Swing the sticky hammer", "Twist the warm screwdriver", "Nibble the measuring tape"]
  },
  {
    title: "📒 Yearbook of Regrets",
    lore: "You find a cursed yearbook. Choose someone’s memory to replace your own.",
    buttons: ["Swap with 'Most Likely to Ascend'", "Take the page with no face", "Erase the principal", "Add yourself twice"]
  },
  {
    title: "🎒 Backpack of Portals",
    lore: "Each zipper leads somewhere else. One opens back here.",
    buttons: ["Unzip the growling pocket", "Peek inside the infinity pouch", "Throw the whole thing", "Wear it and vanish"]
  },
  {
    title: "🧊 Ice Cubes of Destiny",
    lore: "One cube contains hope. The rest are frozen screams.",
    buttons: ["Swallow the cube with an eye", "Hold the one that pulses", "Smash the jagged cube", "Give your cube a name"]
  },
  {
    title: "📀 Cursed Mixtape",
    lore: "Four tracks echo in your mind. One drops a banger. The rest… end you.",
    buttons: ["Play Track 0", "Skip to the end", "Rewind forever", "Drop the mixtape"]
  },
  {
    title: "🔑 Keys to the Unknown",
    lore: "Four keys hang from a burning hook. Each unlocks a different doom.",
    buttons: ["Turn the melting key", "Bite the chrome one", "Use the key with a tail", "Sing to the gold one"]
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
  { riddle: "I crawl inside your house without legs. I eat your time but never your food. What am I?", answers: ["phone"] },
  { riddle: "The more you look, the less you see. Stare too long, and I stare back. What am I?", answers: ["mirror"] },
  { riddle: "My breath is silent. My body is cold. I follow you home, but I was never born. What am I?", answers: ["shadow"] },
  { riddle: "I was made to hold stories, but I never speak. I’ve got a spine, but I break easily. What am I?", answers: ["book"] },
  { riddle: "I sit in corners but see the world. I never blink, but I always watch. What am I?", answers: ["camera"] },
  { riddle: "I’m not food, but I’m fed. I’m not alive, but I grow. What am I?", answers: ["fire"] },
  { riddle: "My words aren’t spoken, but they echo forever. You trust me with your secrets. What am I?", answers: ["diary"] },
  { riddle: "Break me, and I vanish. Speak, and I die. What am I?", answers: ["silence"] },
  { riddle: "You’ll find me in the pit, but I’m not a peach. I take your breath and whisper lies. What am I?", answers: ["despair"] },
  { riddle: "I appear when you forget me. I vanish when you name me. What am I?", answers: ["dream"] },
  { riddle: "I am not yours, but I wear your face. I know your steps before you take them. What am I?", answers: ["reflection"] },
  { riddle: "You chase me in the morning and curse me at night. I slow time but never stop it. What am I?", answers: ["fatigue"] },
  { riddle: "I never existed, but everyone remembers me. I change shape when you look away. What am I?", answers: ["memory"] },
  { riddle: "I bleed numbers and eat seconds. My hands move but I don’t. What am I?", answers: ["clock"] },
  { riddle: "I’m lighter than air, but I crush the soul. I haunt your quiet moments. What am I?", answers: ["thought"] },
  { riddle: "I arrive with panic, stay without warning, and leave you shaking. What am I?", answers: ["anxiety"] },
  { riddle: "I fill rooms but have no shape. I hide monsters behind me. What am I?", answers: ["darkness"] },
  { riddle: "I drip when ignored, roar when angered, and leave nothing behind. What am I?", answers: ["leak"] },
  { riddle: "You pull me from your mind and wear me like armor. I’m never real, but I protect you. What am I?", answers: ["lie"] },
  { riddle: "You open me in anger. You close me in regret. I am silent but sharp. What am I?", answers: ["mouth"] },
  { riddle: "I wait in your attic, creak in your walls, and appear when you're alone. What am I?", answers: ["house"] },
  { riddle: "You cannot see me, but I change what you are. I seep into your voice. What am I?", answers: ["emotion"] },
  { riddle: "I float above graves and whisper to the dirt. I’m not alive, but I linger. What am I?", answers: ["ghost"] },
  { riddle: "I twist the truth and sharpen the tongue. I wear many masks. What am I?", answers: ["gossip"] },
  { riddle: "I go up but never down. I grow old with you, but I’m invisible. What am I?", answers: ["age", "time"] },
  { riddle: "I’m not alive, but I grow. I don’t have lungs, but I need air. I destroy everything I touch. What am I?", answers: ["fire", "flame"] },
  { riddle: "I reflect but never speak. I crack under pressure. What am I?", answers: ["mirror", "glass"] },
  { riddle: "I’m full of holes, yet I hold water. What am I?", answers: ["sponge", "net"] },
  { riddle: "I have arms and hands but no fingers. I show your schedule but never the time. What am I?", answers: ["clock", "watch", "calendar"] },
  { riddle: "You can find me on walls and faces. I tick but never talk. What am I?", answers: ["clock", "watch"] },
  { riddle: "I never stop moving, but I never go anywhere. I flow, but I’m not alive. What am I?", answers: ["time", "river"] },
  { riddle: "I come in many colors. Kids love me. I snap easily. What am I?", answers: ["crayon", "chalk", "colored pencil"] },
  { riddle: "I travel around the world but always stay in the same place. What am I?", answers: ["stamp", "postage stamp"] },
  { riddle: "I get sharper the more you use me. What am I?", answers: ["brain", "mind", "pencil"] },
  { riddle: "I fall but never rise. I soften the world. What am I?", answers: ["snow", "rain"] },
  { riddle: "What is never seen but always ahead? It can be shaped, but not held.", answers: ["future", "tomorrow"] },
  { riddle: "What has a tail and may flick, but isn’t alive? It’s in your hand but isn’t your friend.", answers: ["coin", "comet"] },
  { riddle: "You use me to eat, but you never eat me. What am I?", answers: ["plate", "fork", "spoon"] }
];


const gauntletOverviewEmbed = new EmbedBuilder()
  
  .setTitle('🌀 WELCOME TO THE GAUNTLET 🌀')
  .setDescription(
    "**A cursed survival game where each round throws you deeper into chaos.**\n\n" +
    "🎮 **Mini-Games** *(open to everyone — alive, eliminated, or lurking)*\n" +
    "Click a button and face one of **4 fates**:\n\n" +
    "🔓 **+1 Life** – Gain a life or return from the dead\n" +
    "💠 **Nothing** – Survive, untouched\n" +
    "💥 **Dead** – Instant elimination, no matter your lives\n" +
    "❄️ **-1 Life** – Lose one of your lives\n\n" +
    "😶 *Inaction is death.*\n" +
    "**50%** of inactive players are silently eliminated.\n\n" +
    "🧠 **Oracle Riddles** – Answer in 30 sec for **+1 Life**\n" +
    "⌛ Type `/life` or `!life` to check your lives\n\n" +
    "📸 Your Ugly or Monster NFT appears when you fall\n" +
    "🏆 Top 3 rise to the podium. Stats are forever.\n\n" +
    "*This isn’t luck. It’s malformed destiny.*\n\n" +
    "⚔️ **Click. Survive. Ascend.**"
  )
  .setColor(0x9b59b6);


// === NFT Image Fetching ===
function getUglyImageUrl() {
   tokenId = Math.floor(Math.random() * 615) + 1;
  return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
}

function getMonsterImageUrl() {
   tokenId = Math.floor(Math.random() * 126) + 1;
  return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}

// === Utility ===
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentMonthYear() {
   now = new Date();
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
      .setImage('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?ex=683bc2ca&is=683a714a&hm=f9ca4a5ebcb5a636b7ce2946fd3c4779f58809b183ea1720a44d04f45c3b8b36&=&format=webp&quality=lossless&width=930&height=930')
      .setColor(0x880088);

    const gauntletOverviewEmbed = new EmbedBuilder()
      .setTitle('🌌✨ 𝙏𝙃𝙀 𝙂𝘼𝙐𝙉𝙏𝙇𝙀𝙏: 𝘼 𝘾𝙐𝙍𝙎𝙀𝘿 𝘾𝙃𝘼𝙇𝙄𝘾𝙀 ✨🌌')
      .setDescription(
        `**Each round tears deeper into the void.**\nChoose wisely... or be erased.\n\n` +
        `🎮 **Mini-Games** *(open to ALL — alive, dead, or just watching)*\nClick to tempt fate... and face one of **4 warped outcomes**:\n\n` +
        `🔓 **+1 Life** – The charm blesses you. Rise again.\n` +
        `💠 **Nothing** – You remain... unchanged.\n` +
        `💥 **Dead** – You explode in silence. No lives can save you.\n` +
        `❄️ **-1 Life** – The charm saps your strength. One life lost.\n\n` +
        `😶 **Inaction = Death** — *50% of those who don’t click are erased without warning.*\n\n` +
        `🔮 **Oracle Riddles** – Solve within 30 sec to gain **+1 Life** from the Ugly Oracle.\n` +
        `⌛ Type \`!life\` or \`/life\` to check your soul’s status.\n\n` +
        `📸 When you fall, your **Ugly** or **Monster** NFT is summoned.\n` +
        `🏆 Top 3 stand on the final **Podium of Pain**. Your stats are eternal.\n\n` +
        `*This is not a game. It’s a ritual.*\n*This is not luck. It’s malformed destiny.*\n\n` +
        `⚔️ **𝘾𝙇𝙄𝘾𝙆. 𝙎𝙐𝙍𝙑𝙄𝙑𝙀. 𝘼𝙎𝘾𝙀𝙉𝘿.** ⚔️`
      )
      .setColor(0x6e00aa)
      .setThumbnail('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?ex=683bc2ca&is=683a714a&hm=f9ca4a5ebcb5a636b7ce2946fd3c4779f58809b183ea1720a44d04f45c3b8b36&=&format=webp&quality=lossless&width=128&height=128')
      .setFooter({ text: '💀 The charm is always watching.' });

    // Send the animated overview first
    await message.channel.send({ embeds: [gauntletOverviewEmbed] });

    // Then send the join message
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
    await wait(5000);
    runGauntlet(players, channel);
  });
}
// === Main Gauntlet Game Loop ===
async function runGauntlet(players, channel) {
  const playerArray = Array.isArray(players) ? players : Array.from(players.values?.() || players);
const playerMap = new Map(playerArray.map(p => [p.id, p]));
  let eliminated = new Map();
  let eventNumber = 1;
  let incentiveTriggered = false;
  const maxEvents = 100;
  const originalCount = players.length;

  let active = [...playerMap.values()];

  while (active.length > 3 && eventNumber <= maxEvents) {
    // === Embed 1: Lore & Ugly Image ===
    const introEmbed = new EmbedBuilder()
      .setTitle(`⚔️ Event #${eventNumber}`)
      .setDescription(`🌀 *The warp churns... new horrors rise...*`)
      .setImage(getUglyImageUrl())
      .setColor(0xaa00ff);
    await channel.send({ embeds: [introEmbed] });
    await wait(5000);

    // === Embed 2: Mini-Game ===
    const miniGameResults = await runMiniGameEvent(active, channel, eventNumber);

    // === Apply Mini-Game Outcomes ===
    for (const [userId, outcome] of miniGameResults.entries()) {
      const player = playerMap.get(userId);
      if (!player) continue;
      if (outcome === 'gain') player.lives = player.lives <= 0 ? 1 : player.lives + 1;
      else if (outcome === 'lose') player.lives = Math.max(0, player.lives - 1);
      else if (outcome === 'eliminate' || outcome === 'frozen') player.lives = 0;
    }

    // === Embed 3: Results Round ===
    await showResultsRound(miniGameResults, channel, [...playerMap.values()]);
    await wait(6000);

    // === Riddle Phase ===
    await runRiddleEvent(channel, active);

    // === Remove Dead Players ===
    for (let player of active) {
      if (player.lives <= 0 && !eliminated.has(player.id)) {
        eliminated.set(player.id, player);
        if (currentPlayers) currentPlayers.delete(player.id);
      }
    }

    // === Update Active Players ===
    active = [...playerMap.values()].filter(p => !eliminated.has(p.id));

    // === Incentive Unlock Trigger (Only Once) ===
    if (!incentiveTriggered && active.length <= Math.floor(originalCount / 2)) {
      incentiveTriggered = true;
      await runIncentiveUnlock(channel);
      await wait(3000);
    }

    eventNumber++;
    await wait(3000);
  }

  // === Endgame: Ritual or Podium ===
  const survivors = [...playerMap.values()].filter(p => p.lives > 0);

  if (survivors.length > 1) {
    await channel.send(`🔮 **FINAL RITUAL**\nToo many remain... The charm demands one final judgment.`);
    await runTiebreaker(survivors, channel);
    await wait(3000);
  } else if (survivors.length === 1) {
    await channel.send(`👑 Only one remains...`);
  } else {
    await channel.send(`💀 No survivors remain. The arena claims them all.`);
  }

  // === Final Podium ===
  await showPodium(channel, [...playerMap.values()]);
  activeGame = null;

  // === Rematch Offer ===
  rematchCount++;
  if (rematchCount < maxRematches) {
    await showRematchButton(channel, [...playerMap.values()]);
  }
}


// === Mini-Game Event with Countdown and Secret Outcome ===
async function runMiniGameEvent(players, channel, eventNumber) {
  const outcomes = ['gain', 'lose', 'eliminate', 'safe'];
  const shuffledOutcomes = outcomes.sort(() => 0.5 - Math.random());

  const randomStyle = () => [
    ButtonStyle.Primary,
    ButtonStyle.Danger,
    ButtonStyle.Secondary,
    ButtonStyle.Success
  ][Math.floor(Math.random() * 4)];

  const resultMap = new Map();
  const clickedPlayers = new Set();
  const buttonClicks = new Map();

  const chosenLore = miniGameLorePool[Math.floor(Math.random() * miniGameLorePool.length)];
  const fateLine = miniGameFateDescriptions[Math.floor(Math.random() * miniGameFateDescriptions.length)];
  const buttonLabels = chosenLore.buttons;
  const buttons = ['A', 'B', 'C', 'D'];
  const outcomeMap = new Map();

  buttons.forEach((label, index) => outcomeMap.set(label, shuffledOutcomes[index]));

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

  const collector = message.createMessageComponentCollector({ time: 20000 });

  collector.on('collect', async i => {
    const userId = i.user.id;

    if (buttonClicks.has(userId)) {
      return i.reply({ content: `🤪 Whoa there! You already chose your fate. The Charm doesn't like indecision...`, ephemeral: true });
    }

    const labelMatch = i.customId.match(/mini_([A-D])_evt/);
    if (!labelMatch) return;

    const label = labelMatch[1];
    const outcome = outcomeMap.get(label);
    const labelIndex = buttons.indexOf(label);
    const displayText = buttonLabels[labelIndex];

    clickedPlayers.add(userId);
    buttonClicks.set(userId, label);
    resultMap.set(userId, outcome);

    let player = players.find(p => p.id === userId);

    if (!player) {
      if (outcome === 'gain') {
        const revived = { id: userId, username: i.user.username, lives: 1 };
        players.push(revived);
        activeGame.players.set(userId, revived);
        currentPlayers.set(userId, revived);
        return i.reply({ content: `💫 You selected **${displayText}** and were **PULLED INTO THE GAUNTLET!**`, flags: 64 });
      } else {
        return i.reply({ content: `❌ You selected **${displayText}** but fate denied your entry.`, flags: 64 });
      }
    }

    if (player.lives <= 0) {
      return i.reply({ content: `💀 You are already eliminated and cannot be harmed or revived.`, flags: 64 });
    }

    const emojiMap = {
      gain: '❤️ You gained a life!',
      lose: '💢 You lost a life!',
      eliminate: '💀 You were instantly eliminated!',
      safe: '😶 You survived untouched.'
    };

    if (outcome === 'eliminate') player.lives = 0;
    else if (outcome === 'lose') player.lives -= 1;
    else if (outcome === 'gain') player.lives += 1;

    await i.reply({ content: `🔘 You selected **${displayText}** → ${emojiMap[outcome]}`, flags: 64 });
  });

  // === Countdown Timer Update ===
  for (let timeLeft of [15, 10, 5]) {
    await wait(5000);
    embed.setDescription(`${chosenLore.lore}\n\n${fateLine}\n\n⏳ Time left: **${timeLeft} seconds**`);
    await message.edit({ embeds: [embed] });
  }

  await wait(5000); // Final countdown

  // === Handle Inactive Players ===
  for (let player of players) {
    if (player.lives <= 0) continue;
    if (!clickedPlayers.has(player.id)) {
      const eliminated = Math.random() < 0.5;
      resultMap.set(player.id, eliminated ? 'eliminate' : 'ignored');
    }
  }

  return resultMap;
}


// === Mint Incentive Ops ===
// === Mint Incentive Ops (with Emoji Reaction + Reply) ===
async function runIncentiveUnlock(channel) {
  const targetNumber = Math.floor(Math.random() * 50) + 1;
  const guesses = new Map(); // user.id => guessed number
  const correctMessages = [];

  const incentiveRewards = [
    '🎁 Mint 3 Uglys → Get 1 Free!',
    '💸 Every mint earns **double $CHARM**!',
    '👹 Only 2 burns needed to summon a Monster!',
  ];

  const monsterImg = getMonsterImageUrl();

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
  if (!m.content || typeof m.content !== 'string') return false;
  const guess = parseInt(m.content.trim());
  return !isNaN(guess) && guess >= 1 && guess <= 50 && !guesses.has(m.author.id);
};



  const collector = channel.createMessageCollector({ filter, time: 10000 });

  collector.on('collect', msg => {
    const guess = parseInt(msg.content.trim());
    guesses.set(msg.author.id, guess);

    if (guess === targetNumber) {
      correctMessages.push(msg); // Save the message to react and reply to later
    }
  });

  collector.on('end', async () => {
    // React + reply to correct guesses
    for (const msg of correctMessages) {
      try {
        await msg.react('✅');
        await msg.reply({
          content: `🎯 You guessed it! **${targetNumber}** was correct — you helped unlock the incentive!`,
          allowedMentions: { repliedUser: true }
        });
      } catch (err) {
        console.error('Failed to react or reply to a correct guess:', err);
      }
    }

    const winners = correctMessages.map(m => `<@${m.author.id}>`);

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




// === Show Results Round (Dramatic Lore Edition) ===
async function showResultsRound(results, channel, players) {
  const gained = [];
  const lost = [];
  const revived = [];
  const eliminated = [];
  const inactivity = [];

  const flavor = {
    gained: gainLifeLore,
    lost: lostLifeMoments,
    revived: reviveLore,
    eliminated: funnyEliminations,
    inactivity: frozenLore
  };

  for (let player of players) {
    const outcome = results.get(player.id);
    if (!outcome) continue;

    const wasDead = player.lives === 0;

    if (outcome === 'gain') {
      if (wasDead) revived.push(player);
      else gained.push(player);
    } else if (outcome === 'lose') {
      lost.push(player);
    } else if (outcome === 'eliminate') {
      eliminated.push(player);
    } else if (outcome === 'ignored') {
      inactivity.push(player);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('📜 Results Round')
    .setDescription('The ritual is complete. The charm surveys the survivors...')
    .setColor(0xff66cc);

  const msg = await channel.send({ embeds: [embed] });

  const addFieldSlowly = async (title, list, key) => {
    if (!list.length) return;

    embed.addFields({ name: title, value: '‎', inline: false }); // invisible char
    await msg.edit({ embeds: [embed] });

    for (let p of list) {
      const flavorList = flavor[key];
      const randomLine = flavorList[Math.floor(Math.random() * flavorList.length)] || '';
      const newLine = `${randomLine} <@${p.id}>\n`;

      let fieldIndex = embed.data.fields.findIndex(f => f.name === title || f.name === `${title} (cont.)`);
      let currentValue = embed.data.fields[fieldIndex].value;

      if ((currentValue + newLine).length > 1024) {
        embed.addFields({ name: `${title} (cont.)`, value: newLine });
      } else {
        embed.data.fields[fieldIndex].value += newLine;
      }

      await msg.edit({ embeds: [embed] });
      await wait(600);
    }
  };

  await addFieldSlowly('❤️ Gained a Life', gained, 'gained');
  await addFieldSlowly('💢 Lost a Life', lost, 'lost');
  await addFieldSlowly('💫 Brought Back to Life', revived, 'revived');
  await addFieldSlowly('☠️ Eliminated by the Mini-Game', eliminated, 'eliminated');
  await addFieldSlowly('🧊 Eliminated by Inactivity', inactivity, 'inactivity');

  if (
    !gained.length && !lost.length && !revived.length &&
    !eliminated.length && !inactivity.length
  ) {
    embed.setDescription('⚖️ No lives changed hands. The charm smirks in silence.');
    await msg.edit({ embeds: [embed] });
  }

  await wait(6000);
}


// === Riddle Phase with Countdown & Monster Image ===
async function runRiddleEvent(channel, players) {
  const { riddle, answers } = riddles[Math.floor(Math.random() * riddles.length)];
  const safeAnswers = Array.isArray(answers)
    ? answers.map(a => a?.toLowerCase().trim())
    : [String(answers).toLowerCase().trim()];

  const monsterImg = getMonsterImageUrl();
  const countdown = 30;
  const correctPlayers = new Set();


  const embed = new EmbedBuilder()
    .setTitle('🧠 Ugly Oracle Riddle')
    .setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${countdown} seconds**`)
    .setImage(monsterImg)
    .setColor(0x00ffaa)
    .setFooter({ text: `Only one may earn the Oracle's favor...` });

  const msg = await channel.send({ embeds: [embed] });

  const filter = m => {
    if (!m || typeof m.content !== 'string') return false;
    const content = m.content.toLowerCase().trim();
    const isPlayer = players.some(p => p.id === m.author.id);
    return isPlayer && answers.some(ans => content.includes(ans));
  };

  const collector = channel.createMessageCollector({ filter, time: countdown * 1000 });

  collector.on('collect', async msg => {
    const userId = msg.author.id;
    const player = players.find(p => p.id === userId);
    const content = msg.content.toLowerCase().trim();

    if (!player || correctPlayers.has(userId)) return;

    correctPlayers.add(userId);
    player.lives += 1;

    await msg.delete().catch(() => {});

    await channel.send({
      content: `🔮 You answered correctly — the Oracle grants you **+1 life**.`,
      allowedMentions: { users: [userId] }
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
  });

  // Handle wrong guesses and ❌ reactions
  const wrongCollector = channel.createMessageCollector({ time: countdown * 1000 });
  wrongCollector.on('collect', async msg => {
    const userId = msg.author.id;
    const content = msg.content?.toLowerCase().trim();
    const isPlayer = players.some(p => p.id === userId);
    const isCorrect = answers.some(ans => content.includes(ans));

    if (isPlayer && !isCorrect) {
      await msg.react('❌').catch(() => {});
    }
  });

  // Countdown updates
  const countdownIntervals = [25, 20, 15, 10, 5];
  for (const secondsLeft of countdownIntervals) {
    await wait(5000);
    embed.setDescription(`**“${riddle}”**\n\nType the correct answer in chat.\n⏳ Time left: **${secondsLeft} seconds**`);
    await msg.edit({ embeds: [embed] });
  }

  collector.on('end', async () => {
    if (correctPlayers.size === 0) {
      await channel.send(`⏳ The Oracle received no correct answer... fate remains unmoved.`);
    } else {
      const summary = [...correctPlayers].map(id => `<@${id}>`).join(', ');
      await channel.send(`🌟 The Oracle blesses ${summary} with +1 life.`);
    }
  });

  await wait(5000);
}
// === Sudden Death : The Final Ritual VOTE ===
async function runTiebreaker(tiedPlayersInput, channel) {
  const tiedPlayers = Array.isArray(tiedPlayersInput)
    ? tiedPlayersInput
    : Array.from(tiedPlayersInput.values?.() || []);

  const voteCounts = new Map(tiedPlayers.map(p => [p.id, 0]));
  const votedUsers = new Set();

  const introEmbed = new EmbedBuilder()
    .setTitle('🩸 𝙏𝙃𝙀 𝙁𝙄𝙉𝘼𝙇 𝙍𝙄𝙏𝙐𝘼𝙇 🩸')
    .setDescription(
      `The charm cannot choose...\n\n` +
      `🗳️ *Cast your vote for who deserves to survive the final ritual.*\n` +
      `All players, fallen or not, may vote.\n\n` +
      `If fate is undecided, all shall perish.`
    )
    .setColor(0xff0033)
    .setThumbnail('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?format=webp&quality=lossless&width=128&height=128')
    .setFooter({ text: '⏳ 15 seconds to vote...' });

  const rows = [];
  let currentRow = new ActionRowBuilder();

  tiedPlayers.forEach((p, i) => {
    if (i > 0 && i % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_${p.id}`)
        .setLabel(`Vote: ${p.username || p.tag || p.id}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  if (currentRow.components.length > 0) rows.push(currentRow);

  const msg = await channel.send({ embeds: [introEmbed], components: rows });

  const collector = msg.createMessageComponentCollector({ time: 15_000 });

  collector.on('collect', async i => {
    if (votedUsers.has(i.user.id)) {
      await i.reply({ content: '🗳️ You already voted!', ephemeral: true });
      return;
    }

    votedUsers.add(i.user.id);

    const votedId = i.customId.replace('vote_', '');
    if (voteCounts.has(votedId)) {
      voteCounts.set(votedId, voteCounts.get(votedId) + 1);
    }

    await i.reply({ content: `🗳️ Your vote has been cast.`, ephemeral: true });
  });

  collector.on('end', async () => {
    const sorted = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
    const highest = sorted[0][1];
    const topVoted = sorted.filter(([_, count]) => count === highest);

    const voteTally = sorted
      .map(([id, count]) => `🗳️ <@${id}> — **${count} vote${count !== 1 ? 's' : ''}**`)
      .join('\n');

    if (topVoted.length === 1) {
      const winnerId = topVoted[0][0];
      const winner = tiedPlayers.find(p => p.id === winnerId);
      if (winner) winner.lives = 1;

      const winEmbed = new EmbedBuilder()
        .setTitle('👑 The Charm Has Spoken 👑')
        .setDescription(
          `${voteTally}\n\n<@${winner.id}> is chosen by the will of many.\nThey survive the final ritual.`
        )
        .setColor(0xffcc00)
        .setFooter({ text: '🏆 The charm accepts this verdict.' });

      await channel.send({ embeds: [winEmbed] });
    } else {
      const failEmbed = new EmbedBuilder()
        .setTitle('💀 No Clear Victor 💀')
        .setDescription(
          `${voteTally}\n\nThe vote ended in a tie.\nThe charm chooses **none**.\nAll are consumed by the void.`
        )
        .setColor(0x222222)
        .setFooter({ text: '🕳️ Balance requires sacrifice.' });

      await channel.send({ embeds: [failEmbed] });

      topVoted.forEach(([id]) => {
        const loser = tiedPlayers.find(p => p.id === id);
        if (loser) loser.lives = 0;
      });
    }
  });
}

// === Show Final Podium ===
async function showPodium(channel, players) {
  const alive = players.filter(p => p.lives > 0);
  const ranked = [...alive].sort((a, b) => b.lives - a.lives);

  // Fill podium with longest-lasting fallen players if needed
  if (ranked.length < 3) {
    const deadPlayers = players
      .filter(p => !ranked.includes(p))
      .sort((a, b) => b.lives - a.lives);
    ranked.push(...deadPlayers.slice(0, 3 - ranked.length));
  }

  const top3 = ranked.slice(0, 3);
  const maxLives = top3[0]?.lives || 0;
  const tied = top3.filter(p => p.lives === maxLives);

  const medals = ['👑🥇', '🩸🥈', '💀🥉'];
  const titles = [
    "⚔️ **Champion of the Charm** ⚔️",
    "🌑 **Scarred But Standing** 🌑",
    "🕳️ **Last One Dragged from the Void** 🕳️"
  ];

  const winnerNote = maxLives > 0
    ? (tied.length > 1
        ? `👑 A shared crown! ${tied.map(p => `<@${p.id}>`).join(', ')} reign together...`
        : `🏆 <@${top3[0].id}> emerges as the ultimate survivor...`)
    : `💀 No one survived the final ritual. The charm claims all...`;

  const baseEmbed = new EmbedBuilder()
    .setTitle('🌌👁‍🗨️ 𝙏𝙃𝙀 𝙁𝙄𝙉𝘼𝙇 𝙋𝙊𝘿𝙄𝙐𝙈 👁‍🗨️🌌')
    .setDescription(
      `The arena falls silent...\nOnly the echoes of chaos remain.\n\n` +
      `🏆 *Here stand the final 3 who braved the Gauntlet:*\n\n${winnerNote}`
    )
    .setColor(maxLives > 0 ? 0x8e44ad : 0x444444)
    .setThumbnail('https://media.discordapp.net/attachments/1086418283131048156/1378206999421915187/The_Gauntlet.png?format=webp&quality=lossless&width=128&height=128')
    .setFooter({ text: '💀 The charm remembers all...' });

  const msg = await channel.send({ embeds: [baseEmbed] });

  for (let i = 0; i < top3.length; i++) {
    const field = {
      name: `${medals[i]} <@${top3[i].id}>`,
      value: `${titles[i]}\nLives Remaining: **${top3[i].lives}**`,
      inline: false
    };
    baseEmbed.addFields(field);
    await wait(1500); // 1.5 second delay between podium steps
    await msg.edit({ embeds: [baseEmbed] });
  }

  await wait(5000); // Leave it visible a bit longer
}

// === Show Rematch Button & Wait for Votes ===
async function showRematchButton(channel, finalPlayers) {
  const requiredVotes = Math.ceil(finalPlayers.length * 0.75);
  const votes = new Set();
  let rematchTriggered = false;

  const voteButton = new ButtonBuilder()
    .setCustomId('rematch_vote')
    .setLabel(`🔁 Run It Back (0/${requiredVotes})`)
    .setStyle(ButtonStyle.Success);

  const rematchRow = new ActionRowBuilder().addComponents(voteButton);

  const msg = await channel.send({
    content:
      `🏁 The Gauntlet has ended...\n` +
      `Do the spirits of battle hunger for more?\n\n` +
      `🔁 *Click to vote for a rematch.*\n` +
      `At least **75%** of the final players (**${requiredVotes}/${finalPlayers.length}**) must agree.`,
    components: [rematchRow],
    embeds: [
      new EmbedBuilder()
        .setImage('https://media.tenor.com/IAtglE9aZg4AAAAC/stewie-repetition.gif')
        .setColor(0x00ffcc)
    ]
  });

  const collector = msg.createMessageComponentCollector({ time: 60_000 });

  collector.on('collect', async i => {
    const isFinalPlayer = finalPlayers.some(p => p.id === i.user.id);
    if (!isFinalPlayer) {
      return i.reply({ content: `⛔ Only final players from the last Gauntlet may vote.`, ephemeral: true });
    }

    if (votes.has(i.user.id)) {
      return i.reply({ content: `✅ You've already cast your rematch vote.`, ephemeral: true });
    }

    votes.add(i.user.id);
    await i.reply({ content: `🗳️ Vote counted! You seek the charm again...`, ephemeral: true });

    const updatedButton = ButtonBuilder.from(voteButton)
      .setLabel(`🔁 Run It Back (${votes.size}/${requiredVotes})`);

    const updatedRow = new ActionRowBuilder().addComponents(updatedButton);
    await msg.edit({ components: [updatedRow] });

    // If enough votes are reached early
    if (votes.size >= requiredVotes && !rematchTriggered && rematchCount < maxRematches) {
      rematchTriggered = true;
      collector.stop(); // end early
      await channel.send(`🔥 **${votes.size}** have spoken. The charm awakens once more!`);

      const playerMap = new Map();
      finalPlayers.forEach(p => {
        playerMap.set(p.id, { id: p.id, username: p.username, lives: 1 });
      });

      activeGame = { players: playerMap, rematch: true };
      await runBossVotePhase(playerMap, channel);
    }
  });

  collector.on('end', async () => {
    if (!rematchTriggered) {
      rematchCount = 0;
      await channel.send(`😴 Not enough willpower remained. The charm sleeps… until next time.`);
      await wait(500);
      await channel.send({ stickers: ['1363459518238818424'] });
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
