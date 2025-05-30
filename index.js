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
    console.log('📊 Tables are ready!');
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

let currentGame = null;
let gameActive = false;
let gamePlayers = [];
let eliminatedPlayers = [];
let revivalAttempted = false;
let autoRestartCount = 0;
let mutationCount = 0;
let miniGameCount = 0;
let massRevivalTriggered = false;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function eliminatePlayer(player) {
  player.eliminated = true;
  player.lives = 0;
}

function eliminatePlayerById(id) {
  const player = gamePlayers.find(p => p.id === id);
  if (player) eliminatePlayer(player);
}

function getRandomNftImage() {
  const useUgly = Math.random() < 0.5;

  if (useUgly) {
    const tokenId = Math.floor(Math.random() * 615) + 1;
    return `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;
  } else {
    const tokenId = Math.floor(Math.random() * 126) + 1;
    return `https://ipfs.io/ipfs/bafybeicydaui66527mumvml5ushq5ngloqklh6rh7hv3oki2ieo6q25ns4/${tokenId}.webp`;
  }
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
  "🎲 rolled a natural 1 during a simple prayer.",
  "🧃 drank the glowing Kool-Aid. Bold. Wrong.",
  "🧠 thought too hard about strategy and exploded.",
  "📦 opened a mystery box and got consumed by it.",
  "👻 got ghosted — literally.",
  "🌪️ summoned a wind and forgot to duck.",
  "🐸 kissed a cursed frog. Became the frog. Was stepped on.",
  "🦴 offered a bone to the wrong altar. Got eaten by the altar.",
  "🕯️ lit a candle that screamed. Didn’t blow it out fast enough.",
  "📿 fumbled the incantation and summoned their own doom.",
  "🪚 played 'Would You Rather' with the Gauntlet. Lost.",
  "🐍 tried to speak Parseltongue. Spoke it too well.",
  "🍄 ate a mushroom that grew upside-down. So did they.",
  "🔔 rang the bell of endings. Didn’t read the fine print.",
  "📼 watched a cursed VHS. Forgot to rewind.",
  "💼 found a briefcase full of teeth. Took it. Regretted it.",
  "👒 put on the fancy hat. Became the fancy hat.",
  "🎩 was chosen by The Hat. The Hat was hungry.",
  "🚪 opened a door marked 'Nope.' Went in anyway.",
  "🛏️ laid down for a nap mid-game. Never woke up.",
  "🎭 changed their mask and lost themselves.",
  "🪄 tried to cast 'Revive.' Got reversed.",
  "📎 stapled their fate to the wrong timeline.",
  "📱 swiped left on destiny. It swiped back.",
  "🔗 clicked an airdrop. Became the drop.",
  "💿 played a forbidden song. Danced into the void.",
  "🐚 listened to a conch shell. Heard their own death.",
  "🎤 shouted “I’m invincible!” Cue dramatic irony.",
  "🚽 flushed something sacred. Gauntlet didn’t approve.",
  "🎮 paused the game. Gauntlet didn’t.",
  "🛹 failed a sick trick. Got sick. Then tricked.",
  "🩰 danced too close to the edge of logic.",
  "🧽 scrubbed away the only rule keeping them alive.",
  "🦷 bit into a charm biscuit. Wasn’t food.",
  "🕰️ asked what time it was. Answer: Time to die.",
  "🖋️ signed a contract mid-round. Didn’t read clause 666.",
  "🔐 locked the wrong door. From the inside.",
  "📖 skipped a lore page. Got skipped in return.",
  "🎯 aimed for glory. Hit the floor-y."
];


const reviveSuccessLines = [
  "🕯️ rose from the ashes like a confused phoenix.",
  "🧠 remembered the cheat code to respawn.",
  "📦 broke out of the mystery box. Slightly damaged.",
  "🔁 glitched back into reality. Don’t question it.",
  "🎯 hit the sweet spot on the charm. It purred.",
  "🛏️ power-napped through death. Refreshed!",
  "📢 yelled 'DO OVER!' loud enough. It worked.",
  "🔮 reassembled their atoms from a bad prophecy.",
  "🎲 gambled their soul and hit a nat 20.",
  "🧷 held it together with one paperclip and hope.",
  "🧛 un-died out of pure spite.",
  "📺 watched the post-credit scene. Surprise: revival!",
  "💉 injected with 100ccs of sheer willpower.",
  "🎤 dropped a comeback line so hard it reversed fate.",
  "🐾 followed a ghost dog back to the living.",
  "🧼 cleaned up their death scene and got let off.",
  "🪙 tossed a coin into the charm’s well. Got lucky.",
  "🪞 reflected on their mistakes. Came back enlightened.",
  "🫧 floated to the surface of the void like a bubble.",
  "💡 had a bright idea. So bright it blinded Death."
];


const reviveFailLines = [
  "🪦 tugged at fate's sleeve. Got shrugged off.",
  "💀 asked nicely. The charm laughed.",
  "🚪 knocked on the door of life. It was locked.",
  "🔮 begged the Oracle. The Oracle was on lunch break.",
  "🛸 beamed up… to the wrong dimension.",
  "📉 investment in reincarnation did not pay off.",
  "🪤 baited the trap. Became the bait.",
  "📛 name tag still said 'Eliminated.' No entry.",
  "🧻 slipped in the underworld bathroom. Gone again.",
  "🔋 revival battery: critically low.",
  "🧊 tried to look cool. Froze instead.",
  "🎭 wore the mask of life. It didn’t fit.",
  "🧩 put the wrong soul in the wrong body.",
  "🎰 pulled the lever. Got three skulls.",
  "🧃 drank the wrong elixir. Felt super dead.",
  "🪑 sat in the revival chair. It was a mimic.",
  "📼 rewound fate too far. Erased self.",
  "🛑 stepped on a comeback glyph. It said 'Nope.'",
  "🔕 silence wasn't golden. It was fatal.",
  "🌚 whispered a wish to the wrong moon."
];


const warpEchoes = [
  "🌀 'All doors are open. None should be.'",
  "🫧 'Reality twitches. Hold onto something soft.'",
  "💤 'The charm is dreaming. You're the nightmare.'",
  "🕷️ 'A hundred eyes blink at once. Then none.'",
  "📿 'Your choices are whispers in a storm.'",
  "📡 'Someone is watching. They don’t blink.'",
  "🧵 'You were stitched together wrong. The thread knows.'",
  "🔄 'The loop loops again. Was this the first time?'",
  "🌑 'Something behind the moon just blinked back.'",
  "💽 'Memory overwritten. You were never here.'",
  "📯 'The horn sounds backwards. So does time.'",
  "🐚 'The seashell whispers in reverse.'",
  "📖 'The pages are all blank — but bleeding.'",
  "🦴 'Bones don’t lie. But they do hum sometimes.'",
  "🫀 'Heartbeat irregular. Rhythm divine.'",
  "🎲 'The dice rolled before you chose.'",
  "🔍 'The more you look, the less you see.'",
  "🧪 'Stirred again. Spoiled again. Charm again.'",
  "📍 'This isn’t a checkpoint. It’s a trap.'",
  "🗝️ 'You had the key. You swallowed it.'",
  "🛐 'Something old has noticed you.'",
  "📺 'Channel 666 is static… or screaming?'",
  "👣 'You’re following your own footsteps. They’re fresh.'",
  "🌪️ 'The wind speaks. You shouldn’t answer.'",
  "🚪 'The door breathes. Don’t knock.'",
  "🕳️ 'The hole blinked.'",
  "🧊 'Cold. But not temperature. Something colder.'",
  "🎡 'Around and around. You fall off eventually.'",
  "🩻 'Your shadow shows a different skeleton.'",
  "🧼 'Clean hands. Guilty wrists.'"
];


