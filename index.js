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
        duel_wins INT DEFAULT 0,
        games_played INT DEFAULT 0
      );
    `);
    console.log('📊 Database initialized.');
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

// Discord client setup
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
let eliminatedPlayers = [];
// Utility Functions
const wait = ms => new Promise(res => setTimeout(res, ms));

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomNftImage() {
  const isMonster = Math.random() < 0.5;
  const tokenId = Math.floor(Math.random() * (isMonster ? 300 : 531)) + 1;
  const base = isMonster
    ? 'https://opensea.io/assets/ethereum/0xc38e2ae060440c9269cceb8c0ea8019a66ce8927/'
    : 'https://opensea.io/assets/ethereum/0x9492505633d74451bdf3079c09ccc979588bc309/';
  return `${base}${tokenId}`;
}
const eliminationReasons = [
"👟 tripped over a cursed shoelace and was never seen again.",
"👁️‍🗨️ challenged the charm to a staring contest. Lost. Badly.",
"🕺 mistook the ritual circle for a dance floor. The charm was not amused.",
"🪞 stepped into a mirror and got stuck arguing with their prettier self.",
"🔮 asked the Oracle too many questions. Was swallowed by punctuation.",
"📧 accidentally hit 'Reply All' to the voices in their head.",
"🪨 licked a glowing rock labeled 'Do Not Lick.'",
"💪 tried to flex mid-round and tore reality (and themselves).",
"🔴 pressed the charm’s big red button. Instantly gone.",
"📊 was voted 'Most Likely to Die Next' — statistically accurate.",
"🎲 rolled a nat 1 while attempting to survive.",
"🕳️ opened the charmhole and fell in yelling 'YOLO!'",
"📖 got cursed by the lore mid-sentence. Didn’t finish it.",
"🪜 reached for glory, grabbed a trapdoor instead.",
"🧙 told the charm they 'don’t believe in magic.' The charm believed in them.",
"😈 accidentally summoned their sleep paralysis demon. It was punctual.",
"📦 chose the mystery box. It contained instant regret.",
"💨 snorted powdered $CHARM. Not how it works.",
"🗣️ declared themselves immune. The charm took it personally.",
"🍗 tried to eat the ritual offering. It bit back.",
"🌑 lost a staring contest with their own shadow.",
"👑 put on the Crown of Revivals. It fit. Too well.",
"🧠 forgot to update their resurrection firmware.",
"🥄 got distracted by their reflection in a spoon. It lunged first.",
"🐉 tried to solo the lore boss. The lore boss soloed back.",
"🫀 tried to trade hearts with a Monster. Got the short end of the artery.",
"📺 answered a call from an unplugged television. Now they’re static.",
"🪤 walked into the charm’s trap labeled 'Free Win.'",
"🧼 attempted to cleanse the ugliness. Got washed away.",
"🌪️ got swept up in a lore storm and mispronounced the incantation.",
"🧃 drank from the wrong ritual cup. It was juice… of the damned.",
"🪚 cut a deal with fate. Forgot to read the fine print.",
"🧌 mocked a malformed idol. It blinked. They didn’t.",
"💣 rage quit the round. The round retaliated.",
"📉 invested in hope. Market crashed.",
"🍄 ate the cursed mushroom. It bit back. Twice.",
"🔦 tried to shine light on the lore. The lore eats light.",
"🛏️ fell asleep mid-Gauntlet. The dream took over.",
"🧩 solved the puzzle… incorrectly.",
"📿 wore a fake charm. Got exposed mid-round. Eliminated by shame.",
"🚪 opened a mysterious door. Walked into their own ending.",
"🪫 ran out of narrative energy. Battery dead. Arc collapsed.",
"🌘 stared too long at the second moon. It noticed.",
"📌 was pinned to the wall by fate. No refunds.",
"🔑 unlocked forbidden knowledge. It slammed shut behind them.",
"🥵 overheated from flexing too hard. Instant evaporation.",
"🕳️ found a shortcut. It led directly to elimination.",
"🔁 looped their revival too many times. The charm hit undo.",
"🪞 tried to kiss their doppelgänger. One had to go.",
"🪺 poked the egg of prophecy. It hatched — poorly — and claimed them."
];

const reviveSuccessMessages = [
"✨ The charm sputters, screams… then works. You’re back, somehow stronger.",
"🩸 You claw your way through the charmhole. You emerge — uglier and alive.",
"🫀 Your heartbeat syncs with the chant. You live again. For now.",
"🦴 You reassemble. It’s not perfect. It’s not supposed to be.",
"🔮 The charm rolls the dice… and favors your ugly fate. Welcome back.",
"🌑 A shadow peels off the wall and becomes… you. Alive. Barely.",
"🪓 You cut through the veil with pure willpower. The charm bows slightly.",
"🌫️ The fog spits you out. It missed you, apparently.",
"🧟 You stumble back into the realm. Death shrugs and lets you go… this time.",
"🎭 You wear your old face like a mask. It fits just enough to survive.",
"🔥 The charm ignites. You burn back into being.",
"🎯 You hit the one-in-a-million shot. The charm coughs and resurrects you.",
"📢 The void announces your return. You flex in response.",
"👣 You step back into the world… leaving a muddy footprint on death’s chest.",
"🧩 You were missing a piece. The charm found it. You’re whole-ish now.",
"🕳️ You crawl out of nonexistence covered in lore juice. It works.",
"🪙 You flipped your fate — and landed on ‘Back in it, baby.’",
"🕯️ A candle lights itself for you. One life. One more chance.",
"⚡ You’re zapped alive with leftover electricity from a failed ritual.",
"🪄 Someone else’s wish went wrong… and accidentally revived you. Oops.",
"🧠 You out-think death. Barely. It still calls you occasionally.",
"🎮 You press the right combo. The charm gives you one extra life.",
"🪆 You unfold from within yourself. You’re back… but not alone.",
"🩻 Your bones knit themselves while chanting. You stand. Ugly. Alive.",
"🧵 You are stitched back together by unseen hands. The thread hums.",
"🌪️ You return like a glitch in the wind. No one saw it coming.",
"🥩 Your soul slaps back into your meat. It jiggles approvingly.",
"📼 You rewind your fate like an old tape. It clicks. You breathe.",
"🧃 The charm drinks your regret. You ooze back into being.",
"🪰 You come back… followed by a suspicious swarm of flies. Still counts.",
"🔋 You charge back up. Slightly unstable. Wildly determined.",
"📡 You receive a signal from beyond. It contains resurrection instructions. You follow them. They work.",
"🧊 You thaw out mid-sentence. The sentence was: 'I’M NOT DONE.'",
"🪦 Dirt spits you out like a bad joke. The world groans at your return.",
"🧲 You attract your soul like a rusty magnet. It clicks into place with a shudder.",
"🪄 The charm hiccups. You’re standing again. Don’t question it.",
"🫁 You gasp awake. It echoes louder than it should.",
"🕳️ You step out of a hole in logic. Nobody dares ask how.",
"📜 A forgotten rule in the lore grants you this one revival. Use it well.",
"🌈 A very cursed rainbow touches you. You sparkle briefly. You’re back."
];

const reviveFailureMessages = [
"🪦 The charm fizzles. You re-die in a slightly more embarrassing pose.",
"🫠 Your soul gets stuck halfway out. Even the void winces.",
"🐸 You croak your plea. The charm responds: ‘lol no.’",
"🪚 You almost make it… but trip on your own legacy.",
"🦷 The charm cracks a tooth biting into your fate. It spits you out.",
"🪞 You see your reflection. It shrugs. You fade.",
"🫥 Revival denied. You are deemed ‘too moist.’",
"📦 Your resurrection request is lost in the mail. Postmarked: Never.",
"🧃 You liquefy. The others pretend not to notice.",
"🪰 The ritual flies away with your chances. Literally.",
"🎯 You hit the wrong button. You come back… as dust.",
"🔌 You almost connect… but someone pulls the plug on you again.",
"🪓 You are chopped from the comeback list by an intern at the Charmhole.",
"🥄 You spoon-fed the charm your hopes. It spit them out with a slurp.",
"🧠 Your brain reboots mid-revival. You forget how to reincarnate.",
"📴 You call out. No one answers. Revival is currently offline.",
"🪵 You are too ugly for the afterlife, yet too dead for the Ugly. Unlucky.",
"🐈‍⬛ You get revived… but immediately stub your toe and die again.",
"🍽️ The charm prepares to serve you… as a side dish.",
"🪜 You climb back to life… but the ladder is greased with irony.",
"🥔 Your comeback attempt is boiled alive in disappointment.",
"🪤 You trigger a charm trap. All you revive as is regret.",
"🎷 The afterlife plays you a jazz solo. You fail to revive, but it's a bop.",
"🧻 You were summoned with the wrong incantation — now you’re just a cursed tissue.",
"🚫 The charm denies your form. Try again in the next life. Or don’t.",
"🩹 You almost patched reality… but slipped on your own narrative arc.",
"🐌 You return as a slow idea and get outpaced by death itself.",
"📡 You receive static instead of a second chance.",
"🧂 You are seasoned but unrevived. The ritual was hungry, not generous.",
"📘 Your story had a comeback planned. The author rage quit.",
"🎢 You ride the rollercoaster of resurrection. It derails spectacularly.",
"👁️ The charm sees into your soul… and quietly deletes it.",
"🧃 You got poured into the wrong vessel. It had a leak.",
"🔕 The charm is currently in do-not-disturb mode.",
"🧊 You froze mid-revival. Someone is using your soul as an ice cube.",
"🧺 You are placed in the spiritual lost-and-found. No one claims you.",
"🔧 The resurrection mechanism jams. You're stuck in a loading screen.",
"📆 You picked a bad day to come back. Revival is scheduled for next Tuesday.",
"🕸️ You revive briefly… but a spider claims your corpse as property.",
"🪗 You play the accordion of fate. The charm hates accordions."

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
  },
  {
  riddle: "I wear many faces but none are mine. You created me in haste, and now I speak in your voice. What am I?",
  answer: "Mask"
},
{
  riddle: "You abandon me when you're full, crave me when you're empty. I live in your belly and whisper at night. What am I?",
  answer: "Hunger"
},
{
  riddle: "I wait in every mirror but never blink. I age with you, but only in reverse. What am I?",
  answer: "Reflection"
},
{
  riddle: "My truth is ugly, my silence louder. I live between your questions and never leave whole. What am I?",
  answer: "Answer"
},
{
  riddle: "I die in light, thrive in shame. I wrap around your thoughts and feed on regret. What am I?",
  answer: "Guilt"
},
{
  riddle: "You drag me forward but never look back. I follow you always but never lead. What am I?",
  answer: "Past"
},
{
  riddle: "Once given, I cannot be returned. Once taken, I can’t be ignored. I hurt more when ignored. What am I?",
  answer: "Blame"
},
{
  riddle: "I was born when beauty died. I grow where rot thrives. I crown the malformed. What am I?",
  answer: "Charm"
},
{
  riddle: "No shape, no form, but you feel me claw. I haunt your calm and feast on hope. What am I?",
  answer: "Doubt"
},
  {
  riddle: "You craft me with lies, dress me in smiles, parade me in crowds. But alone, I rot. What am I?",
  answer: "Ego"
},
{
  riddle: "I scream in silence, walk without feet, and sink deepest in sleep. What am I?",
  answer: "Nightmare"
},
{
  riddle: "You hide me behind words, but I always bleed through. I stain your history. What am I?",
  answer: "Truth"
},
{
  riddle: "Broken once, I turn to ash. Touched gently, I shine. Held too tightly, I shatter. What am I?",
  answer: "Trust"
},
{
  riddle: "I am born the moment you’re seen. I die in solitude. I can lift or crush. What am I?",
  answer: "Judgment"
},
{
  riddle: "Fed by fear, I crawl beneath your skin. I am ugly, but I am yours. What am I?",
  answer: "Insecurity"
},
{
  riddle: "My voice is sweet, my cost is high. I promise everything, then take it all. What am I?",
  answer: "Temptation"
},
{
  riddle: "I carry your name but not your voice. I live forever but change with every story. What am I?",
  answer: "Memory"
},
{
  riddle: "I slither through wires, wear masks of light, and echo your worst ideas. What am I?",
  answer: "Internet"
},
{
  riddle: "I am ugly made eternal. I glow when burned. I hunger for holders. What am I?",
  answer: "NFT"
},
  
];const uglychants = [
  "🔊 The malformed chant: Drip your soul. Trade your face.",
  "🔊 The malformed chant: One charm, two lies, three souls.",
  "🔊 The malformed chant: Laugh now. The ritual hears you.",
  "🔊 The malformed chant: Smile crooked. It’s watching.",
  "🔊 The malformed chant: Crawl forward. The path remembers.",
  "🔊 The malformed chant: Don’t blink. The eyes are tired.",
  "🔊 The malformed chant: All hail the Ugly within.",
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
  "💀 A countdown begins. No one started it. No one knows what it’s for.",
  "🧠 The ceiling whispers your birth name backwards. No one else seems to hear it.",
  "🪞 Every surface reflects something slightly wrong… and it’s getting closer.",
  "🫧 Your skin forgets how to be skin. It tries on fur. Then stone. Then teeth.",
  "🎈 A balloon floats by, pulsing like a heart. It’s labeled ‘YOU WERE WANTED.’",
  "📞 A phone rings. You don’t have one. You answer. It’s your future sobbing.",
  "🫀 You feel a second heartbeat. It’s not yours. It’s louder.",
  "🎵 The music stops. It never started.",
  "📦 A box appears. It's nailed shut and hissing softly. It knows your birthday.",
  "🫣 Someone just blinked in Morse code. You blink back. It responds.",
  "🪶 A feather falls upward. Then it screams.",
  "🦴 Something knocks from the inside of your bones.",
  "📘 A book writes itself in real time. Every page begins with your last mistake.",
  "🚪 A door opens to a hallway made of your regrets. You’ve been here before.",
  "🩻 Your shadow flickers. It raises a finger to its lips.",
  "🫥 You forget your name. The floor whispers a new one.",
  "🕳️ There’s a hole in the sky. It looks… hungry.",
  "🎭 You feel watched. You’ve always been watched. The watchers are clapping.",
  "📍You step where no one else has stepped. Your foot sinks into a memory.",
  "🪰 A swarm of flies spells out a question. You understand it. You wish you didn’t.",
  "🎮 You see a HUD appear. Health: ??? / Sanity: ! / Objective: 'Stay Ugly'"
];
// === GLOBAL GAME STATE ===
let players = [];
let gameInProgress = false;
let mutationCount = 0;
let maxMutations = 0;
let massRevivalUsed = false;
let joinMessage = null;
let joinTimeout = null;

// === PLAYER HELPERS ===
function resetPlayerState() {
  players = [];
  mutationCount = 0;
  maxMutations = Math.floor(Math.random() * 3) + 2; // 2–4
  massRevivalUsed = false;
}

function eliminatePlayerById(userId) {
  const player = players.find(p => p.id === userId);
  if (player) {
    player.eliminated = true;
    player.lives = 0;
  }
}

function eliminatePlayer(player, reason = "eliminated.") {
  player.eliminated = true;
  player.lives = 0;
  player.deathReason = reason;
}

function getAlivePlayers() {
  return players.filter(p => !p.eliminated && p.lives > 0);
}

function getRandomAlivePlayers(count = 1) {
  return shuffleArray(getAlivePlayers()).slice(0, count);
}

function getRandomNftImage() {
  const tokenId = Math.floor(Math.random() * 530) + 1;
  return `https://opensea.io/assets/ethereum/0x9492505633D74451bDF3079c09ccc979588Bc309/${tokenId}`;
}

