require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
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
let roundCounter = 1;

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
  "laughed at the wrong joke and got obliterated by cringe.",
  "asked too many questions and got ‘moderated’ permanently.",
  "got ratio’d by the spirits and faded into irrelevance.",
  "told the Gauntlet it was 'just a game' — oops.",
  "opened a cursed loot box and got nothing... including their soul.",
  "forgot the safe word during a summoning.",
  "got banned by the council of malformed ethics.",
  "rolled a nat 1 on existing.",
  "clicked the red button labeled ‘Do Not Click’.",
  "got lost trying to find the rules page."
];
const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "rolled a 1 and summoned their ex instead.",
  "flexed too hard and imploded with style.",
  "said ‘GM’ too late and was banished to Shadow Realm.",
  "was cursed by a malformed meme and vaporized in shame.",
  "used Comic Sans in a summoning circle.",
  "forgot to use dark mode and burned alive.",
  "glitched into another chain. Nobody followed.",
  "was outed as an undercover Handsome and disqualified.",
  "spoke Latin backwards and collapsed into soup."
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
  "bit a curse in half and screamed themselves awake.",
  "burned their death certificate in a candle made of shame.",
  "screamed so loud the timeline flinched.",
  "slapped a demon and respawned out of spite.",
  "left their respawn settings on ‘Always’."
];

const playerCommands = {};
const tauntTargets = {};
const dodgeAttempts = {};
const hideAttempts = {};
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
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();
  const userId = message.author.id;

  if (content === '!testreward') {
    const allowedUsers = ['your_discord_id_here']; // Replace with your actual Discord ID
    if (!allowedUsers.includes(userId)) {
      return message.reply("⛔ You are not authorized to use this test command.");
    }

    const testAmount = 5;
    await sendCharmToUser(userId, testAmount);
    return message.channel.send(`🧪 Sent ${testAmount} $CHARM to <@${userId}>`);
  }

  // GAUNTLET LAUNCH COMMANDS
  if (content === '!gauntlet') return startGauntlet(message.channel, 10);
  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }

  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
    return;
  }

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
});
// Additional message listener for in-game commands
client.on('messageCreate', async (message) => {
  if (message.author.bot || !gauntletActive) return;

  const userId = message.author.id;
  const command = message.content.toLowerCase().trim();

  // !REVIVE Command
  if (command === '!revive') {
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

  // Interactive Commands (one-time use per round)
  if (playerCommands[userId]) {
    return message.reply("🛑 You’ve already used your command for this Gauntlet.");
  }

  if (command === '!dodge') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      dodgeAttempts[userId] = true;
      message.reply("🌀 You prepare to dodge fate...");
    } else {
      message.reply("😬 You braced... but nothing happened.");
    }
  }

  if (command === '!taunt') {
    playerCommands[userId] = true;
    const alive = gauntletEntrants.filter(p => p.id !== userId);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      tauntTargets[target.id] = true;
      message.reply(`🔥 You mocked your enemies... and now **<@${target.id}>** is marked!`);
    }
  }

  if (command === '!hide') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      hideAttempts[userId] = true;
      message.reply("👻 You vanish into the shadows...");
    } else {
      message.reply("😶 You tried to hide, but the shadows rejected you.");
    }
  }
});
// Test reward command (for bot dev/owner only)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const command = message.content.toLowerCase().trim();

  if (command === '!testreward') {
    const allowedUsers = ['YOUR_DISCORD_ID_HERE']; // Replace with your Discord ID
    if (!allowedUsers.includes(userId)) {
      return message.reply("⛔ You are not authorized to use this test command.");
    }

    const testAmount = 5;
    await sendCharmToUser(userId, testAmount);
    return message.channel.send(`🧪 Sent ${testAmount} $CHARM to <@${userId}> for testing.`);
  }
});

// Bot ready message
client.once('ready', () => {
  console.log(`✅ The Gauntlet bot is online as ${client.user.tag}`);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);