const uglychants = [
  "🔮 *'Ugly born and charm-bred, one by one we fall or tread.'*",
  "👁️ *'What is beauty but a lie? Let the lovely ones all die.'*",
  "🧤 *'Mismatched gloves and backwards feet, only freaks survive the heat.'*",
  "🪵 *'Wooden teeth and patchwork skin, let the malformed one begin.'*",
  "🧂 *'Salt the charm, scar the night. Make the pretty ones take flight.'*",
  "🪙 *'Flip a coin, roll your fate, ugly finds the ugly great.'*",
  "👂 *'Hear the chant? Don’t respond. It’s your echo, far beyond.'*",
  "🐀 *'Squeak and scurry, cursed and quick. The charming ones decay too quick.'*",
  "🥫 *'Rattle the tin, ring the bell, who walks ugly walks through hell.'*",
  "💀 *'Bones like branches, teeth like seeds — this is all the Ugly needs.'*",
  "🎭 *'Smile crooked, blink too wide. Charm was never on your side.'*",
  "🎻 *'Strings pulled tight, mouths sewn shut, only Ugly makes the cut.'*",
  "🪰 *'Swarm of faces, none are real. Ugly is the only deal.'*",
  "🕯️ *'Light the wax and chant the name — beauty burns, but Ugly stays.'*",
  "🫀 *'Thump-thump-thump, it beats so loud. Cover it in charm and shroud.'*",
  "🧴 *'Rub the charm into your soul, patch the cracks and lose control.'*",
  "🪞 *'Mirror, mirror, cracked and grim, show me something malformed within.'*",
  "📯 *'Blow the horn and split the sky, let the beautiful ones cry.'*",
  "🪤 *'Step by step, the trap is set. Ugly eats what charm forgets.'*",
  "🌚 *'Dark and darker still it gets — Ugly’s grace is all you’ll get.'*",
  "🍽️ *'Forked tongues, chipped cups, we feast on misfits, never luck.'*",
  "📜 *'Scribble a name, strike it out. Only the charm knows what it’s about.'*",
  "🧃 *'Sip the charm and sway like ghosts — to ugly fate we make a toast!'*",
  "📢 *'Speak not loud, speak not proud — charm prefers a broken sound.'*",
  "🪰 *'Flies know best where charm has been.'*",
  "👣 *'Ugly walks with quiet toes, cracking charm wherever it goes.'*"
];


const uglyOracleRiddles = [
  {
    question: "I have no mouth yet speak in screams. I haunt your sleep and drip in dreams. What am I?",
    answer: "nightmare"
  },
  {
    question: "Cracked and cold, I reflect what's false. Gaze too long, and you'll be lost. What am I?",
    answer: "mirror"
  },
  {
    question: "Devour me and you will see, visions warped and memory free. What am I?",
    answer: "mushroom"
  },
  {
    question: "Born of rot but dressed in bloom, I stink of life and hint of doom. What am I?",
    answer: "corpseflower"
  },
  {
    question: "I walk without feet, whisper without breath, and follow you to death. What am I?",
    answer: "shadow"
  },
  {
    question: "Open me and find your fear, sealed inside for countless years. What am I?",
    answer: "chest"
  },
  {
    question: "I have a face but no soul, a smile without control. I dance, I wait. What am I?",
    answer: "mask"
  },
  {
    question: "From bone and string, I rise to play — silent when you look away. What am I?",
    answer: "puppet"
  },
  {
    question: "I rot, I feed, I bloom, I hide — my teeth are roots, my breath is wide. What am I?",
    answer: "fungus"
  },
  {
    question: "A name unspoken, cursed from birth, I dwell below the charmless earth. What am I?",
    answer: "forgotten"
  },
  {
    question: "Drip by drip I carve the stone, not with blade but time alone. What am I?",
    answer: "water"
  },
  {
    question: "Tick but no clock, breath with no lungs. I chase you forward and rot the young. What am I?",
    answer: "time"
  },
  {
    question: "I sleep beneath your skin and wake with fire. You scratch, I spread. What am I?",
    answer: "itch"
  },
  {
    question: "I'm fed by loss and shaped by scars. The deeper I go, the more you are. What am I?",
    answer: "pain"
  },
  {
    question: "I am the truth in twisted tone, the voice that sounds like not your own. What am I?",
    answer: "echo"
  },
  {
    question: "Once I lived, now I stare. Empty sockets, full of care. What am I?",
    answer: "skull"
  },
  {
    question: "I ring without bell, burn without flame, and mark the moment you're not the same. What am I?",
    answer: "curse"
  },
  {
    question: "I move in silence, but not alone. My steps are many, my will unknown. What am I?",
    answer: "herd"
  },
  {
    question: "The uglier I get, the more you look. I tell no lies but am no book. What am I?",
    answer: "face"
  }
];


// ✅ Updated mutationEvents with logOnly support
// Each event now:
// - Accepts 4th argument: logOnly (default false)
// - Returns a string when logOnly === true
// - Skips sending embeds if logOnly is true

