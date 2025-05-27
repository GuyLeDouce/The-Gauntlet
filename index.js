require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} = require('discord.js');
const axios = require('axios');
const { Client: PgClient } = require('pg'); // renamed to avoid conflict

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

    console.log('📊 player_stats and monthly_champions tables are ready!');
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
// === GLOBAL STATE VARIABLES ===
let gauntletEntrants = [];
let gauntletActive = false;
let joinTimeout = null;
let gauntletChannel = null;
let gauntletMessage = null;
let currentDelay = 0;
let remaining = [];
let eliminatedPlayers = [];
let activeBoons = {};
let activeCurses = {};
let roundImmunity = {};
let mutationDefenseClicks = new Set();
let fateRolls = {};
let tauntTargets = {};
let dodgeAttempts = {};
let hideAttempts = {};
let rematchClicks = 0;
let lastGameEntrantCount = 0;
let rematchesThisHour = 0;
let rematchLimitResetTime = Date.now();
let completedGames = 0;
let isTrialMode = false;
let previousRemaining = 0;
let lastVoteRound = -2;
let totemTriggered = false;
let massReviveTriggered = false;
let nonProgressRounds = 0;
let noEliminationRounds = 0;
let rematchClicksSet = new Set();

// === GAME DATA ARRAYS ===
const eliminationEvents = [
  "was dragged into the swamp by unseen claws.",
  "tried to pet a malformed dog. It bit back... with ten mouths.",
  "got yeeted off the platform by a sentient fart cloud.",
  "exploded after lighting a fart too close to a rune circle.",
  "was judged too handsome and instantly vaporized.",
  "spoke in rhymes one too many times.",
  "was too ugly. Even for the Malformed.",
  "turned into a rubber duck and floated away.",
  "got tangled in the Lore Scrolls and suffocated.",
  "joined the wrong Discord and disappeared forever.",
  "ate the wrong mushroom and became sentient wallpaper.",
  "laughed at the wrong joke and got obliterated by cringe.",
  "tripped over an imaginary rock and fell into the void.",
  "summoned their own shadow. It won the duel.",
  "took a selfie during the ritual. The flash was fatal.",
  "got banned by the council of malformed ethics.",
  "forgot the safe word during a summoning.",
  "got memed into another dimension.",
  "mislabeled an artifact as ‘mid’. The artifact retaliated.",
  "tried to floss dance during a summoning and evaporated from shame.",
  "failed a captcha from the underworld and got IP banned.",
  "attempted to roast the Malformed… and got cooked instead.",
  "challenged the void to a staring contest. Lost instantly.",
  "mistook a cursed artifact for a burrito. Their last bite.",
  "said “trust me bro” before casting a spell. Big mistake.",
  "unplugged the simulation to save energy. Got deleted.",
  "touched grass... and it bit back.",
  "tried to pet the Lore Keeper. Now part of the lore.",
  "left a one-star Yelp review of the Gauntlet. Was promptly removed.",
  "activated voice chat mid-ritual. Was drowned out by screams.",
  "wore Crocs to the final trial. It was too disrespectful.",
  "typed “/dance” at the wrong moment. Was breakdanced out of existence.",
  "cast Summon Uber and got taken away. Permanently.",
  "failed a vibe check from the Gauntlet Spirits.",
  "opened an ancient book backwards. Instant regret.",
  "spilled Monster energy drink on the summoning circle. RIP.",
  "used “literally me” too many times. Became nobody.",
  "mistook a lava pit for a jacuzzi.",
  "flexed their NFTs. The gods rugged them.",
  "brought AI to the ritual. The timeline folded.",
  "minted a cursed token and vanished during gas fees.",
  "yelled “YOLO” during the Rite of Shadows. They did not.",
  "asked for WiFi mid-quest. Got throttled into the afterlife.",
  "was caught multitasking. The Gauntlet demands full attention.",
  "opened a lootbox labeled “DO NOT OPEN.”",
  "hit reply-all in the underworld newsletter. Got banned.",
  "sipped tea brewed with cursed toenails. Instantly dissolved.",
  "tried to out-lore the Lore Keeper. Their voice got eaten.",
  "mistook the Totem for a vending machine. Pressed B3, got obliterated.",
  "called an Ugly ‘mid’ and was banished to the Shadow Subreddit.",
  "flirted with the Bone Witch. She ghosted them — literally.",
  "took a selfie with a Malformed Idol. Got cursed with photobomb gremlins.",
  "snuck a pizza slice into the Ritual. Summoned the Deep Cheese.",
  "typed `!exit` during the trial. The Gauntlet granted their wish.",
  "laughed at a cursed meme. Turned into 404 error.",
  "posted AI art in #ugly-chat. Got flattened by aesthetic backlash.",
  "asked too many questions. Became a lore plot hole.",
  "climbed into a monster's mouth ‘for content’. Never came back.",
  "activated gamer mode during the Sacrifice. Got quickscoped by fate.",
  "made a tier list of Malformed Gods. The lowest ranked one retaliated.",
  "said ‘vibe check failed’ ironically. The check was real.",
  "opened a forbidden box labeled ‘Do Not Even’… and they evened.",
  "tried to explain NFTs to the Undead Accountant. Bored him to death.",
  "summoned their IRL job by accident. Died of emails.",
  "entered the Wrong Door. The one marked 'extremely final exit.'",
  "ate a lore scroll. Mistook it for a burrito. Brain rebooted."
];


