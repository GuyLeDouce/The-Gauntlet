"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { buildSurvivalShareText, formatPlacementLabel } = require("../src/survivalShare");
const { normalizeEraPool, chooseLobbyEra, describeEraPool } = require("../src/survivalEraSelection");
const { storyPlayer, renderedStoryPlayer } = require("../src/survivalPlayer");
const { SCENARIOS, renderScenario } = require("../src/deathRaceScenarios");
const { chooseSquigwreckBroadcast, createSquigwreckPresentationState, squigwreckChampionDescription } = require("../src/squigwreckPresentation");
const { SURVIVAL_ERAS, getUglyCityChapter } = require("../src/survivalEras");
const { MILESTONES, VICTORY } = require("../src/deathRaceNarrative");

const ids = ["123456789012345678", "223456789012345678", "323456789012345678"];
const mention = id => storyPlayer(id, "Display Name");

function reviveHarness(eraKey, enabled = true) {
  const source = fs.readFileSync(require.resolve("../src/survival"), "utf8");
  const sent = [];
  let rolls = 0;
  const run = {
    eraKey, revivesEnabled: enabled, ended: false, currentMilestone: 7,
    joined: new Set([...ids, "dead"]), joinedIds: [...ids, "dead"],
    aliveIds: ["a", "b", "c", "d", "e", "f", "g"],
    aliveSet: new Set(["a", "b", "c", "d", "e", "f", "g"]),
    eliminatedIds: ["dead"], reviveAttemptsByMilestone: new Map(),
  };
  const context = {
    activeSurvivalRuns: new Map([["channel", run]]),
    chance() { rolls += 1; return true; },
    upsertSurvivalRunStatus() {},
    getSurvivalEraDefinition() { return { stories: { resurrections: ["{victim} returns"] } }; },
    pick: pool => pool[0],
    takeRunImage: () => null,
    awardSurvivalImageUse: async () => {},
  };
  vm.runInNewContext(source.slice(source.indexOf("function formatReviveLore"),
    source.indexOf("function shuffle")), context);
  vm.runInNewContext(source.slice(source.indexOf("function shouldAutoReviveChapterStory"),
    source.indexOf("function replaceUglyCityPlaceholders")), context);
  return { run, context, sent, rolls: () => rolls,
    message: { channelId: "channel", author: { id: "dead" },
      channel: { async send(payload) { sent.push(payload); } } } };
}

test("Squigwreck and Ugly City reject manual revives without rolls or state changes", async () => {
  for (const era of ["squigwreck", "ugly_city"]) {
    for (const enabled of [true, false]) {
      const h = reviveHarness(era, enabled);
      const before = JSON.stringify(h.run);
      assert.equal(await h.context.handlePublicReviveCommand(h.message), true);
      assert.equal(h.rolls(), 0);
      assert.equal(JSON.stringify(h.run), before);
      assert.equal(h.run.reviveAttemptsByMilestone.size, 0);
      assert.equal(h.run.aliveSet.has("dead"), false);
      assert.deepEqual(h.sent, ["Manual !revive is disabled for this era."]);
    }
  }
});

test("other eras retain enabled manual revives and the disabled setting", async () => {
  const h = reviveHarness("day_one");
  await h.context.handlePublicReviveCommand(h.message);
  assert.equal(h.rolls(), 1);
  assert.ok(h.run.aliveIds.includes("dead"));
  assert.equal(h.run.eliminatedIds.length, 0);
  assert.equal(h.run.reviveAttemptsByMilestone.get("dead"), 1);
  const disabled = reviveHarness("day_one", false);
  await disabled.context.handlePublicReviveCommand(disabled.message);
  assert.equal(disabled.rolls(), 0);
  assert.deepEqual(disabled.run.eliminatedIds, ["dead"]);
});

