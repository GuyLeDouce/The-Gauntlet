"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { retentionCount, sendSurvivalMilestone } = require("../src/milestoneRetention");
test("all panels remain even with a legacy retention setting or deletion queue", async () => {
  for (const era of [{}, { milestoneMessageRetention: 2 }, { milestoneMessageRetention: false }]) {
    let deletes = 0;
    const old = { delete() { deletes++; } };
    const state = { milestoneMessages: [old, old, old] };
    const messages = [];
    const channel = { async send(payload) { const message = { payload, delete() { deletes++; } }; messages.push(message); return message; } };
    for (let i = 0; i < 80; i++) assert.equal((await sendSurvivalMilestone(channel, i, state, era)).payload, i);
    assert.equal(messages.length, 80);
    assert.equal(deletes, 0);
    assert.equal(retentionCount(era), null);
    assert.equal(state.milestoneMessages.length, 3, "no queue accumulation");
  }
});
test("Discord send failures propagate without touching existing panels", async () => {
  let deleted = false;
  const state = { milestoneMessages: [{ delete() { deleted = true; } }] };
  await assert.rejects(sendSurvivalMilestone({ send: async () => { throw Error("offline"); } }, {}, state), /offline/);
  assert.equal(deleted, false);
});