const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "rolled a 1 and summoned their ex instead.",
  "flexed too hard and imploded with style.",
  "said ‘GM’ too late and was banished to Shadow Realm.",
  "was cursed by a malformed meme and vaporized in shame.",
  "drew a red card. From a black deck. Gone.",
  "used Comic Sans in a summoning circle.",
  "forgot to use dark mode and burned alive.",
  "glitched into another chain. Nobody followed.",
  "was outed as an undercover Handsome and disqualified.",
  "summoned an influencer. Was vlogged into the void.",
  "forgot to charge their soul. Battery critical.",
  "wore flip-flops to the apocalypse. Slipped into oblivion.",
  "tried to cast “Fireball” with autocorrect on. “Furball” was less effective.",
  "got ghosted… by an actual ghost.",
  "called the Gauntlet “mid.” The Gauntlet responded.",
  "took a bathroom break and came back erased.",
  "equipped the Cloak of Invisibility. It worked a little *too* well.",
  "tweeted something cringe. The spirits canceled them.",
  "rolled a d20 and summoned their inner child. It panicked and ran.",
  "traded souls for Discord Nitro. Got disconnected.",
  "wrote fanfic about the Totem. It came true. Bad idea.",
  "cosplayed as an Ugly Boss. The real one took offense.",
  "booted up Windows 95 during the ritual. Froze in time.",
  "got caught forging $CHARM. Now forged into a bench.",
  "yelled ‘rekt’ at a fallen ally. Was instantly ratioed.",
  "wore an NFT PFP to the Shadow Summit. Was roasted by shadows.",
  "tried to speedrun death. Glitched into permanent deletion.",
  "cast a spell using ChatGPT. Was overwritten.",
  "ate the sacrificial onions. Cried themselves out of existence.",
  "found the forbidden lore PDF. Double-clicked. Triple damned.",
  "asked the Gauntlet for WiFi. Got a dial-up tone to the face.",
  "accidentally summoned a Mod. Got muted. Permanently.",
  "tried to trade a soul for a Quirkling. Was scammed.",
  "used their last breath to say ‘wen token’. Timeline collapsed.",
  "called a Monster ‘mid-evo’. It evolved into vengeance.",
  "built a lore timeline. Got lost in it. Still wandering.",
  "streamed the ritual on TikTok. Got shadowbanned by reality.",
  "offered their body to science. Science declined and deleted them.",
  "poked a Shredding Sassy shrine. Fell into the Snowboardverse."
];


const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "refused to die and bribed fate with $CHARM.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "glitched through the floor, then glitched back.",
  "slapped a demon and respawned out of spite.",
  "screamed so loud the timeline flinched.",
  "burned their death certificate in a candle made of shame.",
  "found a continue screen hidden in the clouds.",
  "got revived by a lonely necromancer for company.",
  "played a revival song on a bone flute they found in their ribcage.",
  "bartered with the void using expired coupons. Somehow worked.",
  "ragequit so hard it reversed their death.",
  "got DM’ed by fate with a “you up?” and said yes.",
  "climbed out of the grave just to finish a bit.",
  "glitched while dying and reloaded checkpoint.",
  "fake cried until the spirits gave in.",
  "convinced the Reaper it was a prank.",
  "used the wrong pronoun in a curse, causing a reset.",
  "was resurrected as a meme, and that counts.",
  "rose again wearing a cape made of bad tweets.",
  "was reposted by the Algorithm of Undeath.",
  "bartered with the Bone Witch using a cursed pog collection.",
  "regrew from a single eyebrow hair. Resilient.",
  "rode a Monster back from the grave. Yeehaw.",
  "was memed into existence by a misfired spell.",
  "got CPR from the Echo of a Screamed GM.",
  "whispered ‘ugly is beauty’ to the void. It nodded.",
  "used ancient lore to edit their fate.txt",
  "respawned in a lore loop. Again. Again. Again.",
  "offered the void a mint. The void accepted.",
  "rolled a nat 20 while dead. Revived on technicality.",
  "convinced death to take their alt account instead.",
  "woke up in a crater full of $CHARM. Just vibing.",
  "un-died out of spite. Absolute petty legend.",
  "slapped a Totem so hard it rewound time.",
  "was resurrected by a meme sacrifice. LOL.",
  "found the Lore Scroll of Undo. Used once. Never again.",
  "stole a heartbeat from a Mod. Didn't ask. Didn't care.",
  "walked out of the afterlife mid-meeting."
];

const reviveFailLines = [
  "🦶 You wiggle in the dirt… but you're still dead.",
  "👁️ The malformed forces laugh and turn away.",
  "☠️ You reached out… and got ghosted.",
  "🧠 You whispered your name backward. Nothing happened.",
  "📉 Your odds dropped further just for trying.",
  "🙈 You faked your death. The Gauntlet unfaked it.",
  "🙃 Your resurrection email bounced.",
  "📵 The ritual hotline is currently down. Try never.",
  "💅 You died fashionably. Unfortunately, still dead.",
  "🥴 You whispered “please?” into the void. It cringed.",
  "📦 The afterlife returned your soul… damaged.",
  "🦴 Your bones attempted to reassemble. They unionized instead.",
  "🐌 Your request was too slow. Death already moved on.",
  "🤡 Your revival was reviewed… and laughed at.",
  "🪤 You triggered a trap trying to live. Good effort though.",
  "🪦 You knocked. Death changed the locks.",
  "😵 You flexed… but forgot to revive first.",
  "🐛 You glitched. The void patched you.",
  "📉 Your revival request was rugged.",
  "🎤 You dropped the comeback line. No mic.",
  "🤖 Botched your ritual with a typo.",
  "👽 You pinged a dead channel. No response.",
  "📼 Your life flashed back. It was just ads.",
  "📎 A cursed paperclip blocked your attempt.",
  "🍕 You bribed fate with pizza. It was pineapple.",
  "📡 The underworld blocked your signal.",
  "🕳️ You tried to manifest... and demanifested.",
  "🫧 You bubblewrapped your soul. Still popped.",
  "💸 You paid with exposure. Fate declined.",
  "🪙 You flipped a coin. Landed on betrayal."
];