mutationEvents = [
{
  name: "The Maw Opens",
  description: "A gaping mouth forms in the sky. It hungers. Choose to FEED it or FLEE.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const fed = [];
    const fled = [];

    if (!logOnly) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('feed').setLabel('FEED').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('flee').setLabel('FLEE').setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle("🕳️ The Maw Opens")
        .setDescription("A gaping mouth forms in the sky. It hungers.\n\nYou may **FEED** the Maw with part of your soul... or attempt to **FLEE**.")
        .setColor(0x8B0000);

      const msg = await channel.send({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 10000 });

      collector.on('collect', async i => {
        if (i.user.bot) return;
        if (fed.includes(i.user.id) || fled.includes(i.user.id)) {
          return i.reply({ content: "You already chose!", ephemeral: true });
        }
        if (i.customId === 'feed') fed.push(i.user.id);
        else fled.push(i.user.id);
        await i.reply({ content: `🩸 Choice recorded: ${i.customId.toUpperCase()}`, ephemeral: true });
      });

      collector.on('end', async () => {
        const feedOutcome = fed.map(id => `<@${id}>`).join(', ') || "*No one*";
        const fleeOutcome = fled.map(id => `<@${id}>`).join(', ') || "*No one*";

        const resultEmbed = new EmbedBuilder()
          .setTitle("🩸 The Maw Has Spoken")
          .setDescription(`**Fed the Maw:** ${feedOutcome}\n**Fled:** ${fleeOutcome}`)
          .setFooter({ text: "The Maw is... temporarily satisfied." })
          .setColor(0x5e0000);

        await msg.edit({ embeds: [resultEmbed], components: [] });
      });
      return ""; // embed is shown separately
    }

    return `The Maw appeared... Players were given the chance to FEED or FLEE. Results unknown in silent log mode.`;
  }
},
  {
  name: "Press the Charm",
  description: "A single button appears. Press it... or not.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('presscharm').setLabel('Press It').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔴 Press the Charm")
      .setDescription("A single button appears. Press it... or not.\n\nClick fast. Someone’s gonna blow.")
      .setColor(0xdd2222);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });
    const results = [];

    collector.on('collect', async i => {
      if (i.user.bot || results.includes(i.user.id)) return;
      results.push(i.user.id);
      await i.reply({ content: "🧨 You pressed the Charm.", ephemeral: true });
    });

    collector.on('end', async () => {
      const unlucky = results.length > 0 ? results[Math.floor(Math.random() * results.length)] : null;
      if (unlucky) eliminatePlayerById(unlucky);

      const resultEmbed = new EmbedBuilder()
        .setTitle("💥 Boom!")
        .setDescription(unlucky
          ? `<@${unlucky}> pressed too hard...`
          : "Nobody dared press it. The charm is... disappointed.")
        .setColor(0xff0000);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "The Charmhole",
  description: "A writhing vortex opens in the ground. Some are pulled in. A few emerge... changed.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const chosen = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.3);
    const results = [];

    for (const player of chosen) {
      const roll = Math.random();
      if (roll < 0.33) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        results.push(`💀 <@${player.id}> was consumed by the Charmhole.`);
      } else if (roll < 0.66) {
        player.lives += 2;
        results.push(`💫 <@${player.id}> emerged glowing with **+2 lives**.`);
      } else {
        results.push(`❓ <@${player.id}> returned... but seems unchanged. For now.`);
      }
    }

    const text = results.join('\n') || "The Charmhole grumbled, but spared everyone.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🌀 The Charmhole Opens")
        .setDescription(text)
        .setColor(0x443355);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
{
  name: "The Mind Swap",
  description: "Two players suddenly switch souls. Only one survives the swap.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const candidates = gamePlayers.filter(p => !p.eliminated);
    if (candidates.length < 2) return "Not enough players for a Mind Swap.";

    const [p1, p2] = candidates.sort(() => 0.5 - Math.random()).slice(0, 2);
    const winner = Math.random() < 0.5 ? p1 : p2;
    const loser = winner === p1 ? p2 : p1;

    loser.eliminated = true;
    eliminatedPlayers.push(loser);
    winner.lives += 1;

    const text = `🧠 <@${p1.id}> and <@${p2.id}> swapped minds.\n🎲 The charm allowed <@${winner.id}> to live — they gain **+1 life**.\n💀 <@${loser.id}> was lost in the void.`;

    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🧬 The Mind Swap")
        .setDescription(text)
        .setColor(0x776688);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
{
  name: "The Coffee Curse",
  description: "The scent of cursed coffee fills the air. Those who sip it feel the full jolt of fate.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const chosen = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.5);
    const lines = [];

    for (const player of chosen) {
      const roll = Math.random();
      if (roll < 0.25) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        lines.push(`☠️ <@${player.id}> chugged the cursed ☕ and collapsed.`);
      } else if (roll < 0.6) {
        player.lives += 1;
        lines.push(`⚡ <@${player.id}> felt the buzz — **+1 life**.`);
      } else {
        lines.push(`😐 <@${player.id}> felt nothing. Maybe it was decaf.`);
      }
    }

    const text = lines.join('\n') || "No one dared to sip.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("☕ The Coffee Curse")
        .setDescription(text)
        .setColor(0x5c4033);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
{
  name: "The Mirror of Echoes",
  description: "The mirror offers you power… or punishment. Only the brave step forward.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const brave = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.4);
    const lines = [];

    for (const player of brave) {
      const roll = Math.random();
      if (roll < 0.2) {
        player.lives += 3;
        lines.push(`🪞 <@${player.id}> mastered the reflection and gained **+3 lives**!`);
      } else if (roll < 0.5) {
        player.lives -= 1;
        if (player.lives <= 0) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💔 <@${player.id}> was shattered by their own reflection.`);
        } else {
          lines.push(`⚠️ <@${player.id}> lost a life facing themselves.`);
        }
      } else {
        lines.push(`👤 <@${player.id}> stared into the mirror and walked away... haunted, but untouched.`);
      }
    }

    const text = lines.join('\n') || "No one faced the mirror. Cowards.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🪞 The Mirror of Echoes")
        .setDescription(text)
        .setColor(0x444466);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
{
  name: "The Spiral Bloom",
  description: "A monstrous flower blooms, releasing spores that twist fate. Risk touching it?",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const touched = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.5);
    const outcomes = [];

    for (const player of touched) {
      const fate = Math.random();
      if (fate < 0.2) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        outcomes.push(`🌺 <@${player.id}> inhaled deeply and was twisted into mulch.`);
      } else if (fate < 0.6) {
        player.lives += 2;
        outcomes.push(`🌼 <@${player.id}> gained clarity — **+2 lives**.`);
      } else {
        outcomes.push(`🌸 <@${player.id}> was kissed by pollen. No change… yet.`);
      }
    }

    const text = outcomes.join('\n') || "The flower wilted, unnoticed.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🌺 The Spiral Bloom")
        .setDescription(text)
        .setColor(0x9900cc);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
{
  name: "The Thought Leech",
  description: "A shimmering parasite hovers, offering knowledge… for a cost.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const chosen = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.5);
    const lines = [];

    for (const player of chosen) {
      const roll = Math.random();
      if (roll < 0.25) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        lines.push(`🧠 <@${player.id}> learned the truth — and their mind imploded.`);
      } else if (roll < 0.6) {
        player.lives += 1;
        lines.push(`📘 <@${player.id}> absorbed forbidden wisdom. **+1 life.**`);
      } else {
        lines.push(`💤 <@${player.id}> resisted the leech's call and slept through the event.`);
      }
    }

    const text = lines.join('\n') || "None accepted the Leech. It hovers... waiting.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🧠 The Thought Leech")
        .setDescription(text)
        .setColor(0x222299);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
},
  {
  name: "The Masquerade",
  description: "A grand ball begins. Masks fall. Identities blur. Fate dances.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    const dancers = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.6);
    const results = [];

    for (const player of dancers) {
      const roll = Math.random();
      if (roll < 0.2) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        results.push(`🎭 <@${player.id}> danced too close to the edge. Eliminated.`);
      } else if (roll < 0.6) {
        player.lives += 1;
        results.push(`💃 <@${player.id}> found rhythm and gained **+1 life**.`);
      } else {
        results.push(`🕺 <@${player.id}> enjoyed the masquerade unharmed.`);
      }
    }

    const text = results.join('\n') || "No one dared to dance.";
    if (!logOnly) {
      const embed = new EmbedBuilder()
        .setTitle("🎭 The Masquerade")
        .setDescription(text)
        .setColor(0x993377);
      await channel.send({ embeds: [embed] });
    }

    return text;
  }
}

  ];