test("storyline revival schedule and enabled setting remain intact in both eras", () => {
  for (const era of ["squigwreck", "ugly_city"]) {
    const h = reviveHarness(era);
    const args = { chapterNumber: 7, aliveCount: 7, removedCount: 1,
      revivesEnabled: true, eraDefinition: SURVIVAL_ERAS[era] };
    assert.equal(h.context.shouldAutoReviveChapterStory(args), true);
    assert.equal(h.context.shouldAutoReviveChapterStory({ ...args, chapterNumber: 14 }), true);
    assert.equal(h.context.shouldAutoReviveChapterStory({ ...args, chapterNumber: 8 }), false);
    assert.equal(h.context.shouldAutoReviveChapterStory({ ...args, revivesEnabled: false }), false);
    assert.equal(h.context.shouldAutoReviveChapterStory({ ...args, aliveCount: 6 }), false);
    assert.equal(h.context.shouldAutoReviveChapterStory({ ...args, removedCount: 0 }), false);
  }
});

test("lobby copy distinguishes storyline revives from manual commands", () => {
  const source = fs.readFileSync(require.resolve("../src/soloGauntlet"), "utf8");
  const context = { isSurvivalPlayerCountStart: () => false,
    isUglyFortuneBonusPrize: () => false };
  vm.runInNewContext(source.slice(source.indexOf("function buildSurvivalSetupParagraph"),
    source.indexOf("function buildSurvivalLobbyEmbed")), context);
  for (const enabled of [true, false]) {
    const cfg = { era_key: "squigwreck", era: "Squigwreck", revives_enabled: enabled };
    const copy = context.buildSurvivalSetupParagraph(cfg, null);
    assert.ok(copy.includes("storyline revives are **" + (enabled ? "ON" : "OFF") + "**"));
    assert.ok(copy.includes("manual **!revive** is **OFF**"));
    const city = context.buildUglyCityLobbyDescription({ ...cfg, era_key: "ugly_city" }, 10, null);
    assert.ok(city.includes("storyline revives are " + (enabled ? "on" : "off")));
    assert.ok(city.includes("manual !revive is off"));
    assert.ok(context.buildSurvivalSetupParagraph({ ...cfg, era_key: "day_one" }, null)
      .includes("**!revive** is **" + (enabled ? "ON" : "OFF") + "**"));
  }
});

test("all race scenario roles, cameos and champion use intact mentions", () => {
  for (const [type, def] of Object.entries(SCENARIOS)) {
    for (const story of def.stories || MILESTONES.slice(0, 59).map(m => m.story)) {
      const text = renderScenario(type, story, ids.map(mention), renderedStoryPlayer);
      for (let i = 0; i < ids.length; i++) {
        if (!story.includes(`<player${i + 1}>`)) continue;
        assert.ok(text.includes(mention(ids[i])));
        assert.equal(text.includes(`~~${mention(ids[i])}~~`), def.deadSlots.includes(i + 1));
      }
      assert.doesNotMatch(text, /Display Name|\u200b/);
    }
  }
  let call = 0;
  const cameo = chooseSquigwreckBroadcast({ aliveIds: ids, nameOf: mention, formatName: renderedStoryPlayer,
    state: createSquigwreckPresentationState(), randomInt: () => call++ === 0 ? 25 : 0 });
  assert.ok(cameo.text.includes(mention(ids[0])));
  assert.ok(squigwreckChampionDescription({ story: VICTORY, winnerName: mention(ids[0]),
    racersEntered: 3, roundsCompleted: 1, formatName: renderedStoryPlayer }).includes(mention(ids[0])));
});

test("simulation and invalid participant IDs stay escaped text", () => {
  assert.equal(storyPlayer(ids[0], "Bot_*", true), "Bot\\_\\*");
  assert.equal(storyPlayer("fake", "@everyone"), "@\u200beveryone");
  assert.equal(storyPlayer("<@123456789012345678>", "@here"), "@\u200bhere");
});

test("Ugly City and classic story formatters preserve mentions", () => {
  const source = fs.readFileSync(require.resolve("../src/survival"), "utf8");
  const context = {};
  const snippets = [
    source.slice(source.indexOf("function format(template"), source.indexOf("function isChapterStoryEra")),
    source.slice(source.indexOf("function replaceUglyCityPlaceholders"), source.indexOf("function updateActiveSurvivalRunState")),
  ];
  vm.runInNewContext(snippets.join("\n"), context);
  const chapter = getUglyCityChapter(SURVIVAL_ERAS.ugly_city, 1);
  const rendered = context.replaceUglyCityPlaceholders(chapter.story, { removed1: mention(ids[0]), removed2: mention(ids[1]) });
  assert.ok(rendered.includes(mention(ids[0])) && rendered.includes(mention(ids[1])));
  assert.equal(context.format("{killer} destroys {victim}", ids[0], ids[1], mention), `${mention(ids[1])} destroys ~~${mention(ids[0])}~~`);
});

