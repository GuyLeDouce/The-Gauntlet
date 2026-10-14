"use strict";
// Narration follows the engine's victims; it never chooses deaths or awards kills.
const { randomInt: cryptoRandomInt } = require("node:crypto");
const { escapeDiscordName, eliminatedName } = require("./deathRace");

const SOLO = Object.freeze([
  "The nitrous gauge disappears into the red. <player1> punches the boost anyway, launches over the barrier, and detonates against a bridge support. The radio broadcasts one last 'WATCH THIS.' We watched it.",
  "A loose grenade rolls beneath the pedals of <player1>. One panicked stomp, one missing pin, and the cockpit bursts open at full speed. The car finishes the corner without a driver alive inside.",
  "Upside down above the jump, <player1> discovers the roof gun weighs more than the suspension. The car lands on its cockpit and burns across the landing ramp. Flying was the easy part.",
  "The shortcut ends at a steel blast door. <player1> fires a rocket to open it from six feet away. The door survives; the driver and cockpit do not. Knock next time.",
  "With the throttle jammed open, <player1> tries steering through a wall of wrecks. A jagged axle punches through the cockpit, and the fuel tank ignites behind it. The road collects another permanent resident.",
  "A roof cannon jams just as <player1> squeezes the trigger. The loaded breech explodes into the cabin, killing the driver and sending the empty car spinning through the pit lane. Maintenance was apparently optional too.",
  "Sparks turn to flames under <player1>'s shredded tires. The bare rims catch a drainage grate, pitching the cockpit into the concrete. The driver dies on impact. Four wheels would have been useful here.",
  "The bridge jump needs one more gear than <player1> has left. The car clips the far edge, flips backward, and explodes on the rocks below. Gravity remains undefeated.",
  "An abandoned tanker looks like excellent cover to <player1>. The racer plows beneath it just as the burning tank collapses. Driver and car vanish under a mountain of flaming steel. Excellent cover. Terrible exit.",
  "A stolen targeting computer locks onto the nearest engine: its own. <player1> launches before reading the warning. The missile loops into the cockpit and ends the race in a remarkably personal explosion.",
  "The steering wheel comes off in <player1>'s hands halfway through the hairpin. The racer holds it up in disbelief while the car barrels into the cliff face. The fatal wreck still has a perfectly good steering wheel.",
  "Trying to shake a mine off the hood, <player1> hits the brakes hard. The mine slides into the exposed engine and explodes through the cabin. Driver eliminated. Brakes technically working.",
]);

// Slots describe roles, not positions in the engine's victim array.
const KILLS = Object.freeze([
  "Through the smoke, <player1> lines up the roof gun and stitches bullets across <player2>'s cockpit. The victim's car folds into a barrier and burns. The shooter kicks the empty ammo box into the road and keeps racing.",
  "A harpoon from <player1> punches through <player2>'s rear axle. One hard turn drags the hooked car sideways into a bridge pillar, crushing its driver. The cable snaps loose; the killer takes the next corner alone.",
  "Side by side at full throttle, <player1> shoves a grenade through <player2>'s shattered window. The doomed racer swerves into the divider and explodes. The attacker waves through the smoke. Customer service is appalling.",
  "The gap closes as <player1> pins <player2> against the concrete wall. Armor peels away, then the cockpit caves in, killing the trapped driver. The attacker pulls free with half a door missing and a whole lot of road ahead.",
  "A fake surrender draws <player2> alongside. <player1> answers the offered truce with a point-blank cannon shot through the cabin. The victim's wreck rolls away burning while the liar accelerates. Negotiations concluded.",
  "From behind the wreck pile, <player1> fires a rocket into <player2>'s fuel tank. The cockpit disappears inside the blast. The ambusher charges through the falling sparks, still alive and absolutely proud of that bullshit.",
  "The flamethrower on <player1>'s hood catches <player2>'s exposed fuel line. Fire races into the cabin before the victim can break away. The killer leaves the burning wreck in the mirror and hunts the next bend.",
  "At the ramp, <player1> lands the front ram straight through <player2>'s cockpit. The crushed driver never reaches the landing straight. The attacker bounces clear on ruined suspension and keeps the throttle pinned.",
  "A bumper mine drops from <player1> directly beneath <player2>'s front wheels. The blast flips the pursuing car roof-first into a steel beam, killing its driver. The cheat never even touches the brakes.",
  "Running out of bullets, <player1> uses the gun as bait and the car as a weapon. <player2> dodges the muzzle, catches the front ram, and tumbles into the canyon. The driver dies on the rocks; the attacker keeps the racing line.",
]);

