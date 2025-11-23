// index.js — Entry Point for The Gauntlet (Solo + Group)

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const { TOKEN } = require("./src/utils");
const { initStore } = require("./src/db");

// Solo (ephemeral) Gauntlet
const {
  registerCommands: registerSoloCommands,
  handleInteractionCreate: handleSoloInteractionCreate,
} = require("./src/soloGauntlet");

// Group (classic) Gauntlet
let registerGroupCommands = async () => {};
let handleGroupInteractionCreate = async () => {};

try {
  const groupModule = require("./src/groupGauntlet");

  if (typeof groupModule.registerGroupCommands === "function") {
    registerGroupCommands = groupModule.registerGroupCommands;
  }
  if (typeof groupModule.handleGroupInteractionCreate === "function") {
    handleGroupInteractionCreate = groupModule.handleGroupInteractionCreate;
  }
} catch (err) {
  console.error("[GAUNTLET] Failed to load groupGauntlet.js:", err);
}

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

  try {
    await registerSoloCommands();
    await registerGroupCommands();
    console.log("✅ Slash commands registered (solo + group).");
  } catch (err) {
    console.error("❌ Error registering commands:", err);
  }
});

// --------------------------------------------
// INTERACTION HANDLER
// --------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleSoloInteractionCreate(interaction);
    await handleGroupInteractionCreate(interaction);
  } catch (err) {
    console.error("interaction error (root):", err);
  }
});

// --------------------------------------------
// LOGIN
// --------------------------------------------
client.login(TOKEN);

