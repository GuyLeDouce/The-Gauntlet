"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const race = require("../src/deathRace");
test("120 entrants yield two finalists and one winner", () => {
 assert.equal(race.racersRemaining(0),120);
 for(let n=1;n<=59;n++) assert.equal(race.eliminationCount(n),2);
 assert.equal(race.racersRemaining(59),2);
 assert.equal(race.eliminationCount(60),0);
 assert.equal(race.racersRemaining(60),2);
 assert.equal(race.finalLapRemaining(),1);
});
test("only eliminated names are struck out",()=>{
 const s=race.renderEliminationStory("<player1> hit <player2> while <survivor> escaped",["First","Second"],["Third"]);
 assert.equal(s,"~~First~~ hit ~~Second~~ while Third escaped");
});
test("milestone cleanup is disabled",()=>{
 assert.equal(race.milestoneToDelete(2),null);
 assert.equal(race.milestoneToDelete(3),null);
 assert.equal(race.milestoneToDelete(60),null);
});
test("image pool filters by era and avoids reuse",()=>{
 const images=[{id:1,era_keys:"ugly_city"},{id:2,era_keys:"death_race"},{id:3,era_keys:"death_race"}];
 assert.equal(race.pickEraImage(images,[2],()=>0).id,3);
});