const KILLED_BY = Object.freeze([
  "The ambush starts well for <player1> until <player2> answers with a shotgun through the open side window. The attacker dies as the car drifts into a burning barricade. The intended victim drives away with the last laugh.",
  "A rocket leaves <player1>'s launcher and misses. Beside the smoking tube, <player2> hooks the attacker's wheel and yanks it into the divider. The cockpit folds around its driver. The counterattack costs one harpoon and ends one career.",
  "Leaning out to taunt <player2>, <player1> gets a cannon shell through the engine bay. The blast tears into the cabin and kills the loudmouth. The shooter overtakes the wreck. The radio is suddenly much nicer.",
  "The stolen shortcut map sends <player1> into the perfect kill zone. Waiting above the road, <player2> drops a demolition charge onto the roof. The cabin explodes; the trap's owner guns down the access ramp and rejoins the race.",
  "Trying to ram <player2> off the bridge, <player1> catches a grappling cable around the front axle. The defender swings the hooked car over the edge and cuts the line. The fall kills the attacker. Nice shove. Better reply.",
  "Muzzle flashes betray <player1> in the dark tunnel. <player2> aims at the flashes and empties the roof gun through the cabin. The dead driver's car scrapes along the wall while the shooter blasts past.",
  "A flamethrower washes over <player2>'s armor. The scorched racer fires straight into <player1>'s weapon tank, engulfing the attacker in a fatal blast. The defender rolls clear trailing smoke. Hot enough for you?",
  "The bumper hooks are supposed to trap <player2>. Instead, the defender brakes hard and swings <player1> nose-first into a concrete pillar. The driver's cockpit collapses. The killer tears free and takes the corner with a new dent.",
  "A fake truce from <player1> fools absolutely nobody. <player2> fires through the windshield before the hidden grenade leaves the liar's hand. The attacker dies in the ensuing blast. Diplomacy has been declined.",
  "Charging out of the dust, <player1> sights the next victim. <player2> drops an oil slick, lights it, and swerves away. The attacker spins into the flaming wreck pile and dies trapped in the cabin. Pick another victim next life.",
]);

const DOUBLE_KILL = Object.freeze([
  "Two cars squeeze into the tunnel ahead of <player1>. One rocket splits the gap between <player2> and <player3>, blowing both cabins apart. The shooter charges through the falling debris. Two rivals gone. One beautifully ugly shot.",
  "The alliance between <player2> and <player3> lasts until <player1> fires into the fuel tanker between them. Burning steel crashes onto both cockpits, killing both drivers. The attacker cuts through the service lane. Friendship had a blast.",
  "A tow chain joins <player2> and <player3> for a two-car assault. <player1> hooks the chain with a harpoon and swings both attackers into the crusher wall. Both cabins collapse; the defender releases the cable and races on.",
  "From the high lane, <player1> fires out the supports beneath <player2> and <player3>. Their cars drop through the collapsing roadway and explode in the drainage pit. The shooter takes the intact ramp. Infrastructure complaint resolved.",
  "Pinned between <player2> and <player3>, <player1> launches a mine from each side pod. Twin blasts tear into the attackers' cabins and kill both drivers. The battered middle car pulls clear. Personal space restored.",
  "The cannon on <player1>'s roof tracks two overlapping cars. The shell punches through <player2>'s cockpit and detonates inside <player3>'s ammo rack. Both drivers die; the gunner shoulders through the smoke. Collateral damage was the entire point.",
  "A fake route signal from <player1> sends <player2> and <player3> onto a mined service road. The cheat waits until both cars commit, then hits the detonator. Both cabins vanish in the blast. The real route remains conveniently open.",
  "At the hairpin, <player1> rams <player2> into <player3>'s door. The tangled rivals crash through the guardrail and die on the quarry floor. The attacker countersteers back onto the road with two fewer problems.",
  "The flamethrower swings across both lanes as <player1> pulls behind <player2> and <player3>. Their exposed tanks ignite, and the trapped drivers perish inside the burning cabins. The attacker cuts away before the tanks burst. Efficient. Disgusting. Effective.",
  "Both <player2> and <player3> chase the empty decoy car into a narrow alley. Above them, <player1> shoots loose a suspended concrete slab. It crushes both cockpits. The ambusher rejoins the main road without a scratch. Bait accepted.",
  "One harpoon pins <player2> to <player3>'s rear armor. <player1> drops a grenade between the linked cars and accelerates clear. The blast kills both trapped drivers. The shooter's radio crackles: 'Buy one, get one fucked.'",
  "At the broken bridge, <player1> elbows <player2> into <player3>'s takeoff line. The two rivals collide in midair and smash into the canyon wall, killing both drivers. The attacker lands alone, suspension screaming louder than the victory laugh.",
]);