const mutationMiniGames = [
{
  name: "Press the Charm",
  description: "A single button appears. Press it... or not. Someone’s gonna blow.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    if (logOnly) return "A single red button appeared... no one pressed it (logOnly).";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('presscharm').setLabel('Press It').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔴 Press the Charm")
      .setDescription("A single button appears. Press it... or not.\n\nClick fast. Someone’s gonna blow.")
      .setColor(0xdd2222);

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });
    const results = [];

    collector.on('collect', async i => {
      if (i.user.bot || results.includes(i.user.id)) return;
      results.push(i.user.id);
      await i.reply({ content: "🧨 You pressed it!", ephemeral: true });
    });

    collector.on('end', async () => {
      const unlucky = results[Math.floor(Math.random() * results.length)];
      const text = unlucky
        ? `💥 <@${unlucky}> pressed it last. Eliminated!`
        : "🧨 No one pressed it. The room sighed with relief.";

      if (unlucky) {
        const player = gamePlayers.find(p => p.id === unlucky);
        if (player) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🧨 Detonation Complete")
        .setDescription(text)
        .setColor(0xff0000);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });

    return "";
  }
},
{
  name: "Feed the Beast",
  description: "A beast demands tribute. Offer your life… or someone else's?",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    if (logOnly) return "The beast came hungry. Tribute was whispered. (logOnly)";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('self').setLabel('Sacrifice Self').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('other').setLabel('Nominate Another').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🦴 Feed the Beast")
      .setDescription("The beast awakens, drooling. Will you sacrifice yourself… or offer someone else?")
      .setColor(0x663300);

    const msg = await channel.send({ embeds: [embed], components: [row] });
    const votes = { self: [], other: [] };

    const collector = msg.createMessageComponentCollector({ time: 10000 });

    collector.on('collect', async i => {
      if (i.user.bot || votes.self.includes(i.user.id) || votes.other.includes(i.user.id)) return;
      votes[i.customId].push(i.user.id);
      await i.reply({ content: `🦴 You voted: ${i.customId.toUpperCase()}`, ephemeral: true });
    });

    collector.on('end', async () => {
      const majority = votes.self.length >= votes.other.length ? 'self' : 'other';
      let resultText = "";

      if (majority === 'self') {
        const victim = votes.self[Math.floor(Math.random() * votes.self.length)];
        if (victim) {
          const player = gamePlayers.find(p => p.id === victim);
          if (player) {
            player.eliminated = true;
            eliminatedPlayers.push(player);
          }
          resultText = `☠️ <@${victim}> sacrificed themselves. The beast is satisfied.`;
        } else {
          resultText = "The beast was confused. No tribute found.";
        }
      } else {
        const pool = gamePlayers.filter(p => !p.eliminated);
        const random = pool[Math.floor(Math.random() * pool.length)];
        if (random) {
          random.eliminated = true;
          eliminatedPlayers.push(random);
          resultText = `💀 <@${random.id}> was dragged into the beast’s maw.`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("🦴 The Beast Feeds")
        .setDescription(resultText)
        .setColor(0x552211);

      await msg.edit({ embeds: [embed], components: [] });
    });

    return "";
  }
},
{
  name: "Don’t Click the Charm",
  description: "The big red button is BACK. But this time… you better not click it.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    if (logOnly) return "A cursed red button appeared. No one dared to touch it. (logOnly)";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dontclick').setLabel('Do NOT Click').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🚨 Don’t Click the Charm")
      .setDescription("Whatever you do… don’t click this button.\n\nClickers will regret it.")
      .setColor(0xdd0000);

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 8000 });
    const clickers = [];

    collector.on('collect', async i => {
      if (!clickers.includes(i.user.id)) {
        clickers.push(i.user.id);
        await i.reply({ content: "😵 You couldn’t resist!", ephemeral: true });
      }
    });

    collector.on('end', async () => {
      let resultText = "";

      if (clickers.length > 0) {
        clickers.forEach(uid => {
          const player = gamePlayers.find(p => p.id === uid);
          if (player) {
            player.eliminated = true;
            eliminatedPlayers.push(player);
          }
        });
        resultText = clickers.map(uid => `☠️ <@${uid}> clicked it. Instantly gone.`).join('\n');
      } else {
        resultText = "👏 No one clicked. You passed the test.";
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🔒 Temptation Resisted?")
        .setDescription(resultText)
        .setColor(0x111111);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });

    return "";
  }
},
{
  name: "Pick a Door",
  description: "Three doors stand before you. One leads forward. Two… do not.",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    if (logOnly) return "Three mysterious doors appeared. Choices were made. (logOnly)";

    const correct = Math.floor(Math.random() * 3);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('door0').setLabel('🚪 1').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('door1').setLabel('🚪 2').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('door2').setLabel('🚪 3').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🚪 Pick a Door")
      .setDescription("Only one door leads forward. Choose wisely.")
      .setColor(0x996633);

    const msg = await channel.send({ embeds: [embed], components: [row] });
    const results = { safe: [], doomed: [] };

    const collector = msg.createMessageComponentCollector({ time: 8000 });

    collector.on('collect', async i => {
      const player = gamePlayers.find(p => p.id === i.user.id);
      if (!player || player.eliminated) return;

      const picked = parseInt(i.customId.replace('door', ''));
      if (picked === correct) {
        results.safe.push(i.user.id);
        await i.reply({ content: "✅ Safe! You live.", ephemeral: true });
      } else {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        results.doomed.push(i.user.id);
        await i.reply({ content: "💀 Wrong door. You're out.", ephemeral: true });
      }
    });

    collector.on('end', async () => {
      const safeList = results.safe.map(uid => `✅ <@${uid}>`).join('\n');
      const doomList = results.doomed.map(uid => `💀 <@${uid}>`).join('\n');
      const text = [safeList, doomList].filter(Boolean).join('\n') || "No one opened a door. Game skipped.";

      const resultEmbed = new EmbedBuilder()
        .setTitle("🚪 Door Results")
        .setDescription(text)
        .setColor(0x554422);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });

    return "";
  }
},
{
  name: "Push or Protect",
  description: "Push another into the void? Or defend a friend?",
  async effect(channel, gamePlayers, eliminatedPlayers, logOnly = false) {
    if (logOnly) return "Some pushed, some protected… the void whispered thanks. (logOnly)";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('push').setLabel('Push Someone').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('protect').setLabel('Protect Someone').setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setTitle("🌀 Push or Protect")
      .setDescription("Choose a fate: push someone into the void… or protect someone from harm.")
      .setColor(0x224455);

    const msg = await channel.send({ embeds: [embed], components: [row] });
    const votes = { push: [], protect: [] };

    const collector = msg.createMessageComponentCollector({ time: 8000 });

    collector.on('collect', async i => {
      if (votes.push.includes(i.user.id) || votes.protect.includes(i.user.id)) return;
      votes[i.customId].push(i.user.id);
      await i.reply({ content: `You chose: ${i.customId.toUpperCase()}`, ephemeral: true });
    });

    collector.on('end', async () => {
      let victim;
      if (votes.push.length > 0) {
        const candidates = gamePlayers.filter(p => !p.eliminated);
        victim = candidates[Math.floor(Math.random() * candidates.length)];
      }

      let resultText = "";
      if (victim) {
        const isProtected = votes.protect.includes(victim.id);
        if (isProtected) {
          resultText = `🛡️ <@${victim.id}> was pushed — but protected. Survives.`;
        } else {
          victim.eliminated = true;
          eliminatedPlayers.push(victim);
          resultText = `💨 <@${victim.id}> was shoved into the void. Gone.`;
        }
      } else {
        resultText = "The void waits. No one pushed.";
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🌀 Push or Protect Results")
        .setDescription(resultText)
        .setColor(0x336666);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });

    return "";
  }
}
 
];

