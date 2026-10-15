"use strict";
const { escapeDiscordName } = require("./deathRace");
// Build mentions from participant IDs only; simulation names remain escaped text.
function storyPlayer(id, fallbackName, testMode = false) {
  return !testMode && /^\d{17,20}$/.test(String(id))
    ? `<@${id}>` : escapeDiscordName(fallbackName || `User-${id}`);
}
// Used only after storyPlayer has constructed/escaped each participant label.
const renderedStoryPlayer = value => String(value);
module.exports = { storyPlayer, renderedStoryPlayer };