const SCENARIOS = Object.freeze({
  solo: Object.freeze({ stories: SOLO, deadSlots: [1] }),
  mutual: Object.freeze({ deadSlots: [1, 2] }),
  kills: Object.freeze({ stories: KILLS, deadSlots: [2] }),
  killedBy: Object.freeze({ stories: KILLED_BY, deadSlots: [1] }),
  doubleKill: Object.freeze({ stories: DOUBLE_KILL, deadSlots: [2, 3] }),
});
const TYPES = Object.freeze(Object.keys(SCENARIOS));
const FINAL_FINISH = "<winner> bursts out of the smoke with armor dragging and the engine screaming. No rival engine answers. The battered car crosses the finish line: the last racer alive.";

function createRaceNarrativeState() { return { bags: {} }; }
function draw(key, values, state, randomInt) {
  if (!state.bags[key]?.length) state.bags[key] = values.map((_, index) => index);
  const bag = state.bags[key];
  return values[bag.splice(randomInt(bag.length), 1)[0]];
}
function renderScenario(type, template, names) {
  const dead = SCENARIOS[type]?.deadSlots;
  if (!dead) throw new Error("Unknown Death Race scenario");
  return template.replace(/<player([123])>/g, (_, slot) => {
    if (names[Number(slot) - 1] == null) throw new Error("Missing scenario racer");
    return dead.includes(Number(slot))
      ? eliminatedName(names[Number(slot) - 1])
      : escapeDiscordName(names[Number(slot) - 1]);
  });
}

function buildRaceRoundNarrative({ removedIds, aliveIds, nameOf, stage, state, randomInt = cryptoRandomInt }) {
  if (!Array.isArray(removedIds) || ![1, 2].includes(removedIds.length) || !aliveIds?.length ||
      new Set([...removedIds, ...aliveIds]).size !== removedIds.length + aliveIds.length) {
    throw new Error("Narrative requires distinct victims and surviving racers");
  }
  const finalLap = aliveIds.length === 1;
  // A two-racer finale has one victim; a three-racer finale still has two.
  const eligible = removedIds.length === 1 ? ["solo", "kills", "killedBy"] : TYPES;
  const type = draw(`types:${removedIds.length}`, eligible, state, randomInt);
  const events = [];
  const killerId = type === "kills" || type === "killedBy" || type === "doubleKill"
    ? aliveIds[randomInt(aliveIds.length)] : null;
  if (type === "mutual") {
    events.push(renderScenario(type, stage.story, removedIds.map(nameOf)));
  } else if (type === "doubleKill") {
    events.push(renderScenario(type, draw(type, DOUBLE_KILL, state, randomInt), [killerId, ...removedIds].map(nameOf)));
  } else {
    // Two one-victim scenes share the SAME milestone panel and only use living killers.
    for (const victim of removedIds) {
      const roles = type === "solo" ? [victim] : type === "kills" ? [killerId, victim] : [victim, killerId];
      events.push(renderScenario(type, draw(type, SCENARIOS[type].stories, state, randomInt), roles.map(nameOf)));
    }
  }
  if (finalLap) events.push(FINAL_FINISH.replace("<winner>", escapeDiscordName(nameOf(aliveIds[0]))));
  return { type, finalLap, events, story: events.join("\n\n") };
}

module.exports = { SCENARIOS, FINAL_FINISH, createRaceNarrativeState, renderScenario, buildRaceRoundNarrative };