// --- Gauntlet Command Listeners (Reordered) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  // Handle trial first to avoid misfire
  if (content === '!gauntlettrial') {
    if (gameActive) return message.reply("⚠️ A Gauntlet is already active!");
    return startJoinPhase(message.channel, 5000, true); // isTrial = true
  }

  // Dev command
  if (content === '!gauntletdev') {
    if (gameActive) return message.reply("⚠️ A Gauntlet is already active!");
    return startJoinPhase(message.channel, 10000, false); // short test window
  }

  // Default Gauntlet
  if (content.startsWith('!gauntlet')) {
    if (gameActive) {
      return message.reply("⚠️ A Gauntlet is already active!");
    }

    const args = content.split(' ');
    const minutes = parseInt(args[1]) || 2;
    return startJoinPhase(message.channel, minutes * 60 * 1000, false);
  }
  if (!message.content.startsWith('!revive')) return;
  if (message.author.bot) return;

  const playerId = message.author.id;
  const username = message.author.username;

  // Check if user is actually eliminated
  const alreadyIn = gamePlayers.find(p => p.id === playerId && !p.eliminated);
  if (alreadyIn) {
    return message.reply({ content: `😅 You're already in the game, ${username}! Sit tight...` });
  }

  const isEliminated = eliminatedPlayers.find(p => p.id === playerId);
  if (!isEliminated) {
    return message.reply({ content: `🤔 You're not part of this Gauntlet run. Wait for the next one!` });
  }

  // Roll for revival
  const chance = Math.random();
  if (chance < 0.3) {
    // Revived
    eliminatedPlayers = eliminatedPlayers.filter(p => p.id !== playerId);
    const revivedPlayer = { ...isEliminated, eliminated: false, lives: 1 };
    gamePlayers.push(revivedPlayer);

    const successLine = reviveSuccessLines[Math.floor(Math.random() * reviveSuccessLines.length)];
    return message.channel.send(`🌟 **${username}** ${successLine}`);
  } else {
    // Failed
    const failLine = reviveFailLines[Math.floor(Math.random() * reviveFailLines.length)];
    return message.channel.send(`💀 **${username}** ${failLine}`);
  }
});

// --- Join Phase Logic ---
async function startJoinPhase(channel, duration, isTrial = false) {
  gameActive = true;
  gamePlayers = [];
  eliminatedPlayers = [];
  revivalAttempted = false;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('joingauntlet').setLabel('Join the Gauntlet').setStyle(ButtonStyle.Success)
  );

  const joinEmbed = new EmbedBuilder()
    .setTitle("⚔️ The Gauntlet Begins!")
    .setDescription("Click below to enter the arena. Only one will survive.")
    .setFooter({ text: `Game starts in ${(duration / 1000 / 60).toFixed(1)} minutes` })
    .setColor(0x00ff99);

  const joinMsg = await channel.send({ content: "@everyone ⚠️ A new Gauntlet is forming!", embeds: [joinEmbed], components: [joinButton] });

  const collector = joinMsg.createMessageComponentCollector({ time: duration });
  const joiners = new Set();

  collector.on('collect', async interaction => {
    if (interaction.customId !== 'joingauntlet') return;
    if (joiners.has(interaction.user.id)) {
      return interaction.reply({ content: "You're already in!", ephemeral: true });
    }

    joiners.add(interaction.user.id);
    const player = {
      id: interaction.user.id,
      username: interaction.user.username,
      lives: 1,
      eliminated: false,
      joinedAt: Date.now(),
      isBoss: false
    };
    gamePlayers.push(player);

    await interaction.reply({ content: `✅ You've joined The Gauntlet. Good luck, <@${interaction.user.id}>!`, ephemeral: true });
  });

  // Timed join reminders
  const intervals = [duration / 3, (duration / 3) * 2];
  intervals.forEach((ms, idx) => {
    setTimeout(() => {
      if (!collector.ended) {
        const remaining = Math.round((duration - ms) / 1000);
        channel.send({ content: `⏳ <@everyone> Only **${Math.ceil(remaining / 60)} minutes** left to join! [Click here to join](${joinMsg.url})` });
      }
    }, ms);
  });

  // --- End Join Phase ---
  collector.on('end', async () => {
    if (isTrial) {
      const fakeNames = [
        "Botrick", "UglyGPT", "Charmander", "FunkStink", "NoSleep", "Uglet",
        "HairyHag", "MalformedMike", "CrustyCarl", "SoggyWitch", "NFTBag", "TrialTroll",
        "Flexorcist", "GasPasser", "DegenJean", "LilWart", "StankLee", "BuglyBob", "SleepySue", "RitualRandy"
      ];

      fakeNames.forEach((name, index) => {
        gamePlayers.push({
          id: `trial_player_${index}`,
          username: name,
          lives: 1,
          eliminated: false,
          joinedAt: Date.now(),
          isBoss: false
        });
      });
    }

    if (gamePlayers.length === 0) {
      gameActive = false;
      return channel.send("❌ No one joined The Gauntlet. Cancelled.");
    }

    await channel.send(`🔒 Join phase ended. **${gamePlayers.length}** players are entering The Gauntlet...`);
    return startGauntlet(gamePlayers, channel, isTrial);
  });
}
// --- Start Game Function ---
async function startGauntlet(players, channel, isTrial = false) {
  gamePlayers = [...players];
  eliminatedPlayers = [];
  revivalAttempted = false;
  gamePlayers.forEach(p => {
    p.lives = 1;
    p.eliminated = false;
    p.isBoss = false;
  });

  await runBossVotePhase(channel);
  await wait(8000);

  await runGauntlet(channel, isTrial);
}