function getRandomMonsterImage() {
  const tokenId = Math.floor(Math.random() * 300) + 1;
  return `https://opensea.io/assets/ethereum/0xC38E2Ae060440c9269CcEB8C0EA8019a66Ce8927/${tokenId}`;
}

// --- MUTATION EVENTS ---
const mutationEvents = [
  {
    name: "Bone Crown",
    description: "The Bone Crown materializes. Who dares wear it?",
    effect: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bone_crown').setLabel('👑 Wear the Crown').setStyle(ButtonStyle.Danger)
      );

      const msg = await channel.send({ content: "Only one may wear it...", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "You already tried your fate.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const cursed = Math.random() < 0.5;
          if (cursed) {
            eliminatePlayer(player, "crowned and consumed.");
            await i.reply({ content: "👑 You wore the crown... and it wore you.", ephemeral: true });
          } else {
            player.lives++;
            await i.reply({ content: "👑 You gain a cursed blessing. +1 life!", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  },
  {
    name: "Rot Feather",
    description: "A crow drops a rotting feather. Will you touch it?",
    effect: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rot_feather').setLabel('🪶 Touch the Feather').setStyle(ButtonStyle.Secondary)
      );

      const msg = await channel.send({ content: "Its stench fills the air...", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "You've already touched it.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const hexed = Math.random() < 0.5;
          if (hexed) {
            eliminatePlayer(player, "touched the rotting feather.");
            await i.reply({ content: "🪶 The feather bursts into mold. You're consumed.", ephemeral: true });
          } else {
            player.lives++;
            await i.reply({ content: "🪶 The rot spares you. +1 life.", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  },
  {
    name: "Bleeding Clock",
    description: "A clock bleeds seconds. Touch it?",
    effect: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bleeding_clock').setLabel('🕰️ Touch the Clock').setStyle(ButtonStyle.Primary)
      );

      const msg = await channel.send({ content: "Time is melting...", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "Time does not rewind twice.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const danger = Math.random() < 0.5;
          if (danger) {
            eliminatePlayer(player, "bled out their time.");
            await i.reply({ content: "🕰️ Time devours you.", ephemeral: true });
          } else {
            player.lives++;
            await i.reply({ content: "🕰️ You gain a second chance. +1 life!", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  }
];
// --- MINI-GAME EVENTS ---
const mutationMiniGames = [
  {
    name: "Snail’s Pact",
    description: "A golden snail offers a contract. Accept it?",
    interaction: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('snail_pact').setLabel('🐌 Accept Pact').setStyle(ButtonStyle.Success)
      );

      const msg = await channel.send({ content: "Do you trust the mollusk?", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "You've already accepted the deal.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const reward = Math.random() < 0.5;
          if (reward) {
            player.lives++;
            await i.reply({ content: "🐌 Pact granted. You gain +1 life.", ephemeral: true });
          } else {
            eliminatePlayer(player, "was too slow... the snail caught them.");
            await i.reply({ content: "🐌 The snail devours your essence.", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  },
  {
    name: "Lever of Regret",
    description: "Pull the lever? It promises... something.",
    interaction: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lever_regret').setLabel('🎚️ Pull the Lever').setStyle(ButtonStyle.Primary)
      );

      const msg = await channel.send({ content: "It hums with forgotten choices...", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "One pull is enough.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const lucky = Math.random() < 0.5;
          if (lucky) {
            player.lives++;
            await i.reply({ content: "🎚️ Luck! +1 life.", ephemeral: true });
          } else {
            eliminatePlayer(player, "was rejected by the lever.");
            await i.reply({ content: "🎚️ The lever creaks and deletes your existence.", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  },
  {
    name: "The Smile Box",
    description: "A box promises a smile. Open it?",
    interaction: async (channel, players) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('smile_box').setLabel('📦 Open the Box').setStyle(ButtonStyle.Secondary)
      );

      const msg = await channel.send({ content: "It giggles softly...", components: [row] });
      const clicked = new Set();

      const collector = msg.createMessageComponentCollector({ time: 8000 });
      collector.on('collect', async i => {
        if (clicked.has(i.user.id)) return i.reply({ content: "The box has already spoken to you.", ephemeral: true });
        clicked.add(i.user.id);
        const player = players.find(p => p.id === i.user.id);
        if (player) {
          const joy = Math.random() < 0.5;
          if (joy) {
            player.lives++;
            await i.reply({ content: "📦 You smiled. +1 life.", ephemeral: true });
          } else {
            eliminatePlayer(player, "opened the wrong box.");
            await i.reply({ content: "📦 You smiled... for the last time.", ephemeral: true });
          }
        }
      });

      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
  }
];


// === JOIN PHASE ===
async function startJoinPhase(channel, duration = 180) {
  if (gameInProgress) return channel.send("⚠️ A Gauntlet is already running!");

  gameInProgress = true;
  resetPlayerState();

  const embed = new EmbedBuilder()
    .setTitle("🩸 The Gauntlet Begins")
    .setDescription(`Click the button to enter. Game starts in ${duration} seconds.`)
    .setColor("Red");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("join_gauntlet").setLabel("Join the Gauntlet").setStyle(ButtonStyle.Danger)
  );

  joinMessage = await channel.send({ embeds: [embed], components: [row] });

  const interval = Math.floor(duration / 3);
  for (let i = 1; i <= 2; i++) {
    setTimeout(() => {
      channel.send(`⚠️ The Gauntlet begins in ${duration - i * interval} seconds!\nJoin here: ${joinMessage.url}`);
    }, i * interval * 1000);
  }

  joinTimeout = setTimeout(async () => {
    if (players.length < 2) {
      gameInProgress = false;
      await channel.send("Not enough players. The Gauntlet fades...");
      return;
    }
    await runBossVotePhase(channel);
  }, duration * 1000);
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId === "join_gauntlet") {
    const existing = players.find(p => p.id === interaction.user.id);
    if (existing) {
      await interaction.reply({ content: "You are already in the Gauntlet.", ephemeral: true });
    } else {
      players.push({ id: interaction.user.id, username: interaction.user.username, lives: 1, eliminated: false });
      await interaction.reply({ content: "You have entered the Gauntlet.", ephemeral: true });
    }
  }
});
async function runBossVotePhase(channel) {
  const candidates = shuffleArray(players).slice(0, 5);
  const row = new ActionRowBuilder();
  candidates.forEach(player => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_boss_${player.id}`)
        .setLabel(player.username)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle("👑 Boss Vote Begins")
    .setDescription("Choose your champion. The winner gains 2 lives and becomes the Boss-level Ugly.")
    .setColor("Gold");

  await channel.send({ embeds: [embed], components: [row] });

  const collector = channel.createMessageComponentCollector({ time: 10000 });
  const votes = {};

  collector.on("collect", interaction => {
    const voterId = interaction.user.id;
    const targetId = interaction.customId.split("_")[2];
    votes[voterId] = targetId;
    interaction.reply({ content: "🗳️ Vote registered!", ephemeral: true });
  });

  collector.on("end", async () => {
    const voteCounts = {};
    Object.values(votes).forEach(id => {
      voteCounts[id] = (voteCounts[id] || 0) + 1;
    });

    let winnerId = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || candidates[0].id;
    const boss = players.find(p => p.id === winnerId);
    if (boss) boss.lives = 2;

    await channel.send(`👑 <@${boss.id}> has been chosen as Boss Level Ugly and begins with 2 lives!`);
    await startGauntlet(players, channel);
  });
}

async function startGauntlet(playerList, channel, isTrial = false) {
  gamePlayers = playerList.map(p => ({
    ...p,
    lives: p.lives || 1,
    eliminated: false,
    joined: true
  }));

  if (isTrial) {
    for (let i = 1; i <= 20; i++) {
      gamePlayers.push({
        id: `Trial${i}`,
        username: `Trial${i}`,
        lives: 1,
        eliminated: false,
        joined: true
      });
    }
  }

  await runGauntlet(channel);
}
async function runGauntlet(channel) {
  let mutationCount = 0;
  const maxMutations = Math.floor(Math.random() * 3) + 2; // 2–4
  let massRevivalUsed = false;

  while (players.filter(p => !p.eliminated && p.lives > 0).length > 1) {
    await wait(12000);

    // 🎲 Random Lore Flavor (20% chance each)
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
      await channel.send(`🔮 **The Ugly Oracle speaks:**\n_${oracle.riddle}_\n(Answer in chat within 30 seconds to survive)`);

      const filter = m => !m.author.bot && oracle.answer.toLowerCase() === m.content.trim().toLowerCase();
      try {
        const response = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] });
        const winner = players.find(p => p.id === response.first().author.id);
        if (winner) {
          winner.lives++;
          await channel.send(`✨ <@${winner.id}> answered correctly and gains +1 life!`);
        }
      } catch {
        await channel.send(`❌ No one answered the riddle. The Oracle fades into static...`);
      }
    }

    // 🎯 Event Roll
    const roll = Math.random();
    console.log(`🌀 Event roll: ${roll.toFixed(2)} | Mutations: ${mutationCount}/${maxMutations} | RevivalUsed: ${massRevivalUsed}`);

    if (roll < 0.4) {
      await runEliminationRound(channel);
    } else if (roll < 0.6 && mutationCount < maxMutations) {
      await runMutationEvent(channel, players);
      mutationCount++;
    } else if (roll < 0.8) {
      await runMiniGameEvent(channel, players);
    } else if (!massRevivalUsed) {
      await runMassRevivalEvent(channel);
      massRevivalUsed = true;
    }
  }

  await showFinalPodium(channel);
}
// --- ELIMINATION ROUND ---
async function runEliminationRound(channel) {
  const remaining = players.filter(p => !p.eliminated && p.lives > 0);
  if (remaining.length <= 1) return;

  const eliminations = Math.min(3, remaining.length);
  const victims = shuffleArray(remaining).slice(0, eliminations);
  const embed = new EmbedBuilder()
    .setTitle(`☠️ Elimination Round`)
    .setDescription(`**Players Remaining:** ${remaining.length - victims.length} / ${players.length}`)
    .setColor("Red");

  for (const victim of victims) {
    const reason = shuffleArray(eliminationReasons)[0];
    eliminatePlayerById(victim.id);
    embed.addFields({ name: '\u200B', value: `**<@${victim.id}>** ${reason}` });
  }

  await channel.send({ embeds: [embed] });
}

// --- MUTATION EVENT ---
async function runMutationEvent(channel, players) {
  const mutation = shuffleArray(mutationEvents)[0];
  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation: ${mutation.name}`)
    .setDescription(mutation.description)
    .setColor("Purple")
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
  await wait(4000);

  const clicked = new Set();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mutation_click').setLabel('Touch It').setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ content: `Click the button if you dare...`, components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on('collect', async interaction => {
    if (clicked.has(interaction.user.id)) return interaction.reply({ content: 'You already touched it!', ephemeral: true });
    clicked.add(interaction.user.id);
    interaction.reply({ content: '🧬 You touched it...', ephemeral: true });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });
    try {
      await mutation.effect(channel, players, [...clicked]);
    } catch (err) {
      console.error(`❌ Error running mutation effect (${mutation.name}):`, err);
      await channel.send(`⚠️ Mutation event **${mutation.name}** glitched.`);
    }
  });
}

// --- MINI-GAME EVENT ---
async function runMiniGameEvent(channel, players) {
  const game = shuffleArray(mutationMiniGames)[0];
  const embed = new EmbedBuilder()
    .setTitle(`🎮 Mini-Game: ${game.name}`)
    .setDescription(game.description)
    .setColor("Orange")
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
  await wait(4000);

  const clicked = new Set();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mini_click').setLabel('Participate').setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ content: `Click to participate!`, components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on('collect', async interaction => {
    if (clicked.has(interaction.user.id)) return interaction.reply({ content: 'Already clicked!', ephemeral: true });
    clicked.add(interaction.user.id);
    interaction.reply({ content: '🎮 You’re in the game!', ephemeral: true });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });
    try {
      await game.interaction(channel, players, [...clicked]);
    } catch (err) {
      console.error(`❌ Error running mini-game (${game.name}):`, err);
      await channel.send(`⚠️ Mini-game **${game.name}** broke reality a little.`);
    }
  });
}
// --- MASS REVIVAL EVENT ---
async function runMassRevivalEvent(channel) {
  const eliminated = players.filter(p => p.eliminated);
  const outsiders = [];

  const embed = new EmbedBuilder()
    .setTitle('🩸 Totem of Lost Souls')
    .setDescription(`A malformed relic shimmers in the void.\nEliminated players and outsiders may click to plead for rebirth.`)
    .setColor('DarkRed');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('totem_click').setLabel('Touch the Totem').setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 5000 });
  const revivalAttempts = [];

  collector.on('collect', async interaction => {
    if (revivalAttempts.includes(interaction.user.id)) {
      return interaction.reply({ content: 'You already touched the Totem.', ephemeral: true });
    }

    revivalAttempts.push(interaction.user.id);
    interaction.reply({ content: '🩸 The Totem pulses… your fate awaits.', ephemeral: true });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });

    const revived = [];
    const denied = [];

    for (const userId of revivalAttempts) {
      const isEliminated = players.find(p => p.id === userId && p.eliminated);
      const isOutsider = !players.find(p => p.id === userId);

      const successRate = isEliminated ? 0.6 : 0.4;
      if (Math.random() < successRate) {
        if (isEliminated) {
          const p = players.find(p => p.id === userId);
          p.eliminated = false;
          p.lives = 1;
          revived.push(`<@${userId}> (eliminated)`);
        } else {
          players.push({ id: userId, username: 'Outsider', eliminated: false, lives: 1, isTrial: false });
          revived.push(`<@${userId}> (new entry)`);
        }
      } else {
        denied.push(`<@${userId}>`);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle('💀 Totem Judgment')
      .setDescription(`The Totem has judged all who dared touch it.`)
      .addFields(
        { name: 'Revived', value: revived.length ? revived.join('\n') : 'None', inline: true },
        { name: 'Denied', value: denied.length ? denied.join('\n') : 'None', inline: true }
      )
      .setColor('DarkRed');

    await channel.send({ embeds: [resultEmbed] });
  });
}

// --- FINAL PODIUM ---
async function showFinalPodium(channel) {
  const survivors = players.filter(p => !p.eliminated && p.lives > 0);
  const sorted = survivors.length
    ? survivors.sort((a, b) => b.lives - a.lives)
    : players.filter(p => p.lives <= 0).sort((a, b) => b.timestamp - a.timestamp);

  const top3 = sorted.slice(0, 3);
  const embed = new EmbedBuilder()
    .setTitle('🏆 Final Podium')
    .setColor('Gold');

  if (top3.length) {
    if (top3[0]) embed.addFields({ name: '🥇 1st Place', value: `<@${top3[0].id}>` });
    if (top3[1]) embed.addFields({ name: '🥈 2nd Place', value: `<@${top3[1].id}>` });
    if (top3[2]) embed.addFields({ name: '🥉 3rd Place', value: `<@${top3[2].id}>` });
  } else {
    embed.setDescription('No survivors remain… the void claims victory.');
  }

  await channel.send({ embeds: [embed] });

  // Optional: Add lore chant
  const chant = shuffleArray(uglychants)[0];
  await channel.send(`🩸 The malformed chant: ${chant}`);

  await showRematchButton(channel);
}

// --- REMATCH BUTTON ---
async function showRematchButton(channel) {
  const lastPlayers = players.map(p => p.id);
  const requiredVotes = Math.ceil(lastPlayers.length * 0.75);
  let votes = 0;
  const voted = new Set();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch')
      .setLabel('🔁 Join the Rematch')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ content: `The Gauntlet has ended. Want to run it back?\nWe need ${requiredVotes} votes from last players to begin.`, components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async interaction => {
    if (!lastPlayers.includes(interaction.user.id)) return interaction.reply({ content: 'You were not in the last Gauntlet.', ephemeral: true });
    if (voted.has(interaction.user.id)) return interaction.reply({ content: 'You already voted to rematch.', ephemeral: true });

    voted.add(interaction.user.id);
    votes++;

    interaction.reply({ content: '✅ Your vote to rematch has been counted.', ephemeral: true });

    if (votes >= requiredVotes) {
      await msg.edit({ content: '🔁 Rematch confirmed! The Gauntlet will restart shortly.', components: [] });
      startJoinPhase(channel, 180); // start a new 3-minute join
    }
  });

  collector.on('end', async () => {
    if (votes < requiredVotes) {
      await msg.edit({ content: '❌ Not enough votes. The Gauntlet rests… for now.', components: [] });
    }
  });
}
// --- COMMAND HANDLERS ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Manual trial command
  if (content.startsWith('!gauntlettrial')) {
    if (isGameRunning) return message.channel.send('⚠️ A Gauntlet is already running!');
    isGameRunning = true;

    const trialPlayers = generateTrialPlayers(20);
    await message.channel.send('⚔️ **Trial Mode Activated!** Mock players enter the chaos...');
    await wait(2000);
    await startGauntlet(trialPlayers, message.channel, true);
    isGameRunning = false;
  }

  // Dev mode — your own test runs
  if (content.startsWith('!gauntletdev')) {
    if (isGameRunning) return message.channel.send('⚠️ A Gauntlet is already running!');
    isGameRunning = true;

    const devPlayer = {
      id: message.author.id,
      username: message.author.username,
      eliminated: false,
      lives: 1,
      isTrial: false
    };

    await message.channel.send(`🧪 **Developer Gauntlet** starting for <@${message.author.id}>...`);
    await wait(1000);
    await startGauntlet([devPlayer], message.channel);
    isGameRunning = false;
  }

  // Leaderboard
  if (content.startsWith('!leaderboard') || content.startsWith('!lb')) {
    await showLeaderboard(message.channel);
  }

  // User stats
  if (content.startsWith('!stats')) {
    const target = message.mentions.users.first() || message.author;
    await showPlayerStats(message.channel, target.id);
  }

  // Start normal Gauntlet (!gauntlet or !gauntlet[MINUTES])
  if (content.startsWith('!gauntlet')) {
    if (isGameRunning) return message.channel.send('⚠️ A Gauntlet is already running!');
    isGameRunning = true;

    const match = content.match(/!gauntlet(\d+)/);
    const duration = match ? parseInt(match[1]) : 180;

    await startJoinPhase(message.channel, duration);
  }
});

// --- READY EVENT ---
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    await db.connect();
    console.log('📊 Database initialized.');
  } catch (error) {
    console.error('❌ DB connection failed:', error);
  }
});

// --- LOGIN ---
client.login(process.env.BOT_TOKEN);
