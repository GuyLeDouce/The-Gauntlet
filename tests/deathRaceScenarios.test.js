"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { SCENARIOS, createRaceNarrativeState, renderScenario, buildRaceRoundNarrative } = require("../src/deathRaceScenarios");
const { MILESTONES } = require("../src/deathRaceNarrative");

function round(typeIndex, removedIds = ["Victim A", "Victim B"], aliveIds = ["Living Racer"]) {
  let first = true;
  return buildRaceRoundNarrative({ removedIds, aliveIds, nameOf: id => id, stage: MILESTONES[0],
    state: createRaceNarrativeState(), randomInt: max => {
      const value = first ? typeIndex : 0;
      first = false;
      assert.ok(value < max);
      return value;
    },
  });
}

test("every scenario template resolves all roles and strikes only its victims", () => {
  for (const [type, definition] of Object.entries(SCENARIOS)) {
    const stories = definition.stories || MILESTONES.slice(0, 59).map(m => m.story);
    for (const story of stories) {
      const names = ["Driver A", "Driver B", "Driver C"];
      const rendered = renderScenario(type, story, names);
      assert.doesNotMatch(rendered, /<player/);
      for (const slot of definition.deadSlots) assert.ok(rendered.includes(`~~${names[slot - 1]}~~`));
      for (let slot = 1; slot <= 3; slot++) {
        if (!definition.deadSlots.includes(slot)) assert.ok(!rendered.includes(`~~${names[slot - 1]}~~`));
      }
    }
  }
});

test("all five types account for exactly two victims in a three-racer Final Lap", () => {
  Object.keys(SCENARIOS).forEach((type, index) => {
    const result = round(index);
    assert.equal(result.type, type);
    assert.equal(result.finalLap, true);
    assert.ok(result.story.includes("~~Victim A~~"));
    assert.ok(result.story.includes("~~Victim B~~"));
    assert.ok(!result.story.includes("~~Living Racer~~"));
    assert.match(result.events.at(-1), /Living Racer.*crosses the finish line/);
    assert.equal(result.events.length, ["solo", "kills", "killedBy"].includes(type) ? 3 : 2);
    assert.doesNotMatch(result.story, /<player|<winner>/);
  });
});

test("two-racer finales use only one-victim scenarios and keep the winner alive", () => {
  for (let index = 0; index < 3; index++) {
    const result = round(index, ["Victim A"], ["Living Racer"]);
    assert.equal(result.finalLap, true);
    assert.ok(result.story.includes("~~Victim A~~"));
    assert.ok(!result.story.includes("Victim B"));
    assert.ok(!result.story.includes("~~Living Racer~~"));
  }
});

test("scenario and story bags rotate without immediate pool reuse", () => {
  const state = createRaceNarrativeState();
  const types = [];
  for (let i = 0; i < 5; i++) {
    types.push(buildRaceRoundNarrative({ removedIds: ["A", "B"], aliveIds: ["C", "D"],
      nameOf: id => id, stage: MILESTONES[i], state, randomInt: () => 0 }).type);
  }
  assert.deepEqual(types, Object.keys(SCENARIOS));
  const solo = round(0, ["A", "B"], ["C", "D"]);
  assert.equal(solo.events.length, 2);
  assert.notEqual(solo.events[0].replaceAll("A", "B"), solo.events[1]);
});

test("Discord names are escaped and invalid/dead killer identities are rejected", () => {
  const result = round(4, ["@everyone_*", "Other"], ["@here_~"]);
  assert.ok(result.story.includes("@\u200beveryone\\_\\*"));
  assert.ok(result.story.includes("@\u200bhere\\_\\~"));
  for (const [removedIds, aliveIds] of [[["A"], ["A"]], [["A", "A"], ["B"]], [["A"], []]]) {
    assert.throws(() => round(0, removedIds, aliveIds), /distinct victims/);
  }
});

