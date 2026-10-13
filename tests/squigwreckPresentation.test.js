"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RADIO_CHANCE_PERCENT,
  CAMEO_CHANCE_PERCENT,
  RADIO_LINES,
  CAMEO_LINES,
  createSquigwreckPresentationState,
  chooseSquigwreckBroadcast,
  squigwreckChampionDescription,
} = require("../src/squigwreckPresentation");
const { VICTORY } = require("../src/deathRaceNarrative");

function fakeRacers() {
  return { aliveIds: ["s1", "s2", "s3", "s4"], nameOf: id => ({
    s1: "Runner One", s2: "Runner Two", s3: "Runner Three", s4: "Runner Four",
  }[id]) };
}
function choose({ chance, index = 0, state = createSquigwreckPresentationState(), aliveIds, nameOf }) {
  const defaults = fakeRacers();
  let call = 0;
  return chooseSquigwreckBroadcast({
    aliveIds: aliveIds || defaults.aliveIds,
    nameOf: nameOf || defaults.nameOf,
    state,
    randomInt: max => {
      const selected = call++ === 0 ? chance : index;
      assert.ok(selected >= 0 && selected < max, "invalid deterministic random value");
      return selected;
    },
  });
}

test("radio/cameo are mutually exclusive, with fixed simple rates", () => {
  assert.equal(RADIO_CHANCE_PERCENT, 25);
  assert.equal(CAMEO_CHANCE_PERCENT, 20);
  assert.equal(RADIO_LINES.length, 40);
  assert.equal(CAMEO_LINES.length, 24);
  assert.equal(choose({ chance: 24 }).type, "radio");
  assert.equal(choose({ chance: 25 }).type, "cameo");
  assert.equal(choose({ chance: 44 }).type, "cameo");
  assert.equal(choose({ chance: 45 }), null);
  assert.equal(choose({ chance: 99 }), null);
});

test("race radio stays inside the existing milestone embed", () => {
  const event = choose({ chance: 0 });
  assert.equal(event.type, "radio");
  assert.match(event.text, /SQUIGWRECK RACE RADIO/);
  assert.ok(event.text.includes(RADIO_LINES[0]));
  assert.doesNotMatch(event.text, /<player/);
});

test("no repeated commentary until the bag is exhausted", () => {
  const state = createSquigwreckPresentationState();
  const outputs = Array.from({length: RADIO_LINES.length}, () => choose({chance:0,state}).text);
  assert.equal(new Set(outputs).size, RADIO_LINES.length);
  assert.equal(state.radioBag.length, 0);
  assert.equal(choose({chance:0,state}).text, outputs[0]);
});

test("lucky cameo uses only a still-alive Squig and escapes Discord markdown", () => {
  const state = createSquigwreckPresentationState();
  const aliveIds = ["living", "still-here", "another"];
  const event = choose({
    chance: 25, state, aliveIds,
    nameOf: id => id === "living" ? "@evil_*" : id,
  });
  assert.equal(event.type, "cameo");
  assert.equal(event.racerId, "living");
  assert.ok(aliveIds.includes(event.racerId));
  assert.ok(event.text.includes("@\u200bevil\\_\\*"));
  assert.doesNotMatch(event.text, /~~/); // surviving racer is not eliminated
  assert.equal(state.roundsCompleted, 0);
  assert.deepEqual(aliveIds, ["living", "still-here", "another"]);
});

test("never interrupt final two or a sole winner", () => {
  const state = createSquigwreckPresentationState();
  const alive = ["first", "second"];
  assert.equal(choose({ chance:0, state, aliveIds: alive }), null);
  assert.equal(choose({ chance:25, state, aliveIds: alive }), null);
  assert.equal(choose({ chance:0, state, aliveIds: ["last"] }), null);
  assert.equal(state.radioBag.length, 0);
  assert.equal(state.cameoBag.length, 0);
});

test("champion record uses true entrants/rounds without inventing personal kills", () => {
  for (const [entrants, rounds] of [[1,0],[2,1],[3,1],[10,5],[120,60]]) {
    const text = squigwreckChampionDescription({
      story: VICTORY, winnerName: "Champion", racersEntered: entrants, roundsCompleted: rounds,
    });
    assert.ok(text.includes("Champion is the SQUIGWRECK CHAMPION!"));
    assert.ok(text.includes("Racers entered:** " + entrants));
    assert.ok(text.includes("Racers eliminated:** " + (entrants - 1)));
    assert.ok(text.includes("Race rounds completed:** " + rounds));
    assert.match(text, /Finish:\*\* 🥇 1st/);
    assert.doesNotMatch(text, /<winner>/);
  }
  const escaped = squigwreckChampionDescription({
    story: VICTORY, winnerName: "@everyone_*", racersEntered: 4, roundsCompleted: 2,
  });
  assert.ok(escaped.includes("@\u200beveryone\\_\\*"));
});

test("commentary has no side effects on existing eliminations or rewards", () => {
  const state = createSquigwreckPresentationState();
  const entrants = ["s1", "s2", "s3", "s4"];
  const copy = [...entrants];
  choose({chance:25,state,aliveIds:entrants});
  choose({chance:0,state,aliveIds:entrants});
  assert.deepEqual(entrants,copy);
  assert.deepEqual(Object.keys(state).sort(), ["cameoBag","radioBag","roundsCompleted"]);
});