// --- Boss Vote Phase ---
async function runBossVotePhase(channel) {
  const contenders = shuffleArray(gamePlayers).slice(0, 5);
  const row = new ActionRowBuilder();

  contenders.forEach((p) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bossvote_${p.id}`)
        .setLabel(p.username)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle("👑 BOSS VOTE")
    .setDescription("Choose the one who will rise as the **Boss-Level Ugly**. They gain +1 extra life.")
    .setColor(0xffcc00);

  const voteMsg = await channel.send({ embeds: [embed], components: [row] });

  const votes = {};
  const collector = voteMsg.createMessageComponentCollector({ time: 10000 });

  collector.on('collect', async interaction => {
    const targetId = interaction.customId.split('_')[1];
    votes[targetId] = (votes[targetId] || 0) + 1;
    await interaction.reply({ content: `🗳️ Vote registered for <@${targetId}>`, ephemeral: true });
  });

  collector.on('end', async () => {
    await voteMsg.edit({ components: [] });

    const winnerId = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
    const boss = gamePlayers.find(p => p.id === winnerId) || contenders[0];
    boss.lives = 2;
    boss.isBoss = true;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("👑 The Boss Has Risen")
          .setDescription(`<@${boss.id}> is now the **Boss-Level Ugly** with 2 lives!`)
          .setColor(0xff8800)
      ]
    });
  });
}
async function runGauntlet(channel, isTrial = false) {
  let eventCount = 0;
  const totalPlayers = gamePlayers.length;
  const usedRiddleIndexes = new Set();
  let mutationUsed = 0;
  let miniGameUsed = 0;
  massRevivalTriggered = false;

  while (gamePlayers.filter(p => !p.eliminated).length > 3) {
    eventCount++;
    const alive = gamePlayers.filter(p => !p.eliminated);
    const aliveCount = alive.length;

    await wait(3000);

    // --- Embed 1: Lore ---
    const loreEmbed = await generateLoreEmbed(eventCount);
    await channel.send({ embeds: [loreEmbed] });

    // --- Embed 2: Interaction (Mutation or MiniGame) ---
    await wait(2000);
    let eventType = '';
    let eventResult = '';
    const roll = Math.random();
    if (roll < 0.5 && mutationUsed < 2 && aliveCount > 4) {
      eventType = 'mutation';
      mutationUsed++;
    } else if (miniGameUsed < 2 && aliveCount > 4) {
      eventType = 'miniGame';
      miniGameUsed++;
    }

    if (eventType) {
      eventResult = await showEventInteraction(channel, eventType);
    }

    // --- Oracle Riddle ---
    await wait(500);
    const riddleResult = await awaitRiddleAnswer(channel, usedRiddleIndexes);

    // --- Elimination Round ---
    const preElim = gamePlayers.filter(p => !p.eliminated);
    await runEliminationRound(channel, true); // suppress embed
    const eliminatedThisRound = preElim.filter(p => p.eliminated);
    const eliminationLines = eliminatedThisRound.length > 0
      ? eliminatedThisRound.map(p =>
          `• <@${p.id}> ${eliminationReasons[Math.floor(Math.random() * eliminationReasons.length)]}`
        ).join('\n')
      : '*No eliminations this round.*';

    const roundRatio = `🎲 **${aliveCount}/${totalPlayers} remain**`;

    // --- Embed 3: Round Summary ---
    const summaryEmbed = new EmbedBuilder()
      .setTitle(`📜 Event ${eventCount} Summary`)
      .setDescription([
        eventResult,
        `💀 **Eliminations:**\n${eliminationLines}`,
        riddleResult,
        roundRatio
      ].filter(Boolean).join('\n\n'))
      .setColor(0xff99cc);

    await channel.send({ embeds: [summaryEmbed] });

    // 💫 Mass Revival Trigger
    if (!massRevivalTriggered && eliminatedPlayers.length > totalPlayers / 2) {
      await wait(3000);
      await runMassRevivalEvent(channel);
      massRevivalTriggered = true;
    }

    await wait(3000);
  }

  // FINAL SHAKEUP
  await runEliminationRound(channel);
  await wait(3000);
  if (gamePlayers.filter(p => !p.eliminated).length > 4) {
    await runMutationEvent(channel);
    await wait(2500);
    await runMiniGameEvent(channel);
    await wait(2500);
  }
  if (!massRevivalTriggered && eliminatedPlayers.length > totalPlayers / 2) {
    await wait(3000);
    await runMassRevivalEvent(channel);
    massRevivalTriggered = true;
  }

  await wait(3000);
  await channel.send("🕯️ The charm pulses... Final fate will now be decided.");
  await wait(2000);

  const aliveFinal = gamePlayers.filter(p => !p.eliminated);
  if (aliveFinal.length > 1) {
    await channel.send("⚔️ The charm demands one last offering...");
    await runEliminationRound(channel);
    await wait(3000);
  } else if (aliveFinal.length === 0) {
    await channel.send("💀 All are gone. The charm devoured every soul.");
    await wait(2000);
  }

  const finalists = gamePlayers.filter(p => !p.eliminated);
  const top3 = [...finalists, ...eliminatedPlayers]
    .sort((a, b) => (b.lives || 0) - (a.lives || 0))
    .slice(0, 3);

  const winner = top3[0];
  const runnerUp = top3[1];
  const third = top3[2];

  const podiumEmbed = new EmbedBuilder()
    .setTitle("🔥 THE GAUNTLET IS OVER 🔥")
    .setDescription(`
🏆 **Champion:** ${winner ? `<@${winner.id}>` : 'Nobody'} — ${winner?.lives || 0} lives remain
🥈 **Runner-Up:** ${runnerUp ? `<@${runnerUp.id}>` : 'Unknown'} — ${runnerUp?.lives || 0} lives
🥉 **Third Place:** ${third ? `<@${third.id}>` : 'Unknown'} — ${third?.lives || 0} lives
`)
    .setFooter({ text: "The charm sleeps... for now." })
    .setColor(0xff2266)
    .setThumbnail('https://media.tenor.com/fAjdHbBtWyEAAAAj/fire-skull-burning.gif');

  await channel.send({ embeds: [podiumEmbed] });

  if (!isTrial) {
    for (let i = 0; i < top3.length; i++) {
      const player = top3[i];
      if (!player) continue;
      await updateStats(player.id, player.username, i === 0 ? 1 : 0, 0, 0);
    }
  }

  gameActive = false;
  autoRestartCount = 0;

  if (!isTrial) {
    await showRematchButton(channel, gamePlayers);
  }
}

async function generateLoreEmbed(eventCount) {
  const loreOptions = [];

  if (Math.random() < 0.4) {
    const echo = warpEchoes[Math.floor(Math.random() * warpEchoes.length)];
    loreOptions.push(`🌌 *"${echo}"*`);
  }

  if (Math.random() < 0.3) {
    const chant = uglychants[Math.floor(Math.random() * uglychants.length)];
    loreOptions.push(`🔊 *"${chant}"*`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Event ${eventCount}`)
    .setDescription(loreOptions.length > 0 ? loreOptions.join('\n') : '*The charm is quiet...*')
    .setColor(0xff66aa);

  return embed;
}
async function showEventInteraction(channel, eventType) {
  if (eventType === 'mutation') {
    const mutation = mutationEvents[Math.floor(Math.random() * mutationEvents.length)];
    const embed = new EmbedBuilder()
      .setTitle(`🧬 Mutation: ${mutation.name}`)
      .setDescription(mutation.description)
      .setColor(0x9933ff);

    await channel.send({ embeds: [embed] });
    const result = await mutation.effect(channel, gamePlayers, eliminatedPlayers);
    return result || '';
  } else {
    const miniGame = mutationMiniGames[Math.floor(Math.random() * mutationMiniGames.length)];
    const embed = new EmbedBuilder()
      .setTitle(`🎯 Mini-Game: ${miniGame.name}`)
      .setDescription(miniGame.description)
      .setColor(0x00ccff);

    await channel.send({ embeds: [embed] });
    const result = await miniGame.effect(channel, gamePlayers, eliminatedPlayers);
    return result || '';
  }
}



