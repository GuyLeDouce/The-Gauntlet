"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const {MILESTONES,LOBBY,START,FINAL_LAP,VICTORY}=require("../src/deathRaceNarrative");
test("complete 60-milestone narrative and correct elimination totals",()=>{assert.equal(MILESTONES.length,60);assert.equal(MILESTONES.reduce((n,m)=>n+m.eliminations,0),118);assert.equal(MILESTONES[59].eliminations,0);assert.ok(LOBBY&&START&&FINAL_LAP&&VICTORY);for(const m of MILESTONES.slice(0,59)){assert.ok(m.story.includes("<player1>"));assert.ok(m.story.includes("<player2>"));}});
