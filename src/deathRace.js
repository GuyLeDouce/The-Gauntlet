"use strict";
// Additive Death Race utilities. No existing Survival behavior is modified by importing this file.
const ERA_KEY = "squigwreck";
const LEGACY_ERA_KEY = "death_race";
const LOBBY_IMAGE_URL = "https://i.imgur.com/amVLHM9.png";
function normalizeEraKey(key) { return key === LEGACY_ERA_KEY ? ERA_KEY : key; }
const STARTING_RACERS = 120;
const DOUBLE_ELIMINATION_ROUNDS = 59;
const SHOWDOWN_MILESTONE = 60;
const DEFAULT_VISIBLE_MILESTONES = 2;
function eliminationCount(milestone) {
  if (!Number.isInteger(milestone) || milestone < 1 || milestone > SHOWDOWN_MILESTONE) throw new RangeError("Invalid Death Race milestone");
  return milestone <= DOUBLE_ELIMINATION_ROUNDS ? 2 : 0;
}
function racersRemaining(milestone) {
  return STARTING_RACERS - Math.min(milestone, DOUBLE_ELIMINATION_ROUNDS) * 2;
}
function finalLapRemaining() { return racersRemaining(SHOWDOWN_MILESTONE) - 1; }
function escapeDiscordName(name) {
  return String(name ?? "Unknown Squig").replace(/([\\*_~`|>])/g, "\\$1").replace(/@/g, "@\u200b").replace(/\r?\n/g, " ");
}
function eliminatedName(name) { return "~~" + escapeDiscordName(name) + "~~"; }
function renderFinalLapStory(template, eliminated, winner) {
  return String(template).replace(/<player1>/g, eliminatedName(eliminated)).replace(/<player2>/g, escapeDiscordName(winner));
}
function renderEliminationStory(template, eliminated, survivors = []) {
  if (!Array.isArray(eliminated) || eliminated.length !== 2) throw new Error("Two eliminated racers required");
  return String(template)
    .replace(/<player1>/g, eliminatedName(eliminated[0]))
    .replace(/<player2>/g, eliminatedName(eliminated[1]))
    .replace(/<survivor>/g, survivors.length ? escapeDiscordName(survivors[0]) : "another racer");
}
function milestoneToDelete(publishedMilestone, visible = DEFAULT_VISIBLE_MILESTONES) {
  if (!Number.isInteger(visible) || visible < 1) throw new RangeError("Invalid retention");
  return publishedMilestone > visible ? publishedMilestone - visible : null;
}
function pickEraImage(images, previouslyUsedIds = [], random = Math.random) {
  const eligible = images.filter(image => image && image.approved !== false && (image.era_keys || image.era_key || "").toString().split(",").map(x => x.trim()).some(x => normalizeEraKey(x) === ERA_KEY));
  if (!eligible.length) return null;
  const fresh = eligible.filter(image => !previouslyUsedIds.includes(image.id));
  const pool = fresh.length ? fresh : eligible;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
module.exports = { ERA_KEY, LEGACY_ERA_KEY, LOBBY_IMAGE_URL, normalizeEraKey, STARTING_RACERS, DOUBLE_ELIMINATION_ROUNDS, SHOWDOWN_MILESTONE, DEFAULT_VISIBLE_MILESTONES, eliminationCount, racersRemaining, finalLapRemaining, escapeDiscordName, eliminatedName, renderEliminationStory, renderFinalLapStory, milestoneToDelete, pickEraImage };