async function awaitRiddleAnswer(channel, usedRiddleIndexes) {
  if (usedRiddleIndexes.size >= uglyOracleRiddles.length || Math.random() > 0.3) return '';

  let index;
  do {
    index = Math.floor(Math.random() * uglyOracleRiddles.length);
  } while (usedRiddleIndexes.has(index));
  usedRiddleIndexes.add(index);

  const riddle = uglyOracleRiddles[index];
  const embed = new EmbedBuilder()
    .setTitle("🔮 Ugly Oracle Riddle")
    .setDescription(`> ${riddle.question}\n\nReply in **30 seconds** to gain a life.`)
    .setColor(0xaa00aa);

  await channel.send({ embeds: [embed] });

  const collected = await channel.awaitMessages({ filter: m => !m.author.bot, time: 30000 });
  const winners = [];

  collected.forEach(msg => {
    if (msg.content.toLowerCase().includes(riddle.answer)) {
      const player = gamePlayers.find(p => p.id === msg.author.id);
      if (player && !player.eliminated) {
        player.lives++;
        winners.push(`<@${player.id}>`);
      }
    }
  });

  return winners.length > 0
    ? `🧠 Riddle answered by ${winners.join(', ')}. +1 life.`
    : `🤷‍♂️ The Oracle went unanswered.`;
}


// --- Elimination Round ---
async function runEliminationRound(channel, logOnly = false) {
  const alive = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  const count = Math.min(3, Math.floor(Math.random() * 2) + 2); // 2 or 3 eliminations
  const toEliminate = shuffleArray(alive).slice(0, count);

  const lines = [];

  for (const player of toEliminate) {
    player.lives--;
    if (player.lives <= 0) {
      player.eliminated = true;
      eliminatedPlayers.push(player);
    }
    const line = `• <@${player.id}> ${eliminationReasons[Math.floor(Math.random() * eliminationReasons.length)]}`;
    lines.push(line);
  }

  if (!logOnly) {
    const embed = new EmbedBuilder()
      .setTitle("💀 Casualties This Round")
      .setDescription(lines.join('\n'))
      .setColor(0xff4444)
      .setImage(getRandomNftImage());

    await channel.send({ embeds: [embed] });
  }

  return lines.length > 0 ? `💀 **Eliminations:**\n${lines.join('\n')}\n` : `💀 No eliminations this round.\n`;
}


async function runMutationEvent(channel, logOnly = false) {
  const mutation = mutationEvents[Math.floor(Math.random() * mutationEvents.length)];
  if (logOnly) return `\n🧬 **Mutation: ${mutation.name}**\n${mutation.description}\n`;

  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation Event: ${mutation.name}`)
    .setDescription(mutation.description)
    .setColor(0x9933ff);

  await channel.send({ embeds: [embed] });

  const resultText = await mutation.effect(channel, gamePlayers, eliminatedPlayers);
  return `\n🧬 **Mutation: ${mutation.name}**\n${resultText || 'No major effects occurred.'}\n`;
}
async function runMiniGameEvent(channel, logOnly = false) {
  const miniGame = mutationMiniGames[Math.floor(Math.random() * mutationMiniGames.length)];
  if (logOnly) return `\n🎯 **Mini-Game: ${miniGame.name}**\n${miniGame.description}\n`;

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Mini-Game: ${miniGame.name}`)
    .setDescription(miniGame.description)
    .setColor(0x00ccff);

  await channel.send({ embeds: [embed] });

  const resultText = await miniGame.effect(channel, gamePlayers, eliminatedPlayers);
  return `\n🎯 **Mini-Game: ${miniGame.name}**\n${resultText || 'No clear winners...'}\n`;
}
async function runMassRevivalEvent(channel) {
  const embed = new EmbedBuilder()
    .setTitle("💫 Totem of Lost Souls")
    .setDescription("Eliminated players and outsiders have one chance to **click the Totem** and return.\n\nOnly the lucky shall rise again.")
    .setColor(0xff00cc);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('revivetotem')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [button] });

  const collector = msg.createMessageComponentCollector({ time: 6000 });
  const attempted = [];

  collector.on('collect', async i => {
    if (i.user.bot || attempted.includes(i.user.id)) return;
    attempted.push(i.user.id);
    await i.reply({ content: "🔮 You touched the Totem...", ephemeral: true });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });

    const revived = [];
    const failed = [];

    for (const id of attempted) {
      const isEliminated = eliminatedPlayers.find(p => p.id === id);
      const isNew = !gamePlayers.find(p => p.id === id);
      const successChance = isEliminated ? 0.6 : 0.4;

      if (Math.random() < successChance) {
        if (isEliminated) {
          const player = eliminatedPlayers.find(p => p.id === id);
          player.eliminated = false;
          player.lives = 1;
          revived.push(`<@${id}>`);
        } else {
          const member = await channel.guild.members.fetch(id);
          const newPlayer = {
            id: id,
            username: member.user.username,
            lives: 1,
            eliminated: false,
            joinedAt: Date.now(),
            isBoss: false
          };
          gamePlayers.push(newPlayer);
          revived.push(`<@${id}>`);
        }
      } else {
        failed.push(`<@${id}>`);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("🕯️ Totem Judgment")
      .setDescription(`**Revived:** ${revived.length ? revived.join(', ') : '*None*'}\n**Failed:** ${failed.length ? failed.join(', ') : '*None*'}`)
      .setColor(revived.length ? 0x33cc99 : 0x333333);

    await channel.send({ embeds: [resultEmbed] });
  });
}
async function runDuelEvent(channel) {
  const alivePlayers = gamePlayers.filter(p => !p.eliminated);
  if (alivePlayers.length < 2) return "🪦 Not enough players alive to duel.\n";

  const [p1, p2] = shuffleArray(alivePlayers).slice(0, 2);

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Duel of Fates")
    .setDescription(`Only one shall survive...\n\n🟥 **${p1.username}** vs 🟦 **${p2.username}**\nClick your button fast!`)
    .setColor(0xff4444);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_${p1.id}`).setLabel(`${p1.username}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`duel_${p2.id}`).setLabel(`${p2.username}`).setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ time: 5000 });
  const pressed = new Set();

  collector.on('collect', async i => {
    if (pressed.has(i.user.id)) return;
    if (i.customId === `duel_${p1.id}` || i.customId === `duel_${p2.id}`) {
      pressed.add(i.user.id);
      await i.reply({ content: "⚔️ Duel initiated!", ephemeral: true });
      collector.stop(i.customId); // End with winner's button
    }
  });

  collector.on('end', async (_, reason) => {
    await msg.edit({ components: [] });

    let winner, loser;
    if (reason === `duel_${p1.id}`) {
      winner = p1;
      loser = p2;
    } else if (reason === `duel_${p2.id}`) {
      winner = p2;
      loser = p1;
    } else {
      // No one clicked
      return await channel.send("🤷 Nobody dueled. The charm is disappointed.");
    }

    winner.lives++;
    loser.lives--;
    if (loser.lives <= 0) {
      loser.eliminated = true;
      eliminatedPlayers.push(loser);
    }

    await channel.send(`🏅 <@${winner.id}> wins the duel and gains +1 life.\n💀 <@${loser.id}> loses the duel and ${loser.eliminated ? 'is eliminated!' : 'loses 1 life.'}`);
  });

  return "🗡️ A duel was fought.";
}
async function runOracleRiddle(channel, usedRiddleIndexes) {
  if (usedRiddleIndexes.size >= uglyOracleRiddles.length) return "";

  let index;
  do {
    index = Math.floor(Math.random() * uglyOracleRiddles.length);
  } while (usedRiddleIndexes.has(index));

  usedRiddleIndexes.add(index);
  const riddle = uglyOracleRiddles[index];

  const embed = new EmbedBuilder()
    .setTitle("🔮 Ugly Oracle Riddle")
    .setDescription(`> ${riddle.question}\n\nReply in the next **30 seconds** to gain a life.`)
    .setColor(0xaa00aa);
  await channel.send({ embeds: [embed] });

  const collected = await channel.awaitMessages({ filter: m => !m.author.bot, time: 30000 });
  const correctPlayers = [];

  collected.forEach(msg => {
    if (msg.content.toLowerCase().includes(riddle.answer)) {
      const player = gamePlayers.find(p => p.id === msg.author.id);
      if (player && !player.eliminated && !correctPlayers.includes(player)) {
        player.lives++;
        correctPlayers.push(player);
      }
    }
  });

  if (correctPlayers.length > 0) {
    const list = correctPlayers.map(p => `<@${p.id}>`).join(', ');
    return `🧠 Oracle answered by ${list}. Gained +1 life.\n`;
  } else {
    return `🤷‍♂️ The riddle went unanswered.\n`;
  }
}


