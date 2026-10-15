"use strict";
const { getSurvivalEraDefinition } = require("./survivalEras");
const { normalizeEraKey } = require("./deathRace");
function formatPlacementLabel(rank) {
  const n = Math.max(1, Math.trunc(Number(rank) || 1));
  return `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({1:"st",2:"nd",3:"rd"}[n % 10] || "th")}`;
}
const FLAVOR = Object.freeze({
  squigwreck: ["Last racer alive. Squigwreck champion!", "Finished {place} in Squigwreck. My car is scrap. My revenge isn't."],
  ugly_city: ["I survived the build crew and became Founder of Ugly City!", "Finished {place} building Ugly City. Apparently I was a structural problem."],
  day_one: ["First day on Earth. Last Squig standing. I won Day One!", "Finished {place} in Day One. Earth and I are no longer speaking."],
  reloaded: ["Locked, loaded, last Squig standing. I won RELOADED!", "Finished {place} in RELOADED. Send ammo. And a replacement Squig."],
  office_squigs: ["Last Squig standing at the office. I won Office Squigs!", "Finished {place} in Office Squigs. HR has requested my remains."],
  jobsite_squigs: ["Survived the jobsite. Won Jobsite Squigs. Still no safety bonus.", "Finished {place} in Jobsite Squigs. Definitely not an approved work method."],
  movie_theater: ["I survived the screening and won Movie Theater!", "Finished {place} in Movie Theater. Didn't survive to the credits."],
  airport: ["Last passenger standing. I won Airport!", "Finished {place} in Airport. My Squig has been permanently delayed."],
  zombie_apocalypse: ["Outlived the outbreak. I won Zombie Apocalypse!", "Finished {place} in Zombie Apocalypse. The undead left a terrible review."],
});
function buildSurvivalShareText(result = {}) {
  const era = getSurvivalEraDefinition(normalizeEraKey(result.eraKey || "day_one"));
  const win = Number(result.placement) === 1;
  const place = formatPlacementLabel(result.placement);
  const flavor = FLAVOR[era.key] || [`I won Squig Survival: ${era.label}!`, `Finished {place} in Squig Survival: ${era.label}. Send help.`];
  const amount = n => Math.max(0, Number(n) || 0);
  const payout = amount(result.payout), creator = amount(result.creatorReward);
  const rewards = [];
  if (payout) rewards.push(`${payout} $CHARM won`);
  if (creator) rewards.push(`${creator} $CHARM for my art`);
  return [flavor[win ? 0 : 1].replace("{place}", place),
    rewards.length ? rewards.join(" + ") + "." : "No $CHARM this time. I'll be back.",
    "", "Join us: https://squigs.io/discord", "@SquigsNFT"].join("\n");
}
module.exports = { buildSurvivalShareText, formatPlacementLabel };