const trialNames = [
  "Trial of the Screaming Mire",
  "The Eldritch Scramble",
  "Trial of the Shattered Bones",
  "The Maw's Hunger",
  "Dance of the Ugly Reflection",
  "Trial of the Crooked Path",
  "Storm of the Severed Sky",
  "Gauntlet of Broken Dreams",
  "The Echoing Crawl",
  "The Wretched Spiral"
];
// === INTERACTION HANDLER ===
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  // === Join Button Logic ===
  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    const alreadyJoined = gauntletEntrants.find(e => e.id === interaction.user.id);
    if (!alreadyJoined) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });

      try {
        await interaction.reply({ content: '✅ You have joined The Ugly Gauntlet!', ephemeral: true });
      } catch (err) {
        console.warn('⚠️ Could not reply to interaction (likely expired):', err.message);
      }

      if (gauntletMessage && gauntletMessage.editable) {
        const embed = EmbedBuilder.from(gauntletMessage.embeds[0])
          .setDescription(`Click to enter. 🧟 Entrants so far: ${gauntletEntrants.length}`);
        await gauntletMessage.edit({ embeds: [embed] });
      }
    } else {
      await interaction.reply({
        content: '⚠️ You have already joined this round!',
        ephemeral: true
      });
    }
  }

  // === Rematch Vote Button ===
  if (interaction.customId === 'rematch_gauntlet') {
    const userId = interaction.user.id;
    if (rematchClicksSet.has(userId)) {
      return interaction.reply({ content: '⛔ You already voted for a rematch.', ephemeral: true });
    }
    rematchClicksSet.add(userId);
    rematchClicks++;

    const neededClicks = Math.max(6, Math.ceil(lastGameEntrantCount * 0.75));

    await interaction.reply({ content: '🩸 Your vote has been cast.', ephemeral: true });

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rematch_gauntlet')
        .setLabel(`🔁 Rematch? (${rematchClicks}/${neededClicks})`)
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.message.edit({ components: [newRow] });

    if (rematchClicks >= neededClicks) {
      rematchesThisHour++;
      await interaction.channel.send(`🔁 The Gauntlet begins again — summoned by ${rematchClicks} brave souls!`);
      setTimeout(() => startGauntlet(interaction.channel, 3), 2000);
    }
  }
});
// === MESSAGE COMMAND HANDLER ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();

  // === REVIVE COMMAND ===
  if (content === '!revive') {
    const userId = message.author.id;
    const isAlive = remaining.find(p => p.id === userId);
    if (isAlive) return message.channel.send(`🧟 <@${userId}> You're already among the living.`);

    const wasEliminated = eliminatedPlayers.find(p => p.id === userId);
    if (!wasEliminated) return message.channel.send(`👻 <@${userId}> You haven’t been eliminated yet.`);

    if (wasEliminated.attemptedRevive) {
      return message.channel.send(`🔁 <@${userId}> already tried to cheat death. Fate isn’t amused.`);
    }

    wasEliminated.attemptedRevive = true;

    if (Math.random() < 0.25) {
      remaining.push(wasEliminated);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      return message.channel.send(`💫 <@${userId}> ${reviveMsg}`);
    } else {
      const failMsg = reviveFailLines[Math.floor(Math.random() * reviveFailLines.length)];
      return message.channel.send(`${failMsg} <@${userId}> remains dead.`);
    }
  }

  // === START GAUNTLET COMMAND ===
  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }

  if (content === '!gauntlet') {
    return startGauntlet(message.channel, 10);
  }

  if (content === '!startg' && gauntletActive) {
    clearTimeout(joinTimeout);
    return runGauntlet(message.channel);
  }

  // === TRIAL MODE ===
  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    isTrialMode = true;
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({
      id: `MockUser${i + 1}`,
      username: `MockPlayer${i + 1}`
    }));
    remaining = [...gauntletEntrants];
    eliminatedPlayers = [];
    gauntletActive = true;
    gauntletChannel = message.channel;
    await message.channel.send('🧪 Trial Mode Activated — 20 mock players have entered. Starting...');
    return runGauntlet(message.channel);
  }
});
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() !== '!leaderboard') return;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  try {
    const topWins = await db.query(`
      SELECT username, wins FROM player_stats
      WHERE year = $1 AND month = $2
      ORDER BY wins DESC LIMIT 3
    `, [thisYear, thisMonth]);

    const topRevives = await db.query(`
      SELECT username, revives FROM player_stats
      WHERE year = $1 AND month = $2
      ORDER BY revives DESC LIMIT 3
    `, [thisYear, thisMonth]);

    const topGames = await db.query(`
      SELECT username, games_played FROM player_stats
      WHERE year = $1 AND month = $2
      ORDER BY games_played DESC LIMIT 3
    `, [thisYear, thisMonth]);

    const allTimeWins = await db.query(`
      SELECT username, SUM(wins) as total_wins
      FROM player_stats
      GROUP BY username
      ORDER BY total_wins DESC
      LIMIT 3
    `);

    const monthlyChampions = await db.query(`
      SELECT username, year, month, category, value
      FROM monthly_champions
      ORDER BY year DESC, month DESC, category
      LIMIT 12
    `);

    const formatList = (rows, key, emoji) =>
      rows.rows.length
        ? rows.rows.map((r, i) => `${emoji.repeat(i + 1)} ${r.username} — ${r[key]}`).join('\n')
        : '_No data yet._';

    const embed = new EmbedBuilder()
      .setTitle("📊 Gauntlet Leaderboard")
      .addFields(
        { name: `🏆 Top Wins (${thisMonth}/${thisYear})`, value: formatList(topWins, 'wins', '🥇'), inline: false },
        { name: `💀 Top Revives`, value: formatList(topRevives, 'revives', '🧟'), inline: false },
        { name: `🎮 Most Games Played`, value: formatList(topGames, 'games_played', '🎯'), inline: false },
        { name: `📈 All-Time Legends`, value: formatList(allTimeWins, 'total_wins', '🔥'), inline: false },
        {
          name: `🗓️ Monthly Champions`,
          value: monthlyChampions.rows.length
            ? monthlyChampions.rows.map(r => `- ${r.username} (${r.year}/${r.month}) — **${r.category}**: ${r.value}`).join('\n')
            : '_No champions recorded yet._',
          inline: false
        }
      )
      .setColor(0x00bfff);

    await message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    await message.channel.send("⚠️ Failed to load leaderboard.");
  }
});

