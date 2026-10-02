const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

// Exercise the real interaction router and Discord builders without Discord/DB side effects.
const sourcePath = path.join(__dirname, "../src/soloGauntlet.js");
const localRequire = createRequire(sourcePath);
let saved = { type: "team_start", pool_increment: 77, ping_role_ids: ["123456789012345678"] };
let persistedLobby;
let failSave = false;
let failRead = false;
let running = false;
let gameSettings;
const publicMessages = [];
const timers = [];
const channel = {
  id: "channel", guildId: "guild",
  async send(payload) {
    publicMessages.push(payload);
    return { id: `message-${publicMessages.length}`, channel, async edit() {} };
  },
};
const Store = {
  async getSurvivalSettings() { if (failRead) throw Error("read failed"); return saved; },
  async upsertSurvivalSettings(value) {
    if (failSave) throw Error("save failed");
    saved = JSON.parse(JSON.stringify(value));
  },
  async upsertSurvivalLobby(value) { persistedLobby = JSON.parse(JSON.stringify(value)); },
  async clearSurvivalLobby() {},
};
function loadController() {
  const context = {
    module: { exports: {} }, console: { log() {}, error() {} },
    setTimeout(fn, delay) { timers.push({ fn, delay }); return { unref() {} }; },
    setInterval() { return 1; }, clearTimeout() {}, clearInterval() {},
    require(name) {
      if (["discord.js", "./survivalEras", "./uglyFortune"].includes(name)) return localRequire(name);
      if (name === "./db") return { Store };
      if (name === "./utils") return { AUTHORIZED_ADMINS: [] };
      if (name === "./survival") return {
        hasActiveSurvivalRun: () => running,
        async runSurvival(c, players, settings) { gameSettings = settings; },
      };
      if (name === "./squigTraitSnapshot") return { async snapshotSurvivalSquigTraits() { return {}; } };
      return {};
    },
  };
  vm.runInNewContext(fs.readFileSync(sourcePath, "utf8") + `
    module.exports.test = {
      lobby: () => survivalLobby,
      defaults: () => survivalStandardSettings,
      clearSurvivalLobby,
      buildSurvivalSettingsComponents,
      normalizeSurvivalSettings,
    };`, context, { filename: sourcePath });
  return context.module.exports;
}
function interaction(kind, id, admin = true) {
  const responses = [];
  return {
    customId: id, commandName: id, user: { id: "admin" }, guildId: "guild",
    channelId: channel.id, channel, client: { channels: { cache: new Map([[channel.id, channel]]) } },
    member: { permissions: { has: () => admin } }, responses,
    inGuild: () => true, isRepliable: () => true,
    isAutocomplete: () => false,
    isChatInputCommand: () => kind === "command",
    isButton: () => kind === "button",
    isModalSubmit: () => kind === "modal",
    isRoleSelectMenu: () => kind === "role",
    async deferReply(payload) { this.deferred = true; responses.push(payload); },
    async deferUpdate() { this.deferred = true; },
    async reply(payload) { this.replied = true; responses.push(payload); },
    async update(payload) { responses.push(payload); },
    async editReply(payload) { responses.push(payload); },
    async followUp(payload) { responses.push(payload); },
    async showModal(payload) { responses.push(payload); },
  };
}
async function main() {
  const controller = loadController();
  const route = controller.handleInteractionCreate;
  const state = controller.test;
  const command = interaction("command", "survive");
  await route(command);
  assert.equal(command.responses[0].flags, 64);
  assert.deepEqual(command.responses[1].components[0].toJSON().components.map(b => b.label),
    ["Start Lobby", "Start Game", "Settings"]);
  assert.equal(publicMessages.length, 0);
  for (const [kind, id] of [["command", "survive"], ["button", "survive:menu:start-lobby"],
    ["button", "survive:menu:start-game"], ["button", "survive:menu:settings"],
    ["button", "survive:config:save"], ["modal", "survive:modal:pool"],
    ["role", "survive:config:ping-roles:select"], ["command", "survivestart"]]) {
    const denied = interaction(kind, id, false);
    await route(denied);
    assert.equal(denied.responses[0].flags, 64);
    assert.match(denied.responses[0].content, /Only admins/);
  }
  await Promise.all([route(interaction("button", "survive:menu:start-lobby")),
    route(interaction("button", "survive:menu:start-lobby"))]);
  assert.equal(publicMessages.length, 2, "only one lobby and announcement");
  assert.equal(state.lobby().settings.pool_increment, 77);
  assert.equal(persistedLobby.settings.pool_increment, 77);
  assert.deepEqual(publicMessages[0].components[0].toJSON().components.map(b => b.label),
    ["Join", "Leave", "Players Joined", "My Stats", "Info"]);
  const settingsPanel = interaction("button", "survive:menu:settings");
  await route(settingsPanel);
  const description = settingsPanel.responses[0].embeds[0].toJSON().description;
  for (const label of ["Type:", "Ping Roles:", "Pool Per Player:", "Time:", "Creator Chaos:",
    "Revives:", "Bonus:", "Bonus Req'd:", "Bonus Multiplier:", "Bonus Prize:", "Replay:"])
    assert.ok(description.includes(label), label);
  for (const selectingPingRoles of [false, true]) {
    const rows = state.buildSurvivalSettingsComponents("standard", state.normalizeSurvivalSettings(saved), { selectingPingRoles });
    assert.ok(rows.length <= 5);
    rows.forEach(row => assert.ok(row.toJSON().components.length <= 5));
  }
  const poolModal = interaction("modal", "survive:modal:pool");
  poolModal.fields = { getTextInputValue: () => "99" };
  await route(poolModal);
  const prizeModal = interaction("modal", "survive:modal:bonus-prize");
  prizeModal.fields = { getTextInputValue: () => "https://example.com/prize" };
  await route(prizeModal);
  await route(interaction("button", "survive:config:save"));
  assert.equal(saved.pool_increment, 99);
  assert.equal(saved.bonus_prize, "https://example.com/prize");
  assert.equal(state.lobby().settings.pool_increment, 77, "active snapshot unchanged");
  assert.equal(state.lobby().settings.bonus_prize, null);
  saved.ping_role_ids.push("987654321012345678");
  assert.equal(state.lobby().settings.ping_role_ids.length, 1, "role arrays isolated");
  state.lobby().joined.add("player");
  await route(interaction("button", "survive:menu:start-game"));
  assert.equal(gameSettings.pool_increment, 77, "game uses original snapshot");
  assert.equal(state.lobby(), null);
  const restarted = loadController();
  await restarted.handleInteractionCreate(interaction("button", "survive:menu:start-lobby"));
  assert.equal(restarted.test.lobby().settings.pool_increment, 99, "fresh controller loads DB defaults");
  restarted.test.clearSurvivalLobby();
  await route(interaction("button", "survive:menu:settings"));
  failSave = true;
  const failedSave = interaction("button", "survive:config:save");
  const cached = state.defaults();
  await route(failedSave);
  assert.equal(state.defaults(), cached, "failed writes cannot update cached defaults");
  assert.match(failedSave.responses[0].content, /Something went wrong/);
  failSave = false;
  const count = publicMessages.length;
  running = true;
  await route(interaction("button", "survive:menu:start-lobby"));
  assert.equal(publicMessages.length, count, "running game blocks lobby creation");
  running = false;
  failRead = true;
  await route(interaction("button", "survive:menu:start-lobby"));
  assert.equal(publicMessages.length, count, "DB errors must not silently use fallback defaults");
  failRead = false;
  saved.type = "timed";
  saved.time_minutes = 12;
  await route(interaction("button", "survive:menu:start-lobby"));
  assert.ok(state.lobby().countdown_end > Date.now());
  assert.ok(timers.length > 0, "existing countdown is scheduled");
  state.clearSurvivalLobby();
  console.log("Survival control center checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
