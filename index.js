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


// --- Mutation Events ---
mutationEvents = [
  {
    name: "The Maw Opens",
    description: "A gaping mouth forms in the sky. It hungers. Choose to FEED it or FLEE.",
    async effect(channel, gamePlayers, eliminatedPlayers) {
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
      const results = { fed: [], fled: [] };

      collector.on('collect', async i => {
        if (i.user.bot) return;
        if (results.fed.includes(i.user.id) || results.fled.includes(i.user.id)) {
          return i.reply({ content: "You already chose!", ephemeral: true });
        }
        if (i.customId === 'feed') results.fed.push(i.user.id);
        else results.fled.push(i.user.id);
        await i.reply({ content: `🩸 Choice recorded: ${i.customId.toUpperCase()}`, ephemeral: true });
      });

      collector.on('end', async () => {
        const feedOutcome = results.fed.map(id => `<@${id}>`).join(', ') || "*No one*";
        const fleeOutcome = results.fled.map(id => `<@${id}>`).join(', ') || "*No one*";

        const resultEmbed = new EmbedBuilder()
          .setTitle("🩸 The Maw Has Spoken")
          .setDescription(`**Fed the Maw:** ${feedOutcome}\n**Fled:** ${fleeOutcome}`)
          .setFooter({ text: "The Maw is... temporarily satisfied." })
          .setColor(0x5e0000);

        await msg.edit({ embeds: [resultEmbed], components: [] });
      });
    }
  },
  {
    name: "The Charmhole",
    description: "A writhing vortex opens in the ground. Some are pulled in. A few emerge... changed.",
    async effect(channel, gamePlayers, eliminatedPlayers) {
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

      const embed = new EmbedBuilder()
        .setTitle("🌀 The Charmhole Opens")
        .setDescription(results.length ? results.join('\n') : "The Charmhole grumbled, but spared everyone.")
        .setColor(0x443355);

      await channel.send({ embeds: [embed] });
    }
  },
  {
    name: "The Mind Swap",
    description: "Two players suddenly switch souls. Only one survives the swap.",
    async effect(channel, gamePlayers, eliminatedPlayers) {
      const candidates = gamePlayers.filter(p => !p.eliminated);
      if (candidates.length < 2) return;

      const [p1, p2] = candidates.sort(() => 0.5 - Math.random()).slice(0, 2);
      const winner = Math.random() < 0.5 ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;

      loser.eliminated = true;
      eliminatedPlayers.push(loser);
      winner.lives += 1;

      const embed = new EmbedBuilder()
        .setTitle("🧬 The Mind Swap")
        .setDescription(`🧠 <@${p1.id}> and <@${p2.id}> had their souls switched.\n🎲 The charm allowed <@${winner.id}> to live — they gain **+1 life**.\n💀 <@${loser.id}> was lost in the void.`)
        .setColor(0x776688);

      await channel.send({ embeds: [embed] });
    }
  },
  {
    name: "The Coffee Curse",
    description: "The scent of cursed coffee fills the air. Those who sip it feel the full jolt of fate.",
    async effect(channel, gamePlayers, eliminatedPlayers) {
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

      const embed = new EmbedBuilder()
        .setTitle("☕ The Coffee Curse")
        .setDescription(lines.join('\n') || "No one dared to sip.")
        .setColor(0x5c4033);

      await channel.send({ embeds: [embed] });
    }
  },
{
  name: "The Mirror of Echoes",
  description: "The mirror offers you power… or punishment. Only the brave step forward.",
  async effect(channel) {
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

    const embed = new EmbedBuilder()
      .setTitle("🪞 The Mirror of Echoes")
      .setDescription(lines.join('\n') || "No one faced the mirror. Cowards.")
      .setColor(0x444466);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Spiral Bloom",
  description: "A monstrous flower blooms, releasing spores that twist fate. Risk touching it?",
  async effect(channel) {
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

    const embed = new EmbedBuilder()
      .setTitle("🌺 The Spiral Bloom")
      .setDescription(outcomes.join('\n') || "The flower wilted, unnoticed.")
      .setColor(0x9900cc);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Thought Leech",
  description: "A shimmering parasite hovers, offering knowledge… for a cost.",
  async effect(channel) {
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

    const embed = new EmbedBuilder()
      .setTitle("🧠 The Thought Leech")
      .setDescription(lines.join('\n') || "None accepted the Leech. It hovers... waiting.")
      .setColor(0x222299);

    await channel.send({ embeds: [embed] });
  }
},
{
  name: "The Masquerade",
  description: "Masks fall from the sky. Wear one, and your fate may shift.",
  async effect(channel) {
    const participants = gamePlayers.filter(p => !p.eliminated && Math.random() < 0.6);
    const results = [];

    for (const player of participants) {
      const roll = Math.random();
      if (roll < 0.2) {
        player.eliminated = true;
        eliminatedPlayers.push(player);
        results.push(`🎭 <@${player.id}> wore the mask of lies. It consumed them.`);
      } else if (roll < 0.5) {
        player.lives += 2;
        results.push(`🎭 <@${player.id}> chose the mask of valor. **+2 lives!**`);
      } else {
        results.push(`🎭 <@${player.id}> donned the mask of mystery. Nothing happened… yet.`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🎭 The Masquerade")
      .setDescription(results.join('\n') || "No one touched the masks. They now drift away on the wind.")
      .setColor(0x660066);

    await channel.send({ embeds: [embed] });
  }
}  
];


// --- Mutation Mini-Games ---
const mutationMiniGames = [
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
  name: "The Charm Pulse",
  description: "The charm vibrates. You may touch it — or you may die.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pulse').setLabel('Touch the Charm').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔵 The Charm Pulse")
      .setDescription("A dangerous energy emits from the charm. Press at your own risk.")
      .setColor(0x3399ff);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 8000 });

    const results = [];

    collector.on('collect', async i => {
      if (i.user.bot || results.includes(i.user.id)) return;
      results.push(i.user.id);
      await i.reply({ content: "⚡ You reached for the charm...", ephemeral: true });
    });

    collector.on('end', async () => {
      const resultLines = [];

      for (const id of results) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player || player.eliminated) continue;

        const roll = Math.random();
        if (roll < 0.25) {
          player.lives++;
          resultLines.push(`❤️ <@${id}> gained a life!`);
        } else if (roll < 0.5) {
          player.lives--;
          if (player.lives <= 0) {
            player.eliminated = true;
            eliminatedPlayers.push(player);
            resultLines.push(`💀 <@${id}> touched the wrong part. Eliminated.`);
          } else {
            resultLines.push(`💔 <@${id}> lost a life!`);
          }
        } else {
          resultLines.push(`⚖️ <@${id}> was unaffected.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("⚡ Pulse Results")
        .setDescription(resultLines.join('\n') || "No one dared touch it.")
        .setColor(0x2222ff);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "Coin of Reversal",
  description: "All eliminated players may flip the cursed coin — one side revives, the other explodes.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('flipcoin').setLabel('Flip the Coin').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🪙 Coin of Reversal")
      .setDescription("Eliminated players only: flip the coin to gamble your soul.")
      .setColor(0xaaaaaa);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 6000 });

    const attempts = [];

    collector.on('collect', async i => {
      if (i.user.bot || attempts.includes(i.user.id)) return;

      const wasDead = eliminatedPlayers.find(p => p.id === i.user.id);
      const alreadyAlive = gamePlayers.find(p => p.id === i.user.id && !p.eliminated);

      if (!wasDead || alreadyAlive) {
        return i.reply({ content: "🧟 Only eliminated players can flip this coin.", ephemeral: true });
      }

      attempts.push(i.user.id);
      await i.reply({ content: "🪙 You flip the cursed coin...", ephemeral: true });
    });

    collector.on('end', async () => {
      const results = [];

      for (const id of attempts) {
        const roll = Math.random();
        if (roll < 0.5) {
          const player = eliminatedPlayers.find(p => p.id === id);
          player.eliminated = false;
          player.lives = 1;
          results.push(`🧠 <@${id}> flipped heads and **revived**!`);
        } else {
          results.push(`💥 <@${id}> flipped tails and **was vaporized again.**`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🎲 Coin Results")
        .setDescription(results.join('\n') || "None flipped the coin.")
        .setColor(0xbbbbbb);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
 {
  name: "The Split Path",
  description: "Two identical doorways. One is a trap.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('leftdoor').setLabel('Left Door').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rightdoor').setLabel('Right Door').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🚪 The Split Path")
      .setDescription("Two doors. One leads forward, the other to elimination.\nChoose wisely.")
      .setColor(0x222266);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 9000 });

    const chosen = { left: [], right: [] };

    collector.on('collect', async i => {
      if (i.user.bot || chosen.left.includes(i.user.id) || chosen.right.includes(i.user.id)) return;
      if (i.customId === 'leftdoor') chosen.left.push(i.user.id);
      if (i.customId === 'rightdoor') chosen.right.push(i.user.id);
      await i.reply({ content: "🚪 You stepped through...", ephemeral: true });
    });

    collector.on('end', async () => {
      const safeSide = Math.random() < 0.5 ? 'left' : 'right';
      const doomed = safeSide === 'left' ? chosen.right : chosen.left;
      const lines = [];

      for (const id of doomed) {
        const player = gamePlayers.find(p => p.id === id);
        if (player && !player.eliminated) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💀 <@${id}> chose poorly.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("⚖️ The Path Chosen")
        .setDescription(`**Safe Door:** ${safeSide.toUpperCase()}\n${lines.join('\n') || "Everyone survived!"}`)
        .setColor(0x333388);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "The Ugly Crystal",
  description: "A fractured crystal glows. Risk your life to overcharge it.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('chargecrystal').setLabel('Charge Crystal').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🔮 The Ugly Crystal")
      .setDescription("Click to charge it with your essence. It may reward you with **+2 lives**, or obliterate you.")
      .setColor(0xaa00ff);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 9000 });

    const chargers = [];

    collector.on('collect', async i => {
      if (i.user.bot || chargers.includes(i.user.id)) return;
      chargers.push(i.user.id);
      await i.reply({ content: "🔋 Energy absorbed...", ephemeral: true });
    });

    collector.on('end', async () => {
      const lines = [];

      for (const id of chargers) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player || player.eliminated) continue;

        const roll = Math.random();
        if (roll < 0.33) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
          lines.push(`💥 <@${id}> overloaded the crystal. Eliminated.`);
        } else {
          player.lives += 2;
          lines.push(`✨ <@${id}> gained **2 lives** from the charge.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🌌 Crystal Discharge")
        .setDescription(lines.join('\n') || "No one dared to touch it.")
        .setColor(0xcc88ff);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
  }
},
{
  name: "Bargain With the Charm",
  description: "Offer part of your vitality to try and revive a fallen ally.",
  async effect(interaction, gamePlayers, eliminatedPlayers) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('offerlife').setLabel('Offer Life').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🤝 Bargain With the Charm")
      .setDescription("You may sacrifice a life to revive someone random. The charm may accept… or ignore you.")
      .setColor(0x888800);

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 8000 });

    const sacrificers = [];

    collector.on('collect', async i => {
      const player = gamePlayers.find(p => p.id === i.user.id);
      if (!player || player.eliminated || player.lives < 2 || sacrificers.includes(i.user.id)) {
        return i.reply({ content: "🩸 You don’t have enough life to offer.", ephemeral: true });
      }

      sacrificers.push(i.user.id);
      player.lives -= 1;
      await i.reply({ content: "☠️ You offer your life to the charm...", ephemeral: true });
    });

    collector.on('end', async () => {
      const results = [];

      for (const id of sacrificers) {
        const player = gamePlayers.find(p => p.id === id);
        if (!player) continue;

        const candidates = eliminatedPlayers.filter(p => p.id !== id);
        if (candidates.length === 0) continue;

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        if (Math.random() < 0.5) {
          chosen.eliminated = false;
          chosen.lives = 1;
          results.push(`💓 <@${id}> sacrificed and revived <@${chosen.id}>!`);
        } else {
          results.push(`🪦 <@${id}>'s sacrifice was rejected. No revival.`);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🪙 The Bargain Complete")
        .setDescription(results.join('\n') || "No one attempted a bargain.")
        .setColor(0xcccc44);

      await msg.edit({ embeds: [resultEmbed], components: [] });
    });
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
  let round = 0;
  const totalPlayers = gamePlayers.length;

while (gamePlayers.filter(p => !p.eliminated).length > 3) {
  round++;
  const alive = gamePlayers.filter(p => !p.eliminated);
  const aliveCount = alive.length;

  await wait(8000);
  await channel.send(`🔄 **Round ${round}** begins! (${aliveCount}/${totalPlayers} remain)`);

  // Lore: Warp Echo
  if (Math.random() < 0.4) {
    const echo = warpEchoes[Math.floor(Math.random() * warpEchoes.length)];
    await channel.send(`🌌 ${echo}`);
    await wait(3000);
  }

  // Lore: Ugly Chant
  if (Math.random() < 0.2) {
    const chant = uglychants[Math.floor(Math.random() * uglychants.length)];
    await channel.send(`🔊 *Ugly Chant:* "${chant}"`);
    await wait(2500);
  }

  // Lore: Oracle Riddle
  if (Math.random() < 0.2) {
    const riddle = uglyOracleRiddles[Math.floor(Math.random() * uglyOracleRiddles.length)];
    const embed = new EmbedBuilder()
      .setTitle("🔮 Ugly Oracle Riddle")
      .setDescription(`> ${riddle.question}\n\nReply with the answer in the next **30 seconds** to gain a life.`)
      .setColor(0xaa00aa);
    await channel.send({ embeds: [embed] });

    const collected = await channel.awaitMessages({
      filter: m => !m.author.bot,
      time: 30000
    });

    const correctPlayers = [];

    collected.forEach(msg => {
      if (msg.content.toLowerCase().includes(riddle.answer)) {
        const player = gamePlayers.find(p => p.id === msg.author.id);
        if (player && !player.eliminated) {
          player.lives++;
          correctPlayers.push(player);
        }
      }
    });

    if (correctPlayers.length > 0) {
      const list = correctPlayers.map(p => `<@${p.id}>`).join(', ');
      await channel.send(`🧠 The charm acknowledges the clever ones: ${list} — each gains **+1 life**.`);
    } else {
      await channel.send(`🤷‍♂️ No one solved the Oracle's riddle. The charm remains unimpressed.`);
    }

    await wait(2000);
  }

  // 🧟 Always run an elimination round
  await runEliminationRound(channel);

  // 🧬 Two Mutation Events
  if (gamePlayers.filter(p => !p.eliminated).length > 4) {
    await runMutationEvent(channel);
    await wait(3000);
    await runMutationEvent(channel);
  }

  // 🎮 Two Mini-Games
  if (gamePlayers.filter(p => !p.eliminated).length > 4) {
    await runMiniGameEvent(channel);
    await wait(3000);
    await runMiniGameEvent(channel);
  }
  // 💫 One Mass Revival if >50% eliminated and not yet triggered
  if (!massRevivalTriggered && eliminatedPlayers.length > totalPlayers / 2) {
    await wait(3000);
    await runMassRevivalEvent(channel);
    massRevivalTriggered = true;
  }
}
  await runEliminationRound(channel);

  if (gamePlayers.filter(p => !p.eliminated).length > 4) {
    await runMutationEvent(channel);
    await wait(3000);
    await runMutationEvent(channel);

    await runMiniGameEvent(channel);
    await wait(3000);
    await runMiniGameEvent(channel);
  }

  if (!massRevivalTriggered && eliminatedPlayers.length > totalPlayers / 2) {
    await wait(3000);
    await runMassRevivalEvent(channel);
    massRevivalTriggered = true;
  }

// ✅ End of main while loop — now the game ends
const finalists = gamePlayers.filter(p => !p.eliminated);
const top3 = [...finalists, ...eliminatedPlayers]
  .sort((a, b) => (b.lives || 0) - (a.lives || 0))
  .slice(0, 3);

const podiumEmbed = new EmbedBuilder()
  .setTitle(isTrial ? "🏁 Trial Gauntlet Complete" : "🏆 The Gauntlet Has Ended")
  .setDescription(`
🥇 **1st:** ${top3[0] ? `<@${top3[0].id}> with ${top3[0].lives} lives` : 'Unknown'}
🥈 **2nd:** ${top3[1] ? `<@${top3[1].id}> with ${top3[1].lives} lives` : 'Unknown'}
🥉 **3rd:** ${top3[2] ? `<@${top3[2].id}> with ${top3[2].lives} lives` : 'Unknown'}
  `)
  .setFooter({ text: isTrial ? "This was a test run." : "Glory is temporary. Ugliness is eternal." })
  .setColor(isTrial ? 0xaaaaaa : 0x00ffcc)
  .setThumbnail('https://cdn.discordapp.com/emojis/1120652421982847017.gif?size=96&quality=lossless');

await channel.send({ embeds: [podiumEmbed] });

// Wrap up stats and rematch
if (!isTrial) {
  for (let i = 0; i < top3.length; i++) {
    const player = top3[i];
    if (!player) continue;
    await updateStats(player.id, player.username, i === 0 ? 1 : 0, 0, 0);
  }
}

  // Reset state
  gameActive = false;
  autoRestartCount = 0;

  // Rematch button
  if (!isTrial) {
    await showRematchButton(channel, gamePlayers);
  }
}


// --- Elimination Round ---
async function runEliminationRound(channel) {
  const alive = gamePlayers.filter(p => !p.eliminated && p.lives > 0);
  const count = Math.min(3, Math.floor(Math.random() * 2) + 2); // 2 or 3 eliminations
  const toEliminate = shuffleArray(alive).slice(0, count);

  for (const player of toEliminate) {
    player.lives--;
    if (player.lives <= 0) {
      player.eliminated = true;
      eliminatedPlayers.push(player);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("💀 Casualties This Round")
    .setDescription(toEliminate.map(p => `• <@${p.id}> ${eliminationReasons[Math.floor(Math.random() * eliminationReasons.length)]}`).join('\n'))
    .setColor(0xff4444)
    .setImage(getRandomNftImage());

  await channel.send({ embeds: [embed] });
}

// --- Mutation Event ---
async function runMutationEvent(channel) {
  const mutation = mutationEvents[Math.floor(Math.random() * mutationEvents.length)];
  
  const embed = new EmbedBuilder()
    .setTitle(`🧬 Mutation Event: ${mutation.name}`)
    .setDescription(mutation.description)
    .setColor(0x9933ff);

  await channel.send({ embeds: [embed] });

  // Pass just channel directly (not wrapped in an object)
  await mutation.effect(channel, gamePlayers, eliminatedPlayers);
}


async function runMiniGameEvent(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎮 Mini-Game Time")
    .setDescription("Click the right button. You have 5 seconds. One will save you. One will not.")
    .setColor(0x00ccff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('safe_button')
      .setLabel('🟢 Safe')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('trap_button')
      .setLabel('🔴 Trap')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  const clicked = [];

  const collector = msg.createMessageComponentCollector({ time: 5000 });

  collector.on('collect', async i => {
    if (clicked.includes(i.user.id)) return;
    clicked.push(i.user.id);

    if (i.customId === 'trap_button') {
      const player = gamePlayers.find(p => p.id === i.user.id);
      if (player && !player.eliminated) {
        player.lives--;
        if (player.lives <= 0) {
          player.eliminated = true;
          eliminatedPlayers.push(player);
        }
        await i.reply({ content: "💥 You clicked the trap! You lose a life.", ephemeral: true });
      }
    } else {
      await i.reply({ content: "✅ You survived the mini-game!", ephemeral: true });
    }
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] });
  });
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
          const player = {
            id: id,
            username: member.user.username,
            lives: 1,
            eliminated: false,
            joinedAt: Date.now(),
            isBoss: false
          };
          gamePlayers.push(player);
          revived.push(`<@${id}>`);
        }
      } else {
        failed.push(`<@${id}>`);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle("🕯️ Totem Judgment")
      .setDescription(`**Revived:** ${revived.length > 0 ? revived.join(', ') : '*None*'}\n**Failed:** ${failed.length > 0 ? failed.join(', ') : '*None*'}`)
      .setColor(revived.length ? 0x33cc99 : 0x333333);

    await channel.send({ embeds: [resultEmbed] });
  });
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
