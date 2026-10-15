"use strict";

// Keep every milestone panel. Retain the old exports/signature for callers,
// but ignore legacy per-era retention values and queued message references.
const DEFAULT_VISIBLE_MILESTONES = null;
function retentionCount() { return null; }
async function sendSurvivalMilestone(channel, payload) {
  return channel.send(payload);
}
module.exports = { DEFAULT_VISIBLE_MILESTONES, retentionCount, sendSurvivalMilestone };
