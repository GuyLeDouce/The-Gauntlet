"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  buildSurvivalArtCreditField,
  addSurvivalArtCredit,
} = require("../src/survivalArtCredit");

const source = fs.readFileSync(path.join(__dirname, "../src/survival.js"), "utf8");

test("a creator credit is one short embed field using the configured amount", () => {
  const f = buildSurvivalArtCreditField({ userId: "836389642885398530", amount: 100 });
  assert.deepEqual(f, {
    name: "🎨 Artwork",
    value: "<@836389642885398530> · +100 $CHARM toward creator total",
    inline: false,
  });
  const singleCharm = buildSurvivalArtCreditField({ userId: "836389642885398530", amount: 1 });
  assert.match(singleCharm.value, /\+1 \$CHARM/);
});

test("invalid credits never create a mention or field", () => {
  for (const credit of [
    null, {}, { userId: "@everyone", amount: 100 },
    { userId: "123", amount: 100 },
    { userId: "836389642885398530", amount: 0 },
    { userId: "836389642885398530", amount: NaN },
  ]) {
    assert.equal(buildSurvivalArtCreditField(credit), null);
  }
  const embed = { fields: [], addFields(field) { this.fields.push(field); return this; } };
  assert.equal(addSurvivalArtCredit(embed, null), embed);
  assert.equal(embed.fields.length, 0);
  assert.equal(addSurvivalArtCredit(embed, {userId:"836389642885398530",amount:50}), embed);
  assert.equal(embed.fields.length, 1);
});

function loadActualImageAwardFunction() {
  const start = source.indexOf("async function awardSurvivalImageUse(");
  const end = source.indexOf("\nconst SURVIVAL_ART_PAYOUT =", start);
  assert.ok(start >= 0 && end > start, "award function must exist");
  const functionSource = source.slice(start, end);
  assert.doesNotMatch(functionSource, /channel\.send\(/, "reward recording must never post a separate art message");
  const recorded = [];
  const context = {
    module: { exports: {} },
    Map,
    SURVIVAL_ART_REWARDS: {},
    survivalStore: {
      async addImageUse(gameId, userId, imageUrl) {
        recorded.push([gameId, userId, imageUrl]);
      },
    },
    console: { error() {} },
  };
  vm.runInNewContext(
    functionSource + "\nmodule.exports = awardSurvivalImageUse;",
    context,
    {filename:"survival-award-isolated.js"}
  );
  return {award: context.module.exports, recorded};
}

test("image use still persists to the existing DB ledger and final creator total, with no standalone messages", async () => {
  const {award, recorded} = loadActualImageAwardFunction();
  const imageUrl = "https://example.test/stage.png";
  let attemptedMessages = 0;
  const channel = { async send() { attemptedMessages++; throw Error("No art drop messages allowed"); } };
  const run = {
    gameId: 45,
    testMode: false,
    creatorRewardTotals: new Map(),
    dbRewardMap: new Map([[imageUrl, { userId: "836389642885398530", amount: 100 }]]),
    usedImageUrls: [],
  };
  const first = await award(channel, run, imageUrl);
  assert.equal(first.userId, "836389642885398530");
  assert.equal(first.amount, 100);
  assert.equal(run.creatorRewardTotals.get("836389642885398530"), 100);
  assert.equal(run.usedImageUrls.length, 1);
  assert.deepEqual(recorded, [[45,"836389642885398530",imageUrl]]);
  const second = await award(channel, run, imageUrl);
  assert.equal(second.amount,100);
  assert.equal(run.creatorRewardTotals.get("836389642885398530"), 200);
  assert.equal(recorded.length, 2, "each use still counts towards final totals");
  assert.equal(attemptedMessages, 0, "no Discord art-drop posts or buttons");
});

test("test mode never credits real CHARM or records a DB image use", async () => {
  const {award, recorded} = loadActualImageAwardFunction();
  const imageUrl = "https://example.test/stage.png";
  const run = {
    gameId: 45,
    testMode: true,
    creatorRewardTotals: new Map(),
    dbRewardMap: new Map([[imageUrl, {userId:"836389642885398530",amount:100}]]),
    usedImageUrls: [],
  };
  const credited = await award({ async send() { throw Error("Should not send"); } }, run, imageUrl);
  assert.equal(credited, null);
  assert.equal(recorded.length,0);
  assert.equal(run.usedImageUrls.length,1);
  assert.equal(run.creatorRewardTotals.size,0);
});

test("every Survival milestone embeds its own credit; existing final payouts and summaries are intact", () => {
  const hits = source.match(/addSurvivalArtCredit\(embed, await awardSurvivalImageUse\(/g) || [];
  assert.equal(hits.length, 3, "Squigwreck, Ugly City and standard Survival must all support embed credits");
  assert.match(source, /sendSurvivalCreatorPayouts/);
  assert.match(source, /sendSurvivalRewardsSummary/);
  assert.match(source, /creatorRewardTotals\.set\(/);
  assert.doesNotMatch(source, /Art drop! Thanks to/);
});
