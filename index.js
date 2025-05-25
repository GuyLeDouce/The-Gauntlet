require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require('discord.js');
const axios = require('axios');

// === CLIENT SETUP ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
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

// === IMPORT ARRAYS ===
const {
  trialNames,
  eliminationEvents,
  specialEliminations,
  revivalEvents,
  reviveFailLines
} = require('./gauntletData.js');

// === IMPORT FUNCTIONS ===
const {
  handleInteraction,
  massRevivalEvent,
  startGauntlet,
  runGauntlet,
  triggerRematchPrompt,
  sendCharmToUser
} = require('./gauntletLogic.js');

// === EVENT LISTENERS ===
client.on(Events.InteractionCreate, handleInteraction(client));

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const userId = message.author.id;

  if (content === '!revive') {
    const isAlive = remaining.find(p => p.id === userId);
    if (isAlive) return message.channel.send(`🧟 <@${userId}> You're already among the living.`);
    const wasEliminated = eliminatedPlayers.find(p => p.id === userId);
    if (!wasEliminated) return message.channel.send(`👻 <@${userId}> You haven’t been eliminated yet.`);
    if (wasEliminated.attemptedRevive) return message.channel.send(`🔁 <@${userId}> already tried to cheat death.`);
    wasEliminated.attemptedRevive = true;

    if (Math.random() < 0.01) {
      remaining.push(wasEliminated);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      return message.channel.send(`💫 <@${userId}> ${reviveMsg}`);
    } else {
      const failMsg = reviveFailLines[Math.floor(Math.random() * reviveFailLines.length)];
      return message.channel.send(`${failMsg} <@${userId}> remains dead.`);
    }
  }

  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    return startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }

  if (content === '!gauntlet') return startGauntlet(message.channel, 10);

  if (content === '!startg' && gauntletActive) {
    clearTimeout(joinTimeout);
    return runGauntlet(message.channel);
  }

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

// === ON READY ===
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === LOGIN ===
client.login(process.env.DISCORD_TOKEN);