test("each era has distinct win/loss shares with placement and accurate rewards under 280 characters", () => {
  const intros = new Set();
  for (const eraKey of Object.keys(SURVIVAL_ERAS)) {
    for (const placement of [1, 2, 11, 123]) {
      for (const [payout, creatorReward] of [[0, 0], [5000, 0], [0, 1000], [5000, 1000]]) {
        const text = buildSurvivalShareText({ eraKey, placement, payout, creatorReward });
        assert.ok(text.length <= 280, text);
        assert.ok(text.includes("@SquigsNFT") && text.includes("https://squigs.io/discord"));
        if (placement !== 1) assert.ok(text.includes(formatPlacementLabel(placement)));
        if (payout) assert.ok(text.includes(`${payout} $CHARM won`));
        if (creatorReward) assert.ok(text.includes(`${creatorReward} $CHARM for my art`));
        if (!payout && !creatorReward) assert.ok(text.includes("No $CHARM"));
      }
    }
    intros.add(buildSurvivalShareText({ eraKey, placement: 1 }).split("\n")[0]);
  }
  assert.equal(intros.size, Object.keys(SURVIVAL_ERAS).length);
  assert.match(buildSurvivalShareText({ eraKey: "death_race", placement: 1 }), /Squigwreck champion/);
});

test("share sessions snapshot the played era for winners and losers", () => {
  const source = fs.readFileSync(require.resolve("../src/survival"), "utf8");
  const context = { survivalShareSessions: new Map(), MAX_SURVIVAL_SHARE_SESSIONS: 20,
    buildSurvivalShareText, normalizeEraKey: require("../src/deathRace").normalizeEraKey, cryptoRandomInt: () => 0 };
  vm.runInNewContext(source.slice(source.indexOf("function trimSurvivalShareSessions"), source.indexOf("function formatReviveLore")), context);
  const race = context.createSurvivalShareSession({ gameId: "race", eraKey: "squigwreck", placements: ids, awardedPayouts: { [ids[0]]: 500 } });
  const city = context.createSurvivalShareSession({ gameId: "city", eraKey: "ugly_city", placements: ids });
  assert.match(context.getSurvivalShareData(race, ids[0]).result.shareText, /Squigwreck champion/);
  assert.match(context.getSurvivalShareData(race, ids[1]).result.shareText, /2nd in Squigwreck/);
  assert.match(context.getSurvivalShareData(city, ids[0]).result.shareText, /Founder of Ugly City/);
  assert.match(context.getSurvivalShareData(city, ids[1]).result.shareText, /2nd building Ugly City/);
  assert.equal(context.getSurvivalShareData(city, "outsider"), null);
  assert.equal(context.getSurvivalShareData("missing", ids[0]), null);
});

test("era pools normalize legacy settings, clone arrays, and choose only selected eras", () => {
  assert.deepEqual(normalizeEraPool(undefined, "ugly_city"), ["ugly_city"]);
  assert.deepEqual(normalizeEraPool(["death_race", "squigwreck", "bad", "ugly_city"]), ["squigwreck", "ugly_city"]);
  assert.deepEqual(normalizeEraPool(["__proto__", "constructor"]), ["day_one"]);
  const settings = { era_key: "squigwreck", era_keys: ["squigwreck", "ugly_city"] };
  assert.match(describeEraPool(settings), /Random: Squigwreck \/ The Rise of Ugly City/);
  const first = chooseLobbyEra(settings, () => 0), second = chooseLobbyEra(settings, () => 1);
  assert.equal(first.era_key, "squigwreck");
  assert.equal(second.era_key, "ugly_city");
  first.era_keys.pop();
  assert.equal(settings.era_keys.length, 2);
  assert.equal(chooseLobbyEra({ era_key: "ugly_city" }, () => { throw Error("must not roll"); }).era_key, "ugly_city");
});

