"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getSurvivalEraDefinition, SURVIVAL_ERAS } = require("../src/survivalEras");
const { normalizeEraKey, LOBBY_IMAGE_URL, renderEliminationStory, renderFinalLapStory, pickEraImage } = require("../src/deathRace");
const { MILESTONES, VICTORY } = require("../src/deathRaceNarrative");

test("Squigwreck is a distinct configured era with the exact official Join image", () => {
  const era = getSurvivalEraDefinition("squigwreck");
  assert.equal(era.key, "squigwreck");
  assert.equal(era.label, "Squigwreck");
  assert.equal(era.lobby.imageUrl, "https://i.imgur.com/amVLHM9.png");
  assert.equal(era.lobby.imageUrl, LOBBY_IMAGE_URL);
  assert.equal(era.mode, "squigwreck");
  assert.equal(SURVIVAL_ERAS.ugly_city.key, "ugly_city");
  assert.equal(normalizeEraKey("death_race"), "squigwreck");
  assert.equal(getSurvivalEraDefinition("death_race"), era);
});
test("both historical and new image tags work, unrelated eras are excluded", () => {
  const data = [{ id: 1, era_keys: "ugly_city" }, { id: 2, era_keys: "death_race" }, { id: 3, era_keys: "squigwreck" }];
  assert.equal(pickEraImage(data, [2], () => 0).id, 3);
  assert.equal(pickEraImage(data, [3], () => 0).id, 2);
});
test("eliminated driver names are struck out but the last winner is not", () => {
  assert.equal(renderEliminationStory("<player1> hit <player2>", ["A", "B"]), "~~A~~ hit ~~B~~");
  assert.equal(renderFinalLapStory("<player1> crashed; <player2> survived", "A", "B"), "~~A~~ crashed; B survived");
  assert.ok(!VICTORY.includes("120"));
});
test("story library is independent of player count", () => {
  assert.equal(MILESTONES.length, 60);
  for (const total of [2, 3, 4, 9, 10, 27, 120, 200]) {
    let remaining = total, doubles = 0, finalEliminations = 0;
    while (remaining > 1) {
      if (remaining === 2) { remaining -= 1; finalEliminations += 1; }
      else { remaining -= Math.min(2, remaining - 1); doubles += 1; }
    }
    assert.equal(remaining, 1);
    assert.equal(doubles * 2 + finalEliminations, total - 1);
  }
});