// --- Update Stats in DB ---
async function updateStats(userId, username, wins = 0, revives = 0, duels = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await db.query(`
    INSERT INTO player_stats (user_id, username, wins, revives, duels_won, games_played, year, month)
    VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
    ON CONFLICT (user_id, year, month)
    DO UPDATE SET
      wins = player_stats.wins + $3,
      revives = player_stats.revives + $4,
      duels_won = player_stats.duels_won + $5,
      games_played = player_stats.games_played + 1;
  `, [userId, username, wins, revives, duels, year, month]);
}

// --- Rematch Button ---
async function showRematchButton(channel, previousPlayers) {
  const neededVotes = Math.ceil(previousPlayers.length * 0.75);
  const votes = new Set();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rematch_vote')
      .setLabel('Start Rematch')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔁 Rematch?")
        .setDescription(`If **${neededVotes}** of you want to run it back... we do this again.`)
        .setColor(0x00cc99)
    ],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({ time: 15000 });

  collector.on('collect', async i => {
    if (votes.has(i.user.id)) {
      return i.reply({ content: "Already voted!", ephemeral: true });
    }
    votes.add(i.user.id);
    await i.reply({ content: "🔁 You voted for rematch!", ephemeral: true });

    if (votes.size >= neededVotes && gameActive === false) {
      autoRestartCount++;
      if (autoRestartCount > 4) {
        await channel.send("⚠️ Too many auto-restarts in a row. Rest period triggered.");
        return;
      }
      await msg.edit({ components: [] });
      return startJoinPhase(channel, 10000, false); // 10s rematch window
    }
  });

  collector.on('end', async () => {
    if (votes.size < neededVotes) {
      await msg.edit({ components: [] });
      await channel.send("🛑 Not enough votes to restart.");
    }
  });
}

// --- Leaderboard Command ---
client.on('messageCreate', async (message) => {
  if (message.content === '!leaderboard') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [wins, revives, games] = await Promise.all([
      db.query(`SELECT username, wins FROM player_stats WHERE year=$1 AND month=$2 ORDER BY wins DESC LIMIT 3`, [year, month]),
      db.query(`SELECT username, revives FROM player_stats WHERE year=$1 AND month=$2 ORDER BY revives DESC LIMIT 3`, [year, month]),
      db.query(`SELECT username, games_played FROM player_stats WHERE year=$1 AND month=$2 ORDER BY games_played DESC LIMIT 3`, [year, month])
    ]);

    const formatTop = (rows, label) => rows.rows.map((r, i) => `**${i + 1}.** ${r.username} — ${r[label]}`).join('\n') || "*None yet*";

    const embed = new EmbedBuilder()
      .setTitle("📊 Monthly Leaderboard")
      .addFields(
        { name: "🏆 Wins", value: formatTop(wins, 'wins'), inline: true },
        { name: "🧠 Revives", value: formatTop(revives, 'revives'), inline: true },
        { name: "🎮 Games Played", value: formatTop(games, 'games_played'), inline: true }
      )
      .setFooter({ text: `${month}/${year}` })
      .setColor(0x00aaff);

    await message.channel.send({ embeds: [embed] });
  }
});

// --- Player Stats Command ---
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!stats')) {
    const mention = message.mentions.users.first() || message.author;
    const id = mention.id;

    const res = await db.query(`
      SELECT SUM(wins) as wins, SUM(revives) as revives, SUM(duels_won) as duels, SUM(games_played) as games
      FROM player_stats WHERE user_id = $1
    `, [id]);

    const row = res.rows[0] || {};
    const embed = new EmbedBuilder()
      .setTitle(`📈 Stats for ${mention.username}`)
      .addFields(
        { name: "🏆 Wins", value: `${row.wins || 0}`, inline: true },
        { name: "🧠 Revives", value: `${row.revives || 0}`, inline: true },
        { name: "⚔️ Duels Won", value: `${row.duels || 0}`, inline: true },
        { name: "🎮 Games Played", value: `${row.games || 0}`, inline: true }
      )
      .setColor(0xdddddd);

    await message.channel.send({ embeds: [embed] });
  }
});

// --- Bot Ready Handler ---
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Launch Bot ---
client.login(process.env.TOKEN);
