"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { retentionCount, sendSurvivalMilestone } = require("../src/milestoneRetention");

function mockChannel() {
  const calls = [];
  const channel = { 
    send: async (payload) => {
      const message = {
        id: String(calls.length + 1),
        payload, deleted: false,
        async delete() { this.deleted = true; },
      };
      calls.push(message);
      return message;
    },
  };
  return { channel, calls };
}

test("default keeps the latest two messages and deletes only after publishing the third", async () => {
  const { channel, calls } = mockChannel();
  const state = {};
  for (let i = 0; i < 4; i++) await sendSurvivalMilestone(channel, "milestone", state, {});
  assert.equal(calls.length, 4);
  assert.equal(calls[0].deleted, true);
  assert.equal(calls[1].deleted, true);
  assert.equal(calls[2].deleted, false);
  assert.equal(calls[3].deleted, false);
  assert.equal(state.milestoneMessages.length, 2);
});
test("per-era retention overrides and disabled cleanup", async () => {
  assert.equal(retentionCount({}), 2);
  assert.equal(retentionCount({ milestoneMessageRetention: false }), null);
  assert.equal(retentionCount({ milestoneMessageRetention: 4 }), 4);
  const { channel, calls } = mockChannel();
  const state = {};
  for (let i = 0; i < 4; i++) await sendSurvivalMilestone(channel, i, state, { milestoneMessageRetention: false });
  assert.ok(calls.every(message => !message.deleted));
});
test("failed Discord send never deletes earlier messages", async () => {
  const { channel, calls } = mockChannel();
  const state = {};
  await sendSurvivalMilestone(channel, "first", state);
  await sendSurvivalMilestone(channel, "second", state);
  channel.send = async () => { throw new Error("Send failed"); };
  await assert.rejects(() => sendSurvivalMilestone(channel, "third", state));
  assert.ok(calls.every(message => !message.deleted));
});
test("deletion errors are retried on later milestones", async () => {
  const { channel, calls } = mockChannel();
  const state = {};
  for (let i = 0; i < 2; i++) await sendSurvivalMilestone(channel, i, state);
  let tries = 0;
  calls[0].delete = async function() { tries += 1; if (tries === 1) throw new Error("Missing permission"); this.deleted = true; };
  await sendSurvivalMilestone(channel, 2, state);
  assert.equal(calls[0].deleted, false);
  await sendSurvivalMilestone(channel, 3, state);
  assert.equal(calls[0].deleted, true);
});