// Execute the real Squigwreck loop with offline Discord/DB/timing substitutes.
// This catches wiring errors that a separate player-count simulation would miss.
async function runRace(count, reviveOnce = false) {
  const source = fs.readFileSync(require.resolve("../src/survival"), "utf8");
  const start = source.indexOf('  if (normalizedSettings.era_key === "squigwreck") {\n    // The normal lobby');
  const end = source.indexOf('  } else if (isChapterStoryEra(eraDefinition))', start);
  assert.ok(start >= 0 && end > start);
  const messages = [], deaths = [];
  class Builder {
    setTitle(title) { this.title = title; return this; }
    setDescription(description) { this.description = description; return this; }
    setColor() { return this; } setFooter() { return this; }
    addComponents() { return this; } setCustomId() { return this; }
    setLabel() { return this; } setStyle() { return this; }
  }
  let revived = false;
  const context = {
    normalizedSettings: { era_key: "squigwreck", revives_enabled: reviveOnce },
    alive: Array.from({ length: count }, (_, i) => `Racer-${i}`), eliminated: [],
    activeSurvivalRuns: new Map(), channel: { id: "test", async send(payload) { messages.push({ ...payload, protected: true }); } },
    activeRunState: { stageImagePool: [] }, eraDefinition: {}, gameId: "test", runKey: "test", uniquePlayers: [],
    squigwreckPresentation: { roundsCompleted: 0 },
    SQUIGWRECK_MILESTONES: MILESTONES, createRaceNarrativeState, buildRaceRoundNarrative,
    nameOf: id => id, storyNameOf: id => id, renderedStoryPlayer: value => value, cryptoRandomInt: () => 0, sleep: async () => {}, MILESTONE_PAUSE_MS: 0,
    shouldAutoReviveChapterStory({ removedCount }) {
      if (reviveOnce && removedCount && !revived) { revived = true; return true; }
      return false;
    },
    survivalStore: { async addDeath(_, id) { deaths.push(id); } },
    chooseSquigwreckBroadcast: () => null, escapeDiscordName: require("../src/deathRace").escapeDiscordName,
    EmbedBuilder: Builder, ActionRowBuilder: Builder, ButtonBuilder: Builder, ButtonStyle: {},
    async sendSurvivalMilestone(_, payload) { messages.push(payload); },
    updateActiveSurvivalRunState() {},
  };
  await vm.runInNewContext(`(async () => { ${source.slice(start, end)} } })()`, context);
  return { context, messages, deaths, revived };
}

test("real race loop handles even/odd fields, keeps terminal panels, and never invents a duel", async () => {
  for (const count of [2, 3, 4, 5, 9, 10, 27, 120, 200]) {
    const { context, messages, deaths } = await runRace(count);
    assert.equal(context.alive.length, 1);
    assert.equal(deaths.length, count - 1);
    assert.equal(new Set(deaths).size, count - 1);
    assert.equal(context.squigwreckPresentation.roundsCompleted, Math.floor(count / 2));
    const finals = messages.filter(m => m.embeds[0].title === "SQUIGWRECK — FINAL LAP");
    assert.equal(finals.length, 1);
    assert.equal(finals[0].protected, true, "terminal panel bypasses milestone cleanup");
    const description = finals[0].embeds[0].description;
    assert.match(description, /crosses the finish line: the last racer alive/);
    assert.ok(!description.includes(`~~${context.alive[0]}~~`));
    for (const id of deaths.slice(count % 2 ? -2 : -1)) assert.ok(description.includes(`~~${id}~~`));
    if (count % 2) assert.ok(!messages.some(m => m.embeds[0].title.includes("Final Showdown")));
    for (const message of messages) assert.ok(message.embeds[0].description.length <= 4096);
  }
});

test("real loop still supports revives and bases the ending on the resulting field", async () => {
  const { context, messages, deaths, revived } = await runRace(5, true);
  assert.equal(revived, true);
  assert.equal(context.alive.length, 1);
  assert.equal(deaths.length, 5); // Four original eliminations plus one re-elimination.
  assert.ok(messages.some(m => m.embeds[0].description.includes("Back in the race")));
  assert.equal(messages.at(-1).embeds[0].title, "SQUIGWRECK — FINAL LAP");
});
