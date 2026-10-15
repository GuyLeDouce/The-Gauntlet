"use strict";
// Presentation-only Squigwreck radio and surviving-racer cameos.
// No Discord messages, persistence, rewards, or gameplay RNG are changed here.
const { randomInt: cryptoRandomInt } = require("node:crypto");
const { escapeDiscordName } = require("./deathRace");

const RADIO_CHANCE_PERCENT = 25;
const CAMEO_CHANCE_PERCENT = 20;

const RADIO_LINES = Object.freeze([
  "Race control confirms the brakes are still optional. So is good judgment.",
  "That was less of an overtake and more of a disagreement between two engines.",
  "The cleanup crew would like everyone to know they are no longer the cleanup crew.",
  "Whoever installed that rocket launcher should never be allowed near a toolbox.",
  "An official has requested a safety car. We have informed them there are no safe cars.",
  "Somebody just passed the pit lane sideways. The pit crew applauded and immediately hid.",
  "The track inspector has reported a pothole. That pothole was originally a truck.",
  "The insurance department stopped answering calls around the second explosion.",
  "Reminder to all drivers: the finish line is ahead. The hospital is much, much further away.",
  "That maneuver was illegal in twelve countries and three entirely fictional ones.",
  "Race control asks that everyone stop using the guardrails as steering equipment.",
  "An anonymous mechanic says those bolts were decorative. Good to know now.",
  "We have reached the point where the wrecking crew needs its own wrecking crew.",
  "Today's forecast: scattered tires, heavy smoke, and a strong chance of poor choices.",
  "These machines cost a fortune to build and approximately four seconds to destroy.",
  "The sponsor would like us to remind you that the word 'safety' is not in the contract.",
  "I don't know what that driver was attempting, but physics has issued a formal complaint.",
  "Race control has lost contact with the pace car. It may never have existed.",
  "To anyone complaining about the course: the course is complaining about you.",
  "On the bright side, at least one of those engines is still running. It's not attached to anything.",
  "That is now the third corner to be declared a total loss. Fantastic atmosphere.",
  "The marshals have run out of flags. They are waving old engine belts instead.",
  "Important update: the emergency exit has been replaced by another entrance.",
  "Some of these vehicles have more weapons than wheels. Somehow, that's not helping.",
  "The tire manufacturer would like to distance itself from whatever that was.",
  "If you're just tuning in, yes, this is a race. We're surprised too.",
  "Race control says the next straightaway is clear. They used the word 'probably.'",
  "The crowd is standing. Mostly because the grandstand chairs have been taken for armor.",
  "One driver just discovered the accelerator is not a personality trait.",
  "The event organizers insist this is going exactly to plan. Nobody has seen the plan.",
  "A friendly reminder that hitting the horn does not make the rockets reload faster.",
  "There is smoke coming from every direction. Some of it might actually be intentional.",
  "Another beautiful demonstration of what happens when confidence outruns talent.",
  "The pit crew sent us a bill for emotional damages. We forwarded it to the scrap yard.",
  "Someone has asked if the race can slow down. We laughed so hard we lost the microphone.",
  "No fatalities among the commentators so far. We are keeping the booth doors locked.",
  "Race control would like to congratulate the road for surviving this long.",
  "Those armored panels appear to be held on by hope and two very optimistic screws.",
  "The mechanics call that engine noise 'terminally enthusiastic.'",
  "Imagine explaining this to your insurance agent without laughing."
]);
const CAMEO_LINES = Object.freeze([
  "{racer} just slipped through that wreckage like collision detection was turned off. Lucky bastard.",
  "A flying tire missed {racer} by inches. Somehow, the driver didn't even look up.",
  "{racer} narrowly avoided a flaming bumper and immediately pretended it was intentional.",
  "Nobody knows how {racer} found a gap in that pileup. Least of all {racer}.",
  "{racer} drove through the smoke and came out with all four tires. We have questions.",
  "A chunk of armor bounced past {racer}. The driver's response was to accelerate. Naturally.",
  "{racer} scraped the guardrail and kept going. The guardrail is filing a complaint.",
  "That falling piece of machinery had {racer}'s name on it. Apparently it couldn't read.",
  "{racer} found the only bit of road that wasn't on fire. Outstandingly irresponsible luck.",
  "Two cars went sideways. {racer} threaded the gap and didn't spill a drop of imaginary coffee.",
  "{racer} avoided a loose wheel by about a heartbeat. We call that a strategy now.",
  "An explosion lit up the rearview mirror of {racer}. The driver chose not to investigate.",
  "{racer} just drove under a falling sign frame. For once, being short was useful.",
  "Race control has reviewed {racer}'s escape. The official explanation is 'somehow.'",
  "{racer} dodged the debris and gained absolutely no wisdom from the experience.",
  "One more close call for {racer}. That luck meter should be illegal.",
  "{racer} survived a near miss that the engineers are refusing to explain.",
  "The road vanished behind {racer} exactly one second after the tires crossed it.",
  "A swinging chain missed {racer}'s cockpit by a whisker. Nobody is admitting responsibility.",
  "{racer} slipped past a wreck on two wheels, then settled back onto four like nothing happened.",
  "Somebody launched a hubcap across the track. {racer} ducked without letting go of the wheel.",
  "{racer} cleared that obstacle so cleanly the commentator has requested a replay.",
  "That flaming tire chose somebody other than {racer}. Nice to see luck making decisions.",
  "{racer} emerged from the dust completely unharmed. Honestly, this is getting suspicious."
]);

