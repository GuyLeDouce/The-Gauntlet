// index.js - Entry Point for The Gauntlet (Solo + Group)

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const { TOKEN } = require("./src/utils");
const { initStore } = require("./src/db");

// Unified Gauntlet (solo + group commands & routing)
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
    GatewayIntentBits.GuildMessageReactions, // needed for joins
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction, // helps with reactions on cached messages
  ],
});

// --------------------------------------------
// BOOT SEQUENCE
// --------------------------------------------
client.once(Events.ClientReady, async () => {
  console.log(`? Logged in as ${client.user.tag}`);

  await initStore();

  try {
    // This now registers BOTH solo + group commands in one shot
    await registerCommands();
    console.log("? Slash commands registered (solo + group)." );
  } catch (err) {
    console.error("? Error registering commands:", err);
  }
});

// --------------------------------------------
// INTERACTION HANDLER
// --------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // soloGauntlet's handler internally routes:
    // - /gauntlet, /gauntletlb, /gauntletrecent, /gauntletinfo, /mygauntlet
    // - /groupgauntlet ? handleGroupInteractionCreate (from groupGauntlet)
    await handleInteractionCreate(interaction);
  } catch (err) {
    console.error("interaction error (root):", err);
  }
});

// --------------------------------------------
// LOGIN
// --------------------------------------------
client.login(TOKEN);

