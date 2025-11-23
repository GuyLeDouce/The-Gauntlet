// index.js — Clean Entry Point for The Gauntlet (Modular Version)

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const { TOKEN } = require("./src/utils");
const { initStore } = require("./src/db");
const {
  registerCommands,
  handleInteractionCreate,
} = require("./src/soloGauntlet");

// --------------------------------------------
// CREATE CLIENT
// --------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// --------------------------------------------
// BOOT SEQUENCE
// --------------------------------------------
client.once(Events.ClientReady, async () => {
  console.log(`⚡ Logged in as ${client.user.tag}`);
  await initStore();
  await registerCommands(client);
});

// --------------------------------------------
// INTERACTION HANDLER
// --------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  await handleInteractionCreate(interaction);
});

// --------------------------------------------
// LOGIN
// --------------------------------------------
client.login(TOKEN);