// === START GAUNTLET FUNCTION ===
async function startGauntlet(channel, delay) {
  if (gauntletActive) return;
  isTrialMode = false;

  gauntletEntrants = [];
  gauntletActive = true;
  eliminatedPlayers = [];
  remaining = [];
  activeBoons = {};
  activeCurses = {};
  roundImmunity = {};
  fateRolls = {};
  tauntTargets = {};
  dodgeAttempts = {};
  hideAttempts = {};
  mutationDefenseClicks = new Set();
  rematchClicks = 0;
  massReviveTriggered = false;
  rematchClicksSet = new Set();

  gauntletChannel = channel;
  currentDelay = delay;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Ugly Gauntlet')
      .setStyle(ButtonStyle.Primary)
  );

  gauntletMessage = await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🏁 The Ugly Gauntlet Has Begun!')
      .setDescription(`Click to enter. You have ${delay} minutes.\n🧟 Entrants so far: 0`)
      .setColor(0x6e40c9)
    ],
    components: [joinButton]
  });

  const totalMs = delay * 60 * 1000;
  joinTimeout = setTimeout(async () => {
    if (gauntletEntrants.length < 1) {
      await channel.send('Not enough entrants joined. Try again later.');
      gauntletActive = false;
    } else {
      await runGauntlet(channel);
    }
  }, totalMs);

  const intervalMs = totalMs / 3;
  const joinLink = gauntletMessage.url;

  setTimeout(() => {
    channel.send(`@everyone ⏳ **Time is ticking!** One third of the countdown has passed.\nClick the **Join the Gauntlet** button here: ${joinLink}`);
  }, intervalMs);

  setTimeout(() => {
    channel.send(`@everyone ⚠️ **Two thirds down!** Only **${Math.round(delay / 3)} minutes** left to join!\nSummon your courage and join: ${joinLink}`);
  }, intervalMs * 2);

  setTimeout(() => {
    channel.send(`@everyone 🕰️ **Final moments!** The Gauntlet begins **any second now...**\nLast chance to click the join button: ${joinLink}`);
  }, totalMs - 5000);
}
async function massRevivalEvent(channel) {
  const resurrectionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('resurrection_click')
      .setLabel('💀 Touch the Totem')
      .setStyle(ButtonStyle.Danger)
  );

  const prompt = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('☠️ The Totem of Lost Souls Appears...')
        .setDescription(
          'A twisted totem hums with malformed energy. Click below for a **chance** at resurrection.\n\n' +
          'Eliminated players: 60%\nNew players: 40%\n\n' +
          'You have **12 seconds**. Touch it... or stay forgotten.'
        )
        .setColor(0x910000)
    ],
    components: [resurrectionRow]
  });

  const collector = prompt.createMessageComponentCollector({ time: 12000 });
  const braveFools = new Set();

  collector.on('collect', async i => {
    if (remaining.find(p => p.id === i.user.id)) {
      return i.reply({ content: '🧟 You’re already alive. Back off the totem.', ephemeral: true });
    }

    braveFools.add(i.user.id);
    i.reply({ content: '💫 The totem accepts your touch...', ephemeral: true });
  });

  collector.on('end', async () => {
    await prompt.edit({ components: [] });

    if (braveFools.size === 0) {
      await channel.send('🪦 No souls were bold enough to risk the totem.');
      return;
    }

    const names = [...braveFools].map(id => `<@${id}>`).join('\n');
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏳ The Totem Judged Them...')
          .setDescription(`These brave fools reached for resurrection:\n\n${names}\n\nBut the Totem shows no mercy...`)
          .setColor(0xffcc00)
      ]
    });

    for (const count of ['3', '2', '1']) {
      await channel.send(`🕒 ${count}...`);
      await new Promise(r => setTimeout(r, 1000));
    }

    const revivedLines = [];
    const failedLines = [];

    for (const id of braveFools) {
      const wasEliminated = eliminatedPlayers.find(p => p.id === id);
      const odds = wasEliminated ? 0.6 : 0.4;
      const passed = Math.random() < odds;

      if (passed) {
        if (wasEliminated) {
          wasEliminated.revived = true;
          remaining.push(wasEliminated);
          eliminatedPlayers = eliminatedPlayers.filter(p => p.id !== id);
          revivedLines.push(`💀 <@${id}> **rose again from the ashes**.`);
        } else {
          const user = await client.users.fetch(id);
          const newPlayer = { id, username: user.username };
          remaining.push(newPlayer);
          gauntletEntrants.push(newPlayer);
          revivedLines.push(`🆕 <@${id}> **was pulled into The Gauntlet by the Totem’s will**.`);
        }
      } else {
        const failLine = wasEliminated
          ? `☠️ <@${id}> reached for life... and was denied.`
          : `🚫 <@${id}> was rejected — a new soul not worthy... yet.`;
        failedLines.push(failLine);
      }
    }

    if (revivedLines.length > 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('💥 The Totem Showed Mercy')
            .setDescription(revivedLines.join('\n'))
            .setColor(0x00cc66)
        ]
      });
    }

    if (failedLines.length > 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('💨 The Totem Ignored Their Pleas')
            .setDescription(failedLines.join('\n'))
            .setColor(0xbb0000)
        ]
      });
    }
  });
}
async function runGauntlet(channel) {
  gauntletActive = false;
  remaining = [...gauntletEntrants];
  let roundCounter = 1;
  let audienceVoteCount = 0;
  const maxVotesPerGame = Math.floor(Math.random() * 2) + 2;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let noEliminationRounds = 0; // 🧠 Softlock counter

  // === Boss Vote ===
  const bossCandidates = [...remaining].sort(() => 0.5 - Math.random()).slice(0, 5);

  const voteButtons = bossCandidates.map((p) =>
    new ButtonBuilder()
      .setCustomId(`boss_vote_${p.id}`)
      .setLabel(`Vote ${p.username}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const bossVoteRow = new ActionRowBuilder().addComponents(...voteButtons);
  const voteCounts = {};
  const alreadyVoted = new Set();

  const voteMsg = await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle("👑 Who Should Be the UGLY BOSS?")
      .setDescription("Vote for who you think should be this game's Ugly Boss.\nThe winner earns **double $CHARM** if they survive to the podium.\n\n🗳️ Voting ends in **15 seconds**. Choose wisely.")
      .setColor(0x9932cc)
    ],
    components: [bossVoteRow]
  });

  const voteCollector = voteMsg.createMessageComponentCollector({ time: 15000 });

  voteCollector.on('collect', async interaction => {
    if (alreadyVoted.has(interaction.user.id)) {
      return interaction.reply({ content: '❌ You already voted for the Ugly Boss.', ephemeral: true });
    }
    alreadyVoted.add(interaction.user.id);
    const selectedId = interaction.customId.replace('boss_vote_', '');
    voteCounts[selectedId] = (voteCounts[selectedId] || 0) + 1;
    await interaction.reply({ content: `✅ Your vote has been cast.`, ephemeral: true });
  });

  await new Promise(r => setTimeout(r, 15000));
  await voteMsg.edit({ components: [] });

  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  const topCandidates = Object.entries(voteCounts)
    .filter(([_, count]) => count === maxVotes)
    .map(([id]) => id);

  const bossId = topCandidates.length
    ? topCandidates[Math.floor(Math.random() * topCandidates.length)]
    : bossCandidates[Math.floor(Math.random() * bossCandidates.length)].id;

  const boss = remaining.find(p => p.id === bossId);

  await channel.send(`👹 A foul stench rises... <@${boss.id}> has been chosen as the **UGLY BOSS**! If they make it to the podium, they earn **double $CHARM**...`);

  while (remaining.length > 3) {
    // === 🔥 Trigger Mass Revival Event
    if (!massReviveTriggered && remaining.length <= Math.floor(gauntletEntrants.length / 2)) {
      massReviveTriggered = true;

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('💀 The Totem Has Awakened')
          .setDescription(`With only a handful of survivors clinging to life...\n\nThe **Totem of Lost Souls** emerges.\n\nEliminated players and wandering souls may now **touch the Totem**...\nfor a chance to return to the Gauntlet.`)
          .setColor(0x9932cc)]
      });
    }
      console.log(`[GAUNTLET] Mass Revival triggered with ${remaining.length} players`);
      await massRevivalEvent(channel);
      await new Promise(r => setTimeout(r, 3000));
    }

    // === 🧱 Softlock Prevention Check (moved to later below)
    const eliminations = Math.min(2, remaining.length - 3);
    const eliminated = [];
    roundImmunity = {};
    activeBoons = {};
    activeCurses = {};
    mutationDefenseClicks.clear();
    let roundEventFired = false;

    // === Mutation Round (10% chance)
    if (!roundEventFired && Math.random() < 0.1) {
      roundEventFired = true;

      const mutateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('resist_mutation')
          .setLabel('🧬 Resist Mutation')
          .setStyle(ButtonStyle.Danger)
      );

      const mutateMsg = await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle("🧬 Mutation Threat Detected!")
          .setDescription("Click below to resist mutation. If 3+ resist, it's suppressed.")
          .setColor(0xff4500)
        ],
        components: [mutateRow]
      });

      const mutateCollector = mutateMsg.createMessageComponentCollector({ time: 15000 });

      mutateCollector.on('collect', async interaction => {
        if (!remaining.find(p => p.id === interaction.user.id)) {
          return interaction.reply({ content: '🛑 Only live players may resist.', ephemeral: true });
        }
        mutationDefenseClicks.add(interaction.user.id);
        await interaction.reply({ content: '🧬 Your resistance is noted.', ephemeral: true });
      });

      await new Promise(r => setTimeout(r, 15000));
      await mutateMsg.edit({ components: [] });

      const suppressed = mutationDefenseClicks.size >= 3;
      await channel.send(suppressed
        ? '🧬 Enough resistance! The mutation has been suppressed.'
        : '💥 Not enough resistance. The mutation begins...');
    }

    // === Survival Trap (10% chance)
    if (!roundEventFired && Math.random() < 0.1) {
      roundEventFired = true;

      const survivalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('survival_click')
          .setLabel('🪢 Grab the Rope!')
          .setStyle(ButtonStyle.Success)
      );

      const trapMsg = await channel.send({
        content: '⏳ A trap is triggered! First 3 to grab the rope will survive this round.',
        components: [survivalRow]
      });

      const survivalCollector = trapMsg.createMessageComponentCollector({ time: 10000 });
      let saved = 0;
      const ropeGrabbers = [];

      survivalCollector.on('collect', async i => {
        if (saved < 3 && remaining.find(p => p.id === i.user.id)) {
          roundImmunity[i.user.id] = true;
          ropeGrabbers.push(`<@${i.user.id}>`);
          saved++;
          await i.reply({ content: '🛡️ You grabbed the rope and are protected!', ephemeral: true });
        } else {
          await i.reply({ content: '⛔ Too late — the rope has already saved 3!', ephemeral: true });
        }
      });

      await new Promise(r => setTimeout(r, 10000));
      await trapMsg.edit({ components: [] });

      if (ropeGrabbers.length > 0) {
        await channel.send({
          embeds: [new EmbedBuilder()
            .setTitle('🛡️ Rope Survivors')
            .setDescription(`${ropeGrabbers.join('\n')}\n\nThese players are **immune from elimination** this round.`)
            .setColor(0x00cc99)
          ]
        });
      } else {
        await channel.send('☠️ No one grabbed the rope in time. The Gauntlet shows no mercy.');
      }

      await channel.send('🪢 The rope vanishes into the mist... the trial resumes soon.');
      await new Promise(r => setTimeout(r, 5000));
    }

    // === Boons & Curses (15% chance)
    if (!roundEventFired && Math.random() < 0.15 && remaining.length > 2) {
      roundEventFired = true;

      const shuffled = [...remaining].sort(() => 0.5 - Math.random());
      const affectedPlayers = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);
      const fateLines = [];

      for (const player of affectedPlayers) {
        const fate = Math.random();
        if (fate < 0.5) {
          activeCurses[player.id] = true;
          fateLines.push(`👿 <@${player.id}> has been **cursed** by malformed forces.`);
        } else {
          activeBoons[player.id] = true;
          fateLines.push(`🕊️ <@${player.id}> has been **blessed** with strange protection.`);
        }
      }

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle("🔮 Twisted Fates Unfold...")
          .setDescription(fateLines.join('\n'))
          .setColor(0x6a0dad)
        ]
      });
    }
    let eliminatedThisRound = 0;
    while (eliminated.length < eliminations) {
      const unlucky = remaining[Math.floor(Math.random() * remaining.length)];
      if (roundImmunity[unlucky.id]) continue;

      // 2% chance of revival mid-round
      if (Math.random() < 0.02) {
        await channel.send(`💫 A ghostly surge spares <@${unlucky.id}> from certain doom...`);
        continue;
      }

      const tokenId = Math.floor(Math.random() * 530) + 1;
      const nftEmbed = new EmbedBuilder()
        .setTitle(`💀 The Gauntlet Claims Another`)
        .setDescription(`<@${unlucky.id}> has fallen.\n\nTheir Ugly lives on...`)
        .setImage(`https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`)
        .setColor(0x8b0000);

      await channel.send({ embeds: [nftEmbed] });

      eliminated.push(unlucky);
      remaining = remaining.filter(p => p.id !== unlucky.id);
      eliminatedThisRound++;
    }

    if (eliminatedThisRound === 0) {
      noEliminationRounds++;
    } else {
      noEliminationRounds = 0;
    }

    if (noEliminationRounds >= 4) {
      await channel.send('☠️ Four rounds without eliminations… the Gauntlet has grown bored and devours all.');
      remaining = [];
      break;
    

    roundCounter++;
    await new Promise(r => setTimeout(r, 10000));
  }

  // === Podium ===
  const winners = [...remaining];
  const positions = ['🥇', '🥈', '🥉'];

  for (let i = 0; i < winners.length; i++) {
    await channel.send(`${positions[i]} ${winners[i].username} has survived The Gauntlet!`);
    await recordWin(winners[i]);
    await sendCharmToUser(winners[i].id, i === 0 ? 150 : i === 1 ? 100 : 75, channel);
  }

  gauntletEntrants = [];
  gauntletActive = false;

  setTimeout(() => triggerRematchPrompt(channel), 3000);
}



    // === Audience Curse Vote (2–3 times per game)
    let cursedPlayerId = null;

    if (
      !roundEventFired &&
      audienceVoteCount < maxVotesPerGame &&
      remaining.length >= 3 &&
      roundCounter >= 3 &&
      Math.random() < 0.25
    ) {
      roundEventFired = true;
      audienceVoteCount++;

      const pollPlayers = remaining.slice(0, 3);
      const playerList = pollPlayers.map(p => `- <@${p.id}>`).join('\n');

      await channel.send('👁️ The malformed eyes of the crowd turn toward the players...');
      await new Promise(r => setTimeout(r, 4000));

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle(`👁️ Audience Vote #${audienceVoteCount}`)
          .setDescription(`Three players are up for a potential CURSE:\n\n${playerList}`)
          .setColor(0xff6666)
        ]
      });

      await channel.send(`🗣️ Discuss who to curse... you have **20 seconds**.`);
      await new Promise(r => setTimeout(r, 10000));
      await channel.send(`⏳ 10 seconds remaining...`);
      await new Promise(r => setTimeout(r, 10000));

      const voteRow = new ActionRowBuilder().addComponents(
        ...pollPlayers.map((p) =>
          new ButtonBuilder()
            .setCustomId(`vote_${p.id}`)
            .setLabel(`Curse ${p.username}`)
            .setStyle(ButtonStyle.Secondary)
        )
      );

      const voteMsg = await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('🗳️ Cast Your Curse')
          .setDescription('Click a button below to vote. The player with the most votes will be cursed.\nYou have **10 seconds**.')
          .setColor(0x880808)
        ],
        components: [voteRow]
      });

      const voteCounts = {};
      const voteCollector = voteMsg.createMessageComponentCollector({ time: 10000 });
      const alreadyVoted = new Set();

      voteCollector.on('collect', interaction => {
        if (alreadyVoted.has(interaction.user.id)) {
          return interaction.reply({ content: '🛑 You already voted.', ephemeral: true });
        }
        alreadyVoted.add(interaction.user.id);
        const targetId = interaction.customId.split('_')[1];
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        interaction.reply({ content: '✅ Your vote has been cast.', ephemeral: true });
      });

      await new Promise(r => setTimeout(r, 10000));

      const maxVotes = Math.max(...Object.values(voteCounts));
      const cursedIds = Object.entries(voteCounts)
        .filter(([_, count]) => count === maxVotes)
        .map(([id]) => id);
      cursedPlayerId = cursedIds[Math.floor(Math.random() * cursedIds.length)];

      if (cursedPlayerId) {
        activeCurses[cursedPlayerId] = true;
        await channel.send(`😨 The audience has spoken. <@${cursedPlayerId}> is **cursed**!`);
      } else {
        await channel.send(`👻 No votes were cast. The malformed crowd stays silent.`);
      }
    }

    // === Elimination Round
    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    let eliminationDescriptions = [];

    for (let i = 0; i < eliminations; i++) {
      let player;

      // Force curse elimination first
      if (i === 0 && cursedPlayerId) {
        player = remaining.find(p => p.id === cursedPlayerId);
        if (player) {
          remaining = remaining.filter(p => p.id !== cursedPlayerId);
        }
      }

      // Pick randomly if not cursed
      if (!player) {
        player = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      }

      // === Protection Checks
      if (roundImmunity[player.id]) {
        eliminationDescriptions.push(`🛡️ <@${player.id}> avoided elimination with quick reflexes!`);
        continue;
      }

      if (activeBoons[player.id]) {
        eliminationDescriptions.push(`✨ <@${player.id}> was protected by a boon and dodged elimination!`);
        continue;
      }

      if (activeCurses[player.id]) {
        eliminationDescriptions.push(`💀 <@${player.id}> succumbed to their curse!`);
      }

      if (player.id === boss.id && Math.random() < 0.5) {
        eliminationDescriptions.push(`🛑 <@${player.id}> is the Boss — and shrugged off the attack!`);
        remaining.push(player);
        continue;
      }

      eliminated.push(player);
      eliminatedPlayers.push(player);

      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      const style = Math.floor(Math.random() * 3);
      if (useSpecial) {
        if (style === 0) {
          eliminationDescriptions.push(`━━━━━━━━━━ 👁‍🗨 THE MALFORMED STRIKE 👁‍🗨 ━━━━━━━━━━\n❌ <@${player.id}> ${reason}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        } else if (style === 1) {
          eliminationDescriptions.push(`⚠️💀⚠️ SPECIAL FATE ⚠️💀⚠️\n❌ <@${player.id}> ${reason}\n🩸🧟‍♂️😈👁🔥👣🪦🧠👃`);
        } else {
          eliminationDescriptions.push(`**💥 Cursed Spotlight: <@${player.id}> 💥**\n_${reason}_`);
        }
      } else {
        eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);
      }
    }

    // 💫 Rare Resurrection (35% chance)
    if (eliminated.length && Math.random() < 0.35) {
      const reviveIndex = Math.floor(Math.random() * eliminated.length);
      const revived = eliminated.splice(reviveIndex, 1)[0];
      if (revived) {
        remaining.push(revived);
        const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
        eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
      }
    }

      // Force curse elimination first
      if (i === 0 && cursedPlayerId) {
        player = remaining.find(p => p.id === cursedPlayerId);
        if (player) {
          remaining = remaining.filter(p => p.id !== cursedPlayerId);
        }
      }

      // Pick randomly if not cursed
      if (!player) {
        player = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      }

      // === Protection Checks
      if (roundImmunity[player.id]) {
        eliminationDescriptions.push(`🛡️ <@${player.id}> avoided elimination with quick reflexes!`);
        continue;
      }

      if (activeBoons[player.id]) {
        eliminationDescriptions.push(`✨ <@${player.id}> was protected by a boon and dodged elimination!`);
        continue;
      }

      if (activeCurses[player.id]) {
        eliminationDescriptions.push(`💀 <@${player.id}> succumbed to their curse!`);
      }

      if (player.id === boss.id && Math.random() < 0.5) {
        eliminationDescriptions.push(`🛑 <@${player.id}> is the Boss — and shrugged off the attack!`);
        remaining.push(player);
        continue;
      }

      eliminated.push(player);
      eliminatedPlayers.push(player);

      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      const style = Math.floor(Math.random() * 3);
      if (useSpecial) {
        if (style === 0) {
          eliminationDescriptions.push(`━━━━━━━━━━ 👁‍🗨 THE MALFORMED STRIKE 👁‍🗨 ━━━━━━━━━━\n❌ <@${player.id}> ${reason}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        } else if (style === 1) {
          eliminationDescriptions.push(`⚠️💀⚠️ SPECIAL FATE ⚠️💀⚠️\n❌ <@${player.id}> ${reason}\n🩸🧟‍♂️😈👁🔥👣🪦🧠👃`);
        } else {
          eliminationDescriptions.push(`**💥 Cursed Spotlight: <@${player.id}> 💥**\n_${reason}_`);
        }
      } else {
        eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);
      }
    }

    // 💫 Rare Resurrection (35% chance)
    if (eliminated.length && Math.random() < 0.35) {
      const reviveIndex = Math.floor(Math.random() * eliminated.length);
      const revived = eliminated.splice(reviveIndex, 1)[0];
      if (revived) {
        remaining.push(revived);
        const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
        eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
      }
    }

    // 🎨 Embed with Random Ugly NFT
    const tokenId = Math.floor(Math.random() * 574) + 1;
    const nftImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;

    const totalPlayers = gauntletEntrants.length;
    const survivors = remaining.length;

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`⚔️ Round ${roundCounter} — ${trial}`)
        .setDescription([
          ...eliminationDescriptions,
          `\n👥 **Players Remaining:** ${survivors} / ${totalPlayers}`
        ].join('\n'))
        .setColor(0x8b0000)
        .setImage(nftImage)
      ]
    });

   // Track if anyone was eliminated this round
