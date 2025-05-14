require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

async function sendCharmToUser(discordUserId, amount) {
  const DRIP_API_TOKEN = process.env.DRIP_API_TOKEN;
  const DRIP_ACCOUNT_ID = '676d81ee502cd15c9c983d81';
  const CURRENCY_ID = '1047256251320520705';

  const headers = {
    Authorization: `Bearer ${DRIP_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const data = {
    recipient: {
      id: discordUserId,
      id_type: "discord_id"
    },
    amount: amount,
    reason: "Victory in The Gauntlet",
    currency_id: CURRENCY_ID,
    account_id: DRIP_ACCOUNT_ID
  };

  try {
    const response = await axios.post(`https://api.drip.re/v2/send`, data, { headers });
    console.log(`✅ Sent ${amount} $CHARM to ${discordUserId}`);
  } catch (error) {
    console.error(`❌ Error sending $CHARM to ${discordUserId}:`, {
      message: error.message,
      data: error.response?.data,
      status: error.response?.status
    });
  }
}

let gauntletEntrants = [];
let gauntletActive = false;
let joinTimeout = null;
let gauntletChannel = null;
let gauntletMessage = null;
let activeBoons = {};
let activeCurses = {};
let roundImmunity = {};
let fateRolls = {};
let mutationDefenseClicks = new Set();
let eliminatedPlayers = [];
let remaining = [];
const trialNames = [
  "Trial of the Screaming Mire", "The Eldritch Scramble", "Trial of the Shattered Bones",
  "The Maw's Hunger", "Dance of the Ugly Reflection", "Trial of the Crooked Path",
  "Storm of the Severed Sky", "Gauntlet of Broken Dreams", "The Echoing Crawl",
  "The Wretched Spiral"
];

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
  "was outed as a snitch by a talking tree stump.",
  "laughed at the wrong joke and got obliterated by cringe.",
  "tripped over an imaginary rock and fell into the void.",
  "asked too many questions and got ‘moderated’ permanently.",
  "accidentally summoned their own shadow. It won the duel.",
  "walked into a mirror and never came out.",
  "misspelled ‘Gauntlet’ and angered the elder code.",
  "took a selfie during the ritual. The flash was fatal.",
  "opened a cursed loot box and got nothing... including their soul.",
  "accepted a hug from a mimic in disguise.",
  "mistook a cursed portal for a snack machine.",
  "entered the wrong emote combo and exploded.",
  "got ratio’d by the spirits and faded into irrelevance.",
  "failed a basic charisma check and self-destructed.",
  "accidentally said 'GM' in lowercase.",
  "disrespected a cursed pebble and paid the price.",
  "caught a stray insult from the lorekeeper.",
  "used Comic Sans in their summon chant.",
  "sipped mystery juice and phased out of the timeline.",
  "chose the ‘mystery option’ and was never seen again.",
  "got banned by the council of malformed ethics.",
  "told the swamp it smelled funny. It responded.",
  "lost a staring contest with a cursed toad.",
  "rolled a nat 1 on existing.",
  "clicked the red button labeled ‘Do Not Click’.",
  "tried to flex in a funhouse mirror and broke reality.",
  "attempted to cheat death. Death took it personally.",
  "was lured by a whisper that sounded like free Wi-Fi.",
  "told the Gauntlet it was 'just a game' — oops.",
  "got memed into another dimension.",
  "got lost trying to find the rules page.",
  "forgot the safe word during a summoning.",
  "mislabeled an artifact as ‘mid’. The artifact retaliated."
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
  "was outed as an undercover Handsome and disqualified."
];
const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "emerged from the swamp, covered in mud and vengeance.",
  "refused to die and bribed fate with $CHARM.",
  "sacrificed a toe and was reborn in pixelated agony.",
  "got patched in a hotfix and returned.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "was pulled back by the chants of the community.",
  "glitched through the floor, then glitched back.",
  "got spit out by a mimic. Again.",
  "won a staring contest with a void spirit.",
  "bit a curse in half and screamed themselves awake.",
  "slapped a demon and respawned out of spite.",
  "rummaged through their own grave and found a reroll token.",
  "was rejected by the afterlife due to poor posture.",
  "ate a cursed berry. It worked. Kind of.",
  "screamed so loud the timeline flinched.",
  "burned their death certificate in a candle made of shame.",
  "sneezed in the wrong realm and got bounced back.",
  "glitched into a tutorial level and found the backdoor.",
  "woke up in a cold sweat and decided it was all a dream.",
  "swam through the River of Regret and came out dry.",
  "hacked the leaderboard and gave themselves a second life.",
  "bribed the shadow judge with a half-eaten chicken nugget.",
  "found a continue screen hidden in the clouds.",
  "convinced death to take a lunch break.",
  "got revived by a lonely necromancer for company.",
  "discovered an ancient scroll marked ‘Just Kidding’.",
  "fell upward and landed in the present.",
  "bought a ‘Return from Death’ DLC and installed it mid-game.",
  "played a revival song on a bone flute they found in their ribcage.",
  "left their respawn settings on ‘Always’."
];

