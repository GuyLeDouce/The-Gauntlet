"use strict";

// Standalone Discord milestone retention. Never touches lobbies, Final Lap,
// victory announcements, standings, or other messages (callers only pass milestones).
const DEFAULT_VISIBLE_MILESTONES = 2;

function retentionCount(eraDefinition) {
  if (eraDefinition?.milestoneMessageRetention === false) return null;
  const requested = eraDefinition?.milestoneMessageRetention;
  return Number.isInteger(requested) && requested >= 1
    ? requested
    : DEFAULT_VISIBLE_MILESTONES;
}

async function sendSurvivalMilestone(channel, payload, runState, eraDefinition = {}) {
  // Publish first. If Discord send fails, no older message may be deleted.
  const posted = await channel.send(payload);
  const keep = retentionCount(eraDefinition);
  if (!runState || keep === null) return posted;
  const messages = runState.milestoneMessages || (runState.milestoneMessages = []);
  messages.push(posted);

  for (const obsolete of messages.slice(0, Math.max(0, messages.length - keep))) {
    try {
      await obsolete.delete();
      runState.milestoneMessages = runState.milestoneMessages.filter((message) => message !== obsolete);
    } catch (error) {
      // A moderator may have already removed the Discord message.
      if (error?.code === 10008) {
        runState.milestoneMessages = runState.milestoneMessages.filter((message) => message !== obsolete);
      } else {
        console.warn("[SURVIVAL:MILESTONE_RETENTION] Failed to delete old milestone; will retry:", error?.message || error);
      }
    }
  }
  return posted;
}

module.exports = { DEFAULT_VISIBLE_MILESTONES, retentionCount, sendSurvivalMilestone };