if (eliminated.length === 0) {
  noEliminationRounds++;
  console.log(`No eliminations this round. (${noEliminationRounds} in a row)`);

  if (noEliminationRounds >= 4) {
    await channel.send("⛔ The Gauntlet has stalled. Four rounds have passed with no eliminations. It fades into the void...No winners declared");
    return;
  }
} else {
  noEliminationRounds = 0; // Reset if someone was eliminated
}


    roundCounter++;
    await new Promise(r => setTimeout(r, 10000));
  }
  // 🏆 Finalists
  if (remaining.length < 3) {
    await channel.send('⚠️ Not enough players remain to crown a full podium. Ending game.');
    return;
  }

  const [first, second, third] = remaining;
  let firstReward = 50;
  let secondReward = 25;
  let thirdReward = 10;

  if (first.id === boss.id) firstReward *= 2;
  if (second.id === boss.id) secondReward *= 2;
  if (third.id === boss.id) thirdReward *= 2;

  await sendCharmToUser(first.id, firstReward, channel);
  await sendCharmToUser(second.id, secondReward, channel);
  await sendCharmToUser(third.id, thirdReward, channel);

  if ([first.id, second.id, third.id].includes(boss.id)) {
    await channel.send(`👑 The **Ugly Boss** <@${boss.id}> survived to the end. Their reward is **doubled**!`);
  }

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🏆 Champions of the Ugly Gauntlet!')
      .setDescription([
        `**1st Place:** <@${first.id}> — **${firstReward} $CHARM**`,
        `**2nd Place:** <@${second.id}> — **${secondReward} $CHARM**`,
        `**3rd Place:** <@${third.id}> — **${thirdReward} $CHARM**`,
        ``,
        `The Gauntlet has spoken. Well fought, Champions!`
      ].join('\n'))
      .setColor(0xdaa520)
    ]
  });

  await recordWin(first);
  await recordWin(second);
  await recordWin(third);

  await triggerRematchPrompt(channel);

  // 🎁 Rare Mint Incentive (every 50 games)
  completedGames++;
  if (completedGames >= 50) {
    completedGames = 0;

    const incentives = [
      {
        title: "⚡ First to Mint an Ugly gets 500 $CHARM!",
        desc: "⏳ You have **5 minutes**. Post proof in <#1334345680461762671>!"
      },
      {
        title: "🧵 First to Tweet their Ugly or Monster + tag @Charm_Ugly gets 100 $CHARM!",
        desc: "Drop proof in <#1334345680461762671> and the team will verify. GO!"
      },
      {
        title: "💥 Mint 3, Get 1 Free (must open ticket)",
        desc: "⏳ You have **15 minutes** to mint 3 — and we’ll airdrop 1 more. #UglyLuck"
      },
      {
        title: "👑 Mint 3, Get a FREE MONSTER",
        desc: "⏳ You have **15 minutes**. Prove it in a ticket and a Monster is yours."
      },
      {
        title: "🎁 All mints in the next 10 minutes earn +150 $CHARM",
        desc: "Yes, all. Go go go."
      },
      {
        title: "🃏 Every mint = 1 raffle entry",
        desc: "**Next prize:** 1,000 $CHARM! All mints from now to the next milestone are eligible."
      },
      {
        title: "📸 Lore Challenge Activated!",
        desc: "Post your Ugly in <#💬┆general-chat> with a 1-liner backstory. Best lore gets 250 $CHARM in 24h."
      },
      {
        title: "📦 SECRET BOUNTY ⚠️",
        desc: "One of the next 10 mints will receive... something special. We won't say what."
      }
    ];

    const selected = incentives[Math.floor(Math.random() * incentives.length)];
    const incentiveImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${Math.floor(Math.random() * 530) + 1}.jpg`;

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`🎉 RARE MINT INCENTIVE UNLOCKED!`)
        .setDescription(`**${selected.title}**\n\n${selected.desc}`)
        .setColor(0xffd700)
        .setImage(incentiveImage)
      ]
    });
  }
} // End of runGauntlet
async function triggerRematchPrompt(channel) {
  lastGameEntrantCount = gauntletEntrants.length;

  if (Date.now() - rematchLimitResetTime > 60 * 60 * 1000) {
    rematchesThisHour = 0;
    rematchLimitResetTime = Date.now();
  }

  if (rematchesThisHour >= 3) {
    await channel.send("🚫 Max of 3 rematches reached this hour. The Gauntlet rests... for now.");
    return;
  }

  rematchClicks = 0;
  const neededClicks = Math.ceil(lastGameEntrantCount * 0.75);
  const rematchVoters = new Set();

  const buildRematchButton = () =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rematch_gauntlet")
        .setLabel(`🔁 Rematch? (${rematchClicks}/${neededClicks})`)
        .setStyle(ButtonStyle.Primary)
    );

  const rematchEmbed = new EmbedBuilder()
    .setTitle("🔁 Call for Rematch?")
    .setDescription(`The blood is still warm...\nAt least **${neededClicks}** brave souls must rise in the next **60 seconds**.`)
    .setColor(0xff4c4c);

  const rematchMsg = await channel.send({
    embeds: [rematchEmbed],
    components: [buildRematchButton()]
  });

  const rematchCollector = rematchMsg.createMessageComponentCollector({ time: 60000 });

  rematchCollector.on("collect", async (interaction) => {
    if (rematchVoters.has(interaction.user.id)) {
      return interaction.reply({ content: "⛔ You've already voted.", ephemeral: true });
    }

    rematchVoters.add(interaction.user.id);
    rematchClicks++;
    await interaction.deferUpdate();

    const updatedEmbed = EmbedBuilder.from(rematchEmbed)
      .setDescription(`The blood is still warm...\n**${rematchClicks} / ${neededClicks}** have stepped forward...\nVote closes in **under 60 seconds**.`);

    await rematchMsg.edit({
      embeds: [updatedEmbed],
      components: [buildRematchButton()]
    });

    if (rematchClicks >= neededClicks) {
      rematchCollector.stop("passed");
    }
  });

  rematchCollector.on("end", async (_, reason) => {
    await rematchMsg.edit({
      components: []
    });

    if (reason === "passed") {
      rematchesThisHour++;
      await channel.send("🔥 The Gauntlet stirs once more! A new trial shall begin shortly...");
      setTimeout(() => startGauntlet(channel, 3), 2500); // Delay for drama
    } else {
      await channel.send("💤 Not enough stepped forward. The Gauntlet returns to slumber...");
    }
  });
}

// === Optional: Could add recordRevive() here if needed ===

// === Final: Bot Ready + Login ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN); // ✅ FINAL LINE