// A tiny per-run shuffle bag prevents repeat jokes until a pool is exhausted.
function drawUnseen(pool, bag, randomInt = cryptoRandomInt) {
  if (!bag.length) {
    for (let i = 0; i < pool.length; i += 1) bag.push(i);
  }
  const index = randomInt(bag.length);
  const [selected] = bag.splice(index, 1);
  return pool[selected];
}

function createSquigwreckPresentationState() {
  return { radioBag: [], cameoBag: [], roundsCompleted: 0 };
}

function chooseSquigwreckBroadcast({ aliveIds, nameOf, state, formatName = escapeDiscordName, randomInt = cryptoRandomInt }) {
  // Never interrupt the Final Lap or the final one-racer result.
  if (!state || !Array.isArray(aliveIds) || aliveIds.length <= 2) return null;
  if (typeof nameOf !== "function") return null;

  const roll = randomInt(100);
  if (roll < RADIO_CHANCE_PERCENT) {
    return {
      type: "radio",
      text: "📻 **SQUIGWRECK RACE RADIO**\n*" +
        drawUnseen(RADIO_LINES, state.radioBag, randomInt) + "*",
    };
  }

  if (roll < RADIO_CHANCE_PERCENT + CAMEO_CHANCE_PERCENT) {
    const chosenId = aliveIds[randomInt(aliveIds.length)];
    const safeName = formatName(nameOf(chosenId));
    const line = drawUnseen(CAMEO_LINES, state.cameoBag, randomInt)
      .replace(/\{racer\}/g, safeName);
    return {
      type: "cameo",
      racerId: chosenId,
      text: "🍀 **LUCKY BASTARD OF THE ROUND**\n*" + line + "*",
    };
  }
  return null;
}

function squigwreckChampionDescription({ story, winnerName, racersEntered, roundsCompleted, formatName = escapeDiscordName }) {
  const safeWinner = formatName(winnerName);
  const total = Math.max(1, Math.trunc(Number(racersEntered) || 1));
  const rounds = Math.max(0, Math.trunc(Number(roundsCompleted) || 0));
  return String(story).replace(/<winner>/g, safeWinner) +
    "\n\n🏁 **OFFICIAL RACE RECORD**" +
    "\n**Racers entered:** " + total +
    "\n**Racers eliminated:** " + (total - 1) +
    "\n**Race rounds completed:** " + rounds +
    "\n**Finish:** 🥇 1st";
}

module.exports = {
  RADIO_CHANCE_PERCENT,
  CAMEO_CHANCE_PERCENT,
  RADIO_LINES,
  CAMEO_LINES,
  createSquigwreckPresentationState,
  chooseSquigwreckBroadcast,
  squigwreckChampionDescription,
};
