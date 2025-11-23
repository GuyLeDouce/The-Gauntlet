// index.js — Unified Entry Point for Solo + Group Gauntlet

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

// ------------ ENV + MODULES ----------------
const { TOKEN } = require("./src/utils");
const { initStore } = require("./src/db");

// SOLO GAUNTLET
const {
  registerCommands: registerSoloCommands,
  handleInteractionCreate: handleSoloInteraction,
} = require("./src/soloGauntlet");

// GROUP GAUNTLET
const {
  registerCommands: registerGroupCommands,
  handleInteractionCreate: handleGroupInteraction,
} = require("./src/groupGauntlet");

// ------------ CREATE CLIENT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ------------ BOOT SEQUENCE ----------------
client.once(Events.ClientReady, async () => {
  console.log(`⚡ Logged in as ${client.user.tag}`);

  // Initialize DB
  await initStore();

  // REGISTER ALL COMMANDS
  await registerSoloCommands(client);
  await registerGroupCommands(client);

  console.log("✅ All commands registered (Solo + Group).");
});

// ------------ INTERACTION ROUTER ------------
// We allow BOTH systems to listen to the same events.
// soloGauntlet handles its own IDs.
// groupGauntlet handles its own IDs.
// They will not overlap because IDs are unique.
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Group Gauntlet gets first crack (slash commands)
    const handledGroup = await handleGroupInteraction(interaction);
    if (handledGroup) return;

    // Solo Gauntlet (slash + buttons)
    const handledSolo = await handleSoloInteraction(interaction);
    if (handledSolo) return;

  } catch (err) {
    console.error("❌ Interaction handler error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: "⚠️ Something went wrong.",
          ephemeral: true,
        });
      } catch {}
    }
  }
});

// ------------ LOGIN ----------------
client.login(TOKEN);