const playerCommands = {}; // Tracks who has used a command
const tauntTargets = {};   // Stores taunt targets
const dodgeAttempts = {};  // Tracks dodge attempts
const hideAttempts = {};   // Stores hide attempts

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    if (!gauntletEntrants.find(e => e.id === interaction.user.id)) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });
      await interaction.reply({ content: 'You have joined the Ugly Gauntlet! Prepare yourself…', flags: 64 });

      if (gauntletMessage && gauntletMessage.editable) {
        const embed = gauntletMessage.embeds[0];
        const updatedEmbed = {
          ...embed.data,
          description: embed.description.replace(/🧟 Entrants so far: \d+/, `🧟 Entrants so far: ${gauntletEntrants.length}`)
        };
        await gauntletMessage.edit({ embeds: [updatedEmbed] });
      }
    } else {
      await interaction.reply({ content: 'You have already joined this round!', flags: 64 });
    }
  }
});
async function startGauntlet(channel, delay) {
  // your existing logic
}
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const userId = message.author.id;

  // Start Gauntlet command
 client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const command = content.toLowerCase();

  if (command === '!gauntlet') {
    return startGauntlet(message.channel, 10);
  }

  if (command.startsWith('!gauntlet ')) {
    const delay = parseInt(command.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }

  // ... rest of your logic
});


  // Force start
  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
    return;
  }

  // Trial mode
  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
    gauntletActive = true;
    eliminatedPlayers = [];
    gauntletChannel = message.channel;
    await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
    await new Promise(r => setTimeout(r, 1000));
    runGauntlet(message.channel);
    return;
  }

  // Test reward
  if (content === '!testreward') {
    const allowedUsers = ['your_discord_id_here']; // Replace with your user ID
    if (!allowedUsers.includes(userId)) {
      return message.reply("⛔ You are not authorized to use this test command.");
    }
    const testAmount = 5;
    await sendCharmToUser(userId, testAmount);
    await message.channel.send(`🧪 Sending ${testAmount} $CHARM to <@${userId}>...`);
    return;
  }
  // Don't allow commands if Gauntlet isn't active
  if (!gauntletActive) return;

  // Revive command
  if (content === '!revive') {
    const alreadyAlive = remaining.find(p => p.id === userId);
    if (alreadyAlive) return message.channel.send(`🧟 <@${userId}> You're already among the living. Go cause some chaos.`);

    const wasEliminated = eliminatedPlayers.find(p => p.id === userId);
    if (!wasEliminated) return message.channel.send(`👻 <@${userId}> You haven’t even been eliminated yet. Chill.`);

    if (wasEliminated.attemptedRevive) {
      return message.channel.send(`🔁 <@${userId}> already tried to cheat death. The malformed forces laugh at your desperation.`);
    }

    wasEliminated.attemptedRevive = true;

    if (Math.random() < 0.02) {
      remaining.push(wasEliminated);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      return message.channel.send(`💫 <@${userId}> defied all odds!\n${reviveMsg}`);
    } else {
      const failMsgs = [
        "🪦 You wiggle in the dirt… but you're still dead.",
        "😵 You whispered to the void. It blocked you.",
        "👁️ The malformed forces laughed and turned away.",
        "🔮 Your bones creaked… then cracked. Nope.",
        "☠️ You reached out… and got ghosted."
      ];
      const failMsg = failMsgs[Math.floor(Math.random() * failMsgs.length)];
      return message.channel.send(`${failMsg} <@${userId}> remains very, very dead.`);
    }
  }
  // One-time interaction commands
  if (playerCommands[userId]) {
    return message.reply("🛑 You’ve already used your command for this Gauntlet.");
  }

  if (content === '!dodge') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      dodgeAttempts[userId] = true;
      message.reply("🌀 You prepare to dodge fate...");
    } else {
      message.reply("😬 You braced... but nothing happened.");
    }
  }

  if (content === '!taunt') {
    playerCommands[userId] = true;
    const alive = gauntletEntrants.filter(p => p.id !== userId);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      tauntTargets[target.id] = true;
      message.reply(`🔥 You mocked your enemies... and now **<@${target.id}>** is marked!`);
    }
  }

  if (content === '!hide') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      hideAttempts[userId] = true;
      message.reply("👻 You vanish into the shadows...");
    } else {
      message.reply("😶 You tried to hide, but the shadows rejected you.");
    }
  }

});
// Finalize game and login
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
