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
    ? `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`
    : `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
}

// --- Lore Arrays ---
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
const gameStartTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

// Reminder at 1/3 time
setTimeout(() => {
  channel.send(`@everyone ⏳ One third of join time has passed! [Join Here](${joinMessage.url})  
Starts <t:${gameStartTimestamp}:R>`);
}, (durationMinutes * 60 * 1000) / 3);

// Reminder at 2/3 time
setTimeout(() => {
  channel.send(`@everyone ⚠️ Two thirds of join time has passed! [Join Here](${joinMessage.url})  
Starts <t:${gameStartTimestamp}:R>`);
}, (durationMinutes * 60 * 1000) * (2 / 3));
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
    await wait(12000); // 12-second pause between rounds

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

  const totalPlayers = players.length;
  const survivors = players.filter(p => !p.eliminated && p.lives > 0).length;
  const statusLine = `🎯 Players Remaining: ${survivors} / ${totalPlayers}`;

  const embed = new EmbedBuilder()
    .setTitle("🩸 Elimination Round")
    .setDescription(`${statusLine}\n\n${lines.join("\n")}`)
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
