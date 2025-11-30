// survivalStories.js
// Re-usable story templates for Squig Survival.
// {victim} and {killer} will be replaced with user mentions (victims get crossed out in survival.js).

module.exports = {
  hidingSpots: [
    // ORIGINAL vibe, but varied placement
    "While exploring a suburban kitchen, {victim} mistook the garbage disposal for a cozy relaxation chamber.",
    "The ceiling fan spun three full rotations before launching {victim} across the room like a confused frisbee.",
    "A washing machine filled with warm water seemed inviting… until the spin cycle claimed {victim}.",
    "After blending in as a decorative lawn ornament, {victim} was eaten alive by a lawn mower.",
    "A vending machine accepted coins… and then accepted {victim}. Someone bought them with exact change.",
    "Inside the recycling bin, {victim} was compressed into what environmentalists proudly called ‘efficient storage’.",
    "After spending an hour posing as a gnome, {victim} was swallowed by an overenthusiastic leaf blower.",
    "The microwave hummed gently while {victim} sat inside calling it a ‘warm safe cave’. Popcorn mode disagreed.",

    // New – mid-sentence victim placements
    "A zoo worker screamed when they noticed {victim} hiding among the flamingos—and the flamingos finished the job.",
    "The moment a human opened the backpack, {victim} tumbled out and down a flight of school stairs.",
    "Someone restocked the claw machine and didn’t notice {victim} buried under a mountain of plushies.",
    "The cereal box rattled suspiciously before {victim} was poured out with breakfast.",
    "A patio chair collapsed when {victim} tried nesting inside one of the hollow legs.",
    "The lava lamp bubbled peacefully while {victim} slowly dissolved into psychedelic goo.",
    "A shipping label slapped onto a box sealed {victim} inside, and the delivery truck handled the rest.",
    "A Halloween decoration bin swallowed {victim} moments before the lid slammed shut forever.",

    // New – late story / portal collapse
    "As portals flickered above them, {victim} hid under a blanket fort—right as it collapsed into a space heater.",
    "Trying to avoid detection, {victim} retreated into a stack of portal crystals, which promptly imploded.",
  ],

  clumsiness: [
    // ORIGINAL vibe, but varied structure
    "Bird poop, gravity, and one bad step combined to send {victim} plummeting twelve stories.",
    "A basement stair decided to move slightly, causing {victim} to cartwheel into a mousetrap.",
    "That shiny reflection in the window? {victim} chased it straight off a windowsill.",
    "Leaning casually against a wall works better when the wall isn’t an unstable curtain, as {victim} discovered.",
    "{victim} froze at a ‘Caution: Wet Floor’ sign and accidentally sprinted into a doorframe.",
    "{victim} attempted a bold parkour flip and learned the ceiling was, unfortunately, not foam.",
    "One potato chip on the floor sent {victim} sliding into a plugged-in heater.",
    "The kiddie pool was only six inches deep; {victim} dove like it was the Mariana Trench.",

    // New – mixed placement
    "An escalator ate a shoelace and {victim} along with it.",
    "The revolving door spun a bit too fast and flung {victim} across the lobby.",
    "Black ice claimed another victim: {victim}, who attempted a majestic moonwalk.",
    "Crossing the street while staring at shiny things is how {victim} met their end.",
    "The Roomba, after years of patience, finally pushed {victim} off a balcony.",
    "An office chair rotated faster than physics intended, slingshotting {victim} into a bookshelf.",
    "While doomscrolling, {victim} walked into two lampposts—the second one did them in.",
    "A skateboard trick failed so violently that {victim} achieved viral status for all the wrong reasons.",

    // New – late story / fading portals
    "When a portal glitch rippled across the living room, {victim} stepped into it thinking it was Wi-Fi lag.",
  ],

  sabotage: [
    // ORIGINAL vibe, but more variety in placement
    "{killer} shoved {victim} into a mailbox ‘for safety’, and the mailman handled the rest.",
    "The ceiling fan spun dangerously fast, especially after {killer} boosted {victim} onto it.",
    "{victim} received a high-five from {killer} that sent them tumbling into traffic.",
    "{killer} insisted the blender was a tiny teleportation gate, and {victim} dove in headfirst.",
    "After tying shoelaces together, {killer} watched {victim} stumble into an open sewer.",
    "‘Red buttons are always safe,’ said {killer}, moments before {victim} slapped the fire alarm.",
    "{killer} pushed {victim} into an electric fence, swearing it was ‘definitely off’.",
    "‘Blend in with the fireworks,’ {killer} said. {victim} did not blend in.",

    // New – early sabotage
    "The door didn’t stand a chance once {killer} dared {victim} to headbutt it like humans do.",
    "{killer} told {victim} that crossing the street on red lights earns bonus points.",
    "A swarm of sparrows descended on {victim} after {killer} recommended the bird feeder as a hiding spot.",
    "{killer} nudged {victim} under a hammock right as three humans decided to test it.",
    "‘Zipline to freedom!’ shouted {killer}, pushing {victim} down a clothesline.",
    "{killer} encouraged {victim} to hug a cyclist from behind. The cyclist had other plans.",

    // New – mid game / Web3 degen life
    "{killer} told {victim} the drone would provide great aerial footage; it did, right until the crash.",
    "Microwaving metal wasn’t a great idea, but {killer} insisted it was how humans charge devices.",
    "{killer} stuffed {victim} into a piñata ‘for the vibe’ at a birthday party.",
    "‘Rug pulls are fun!’ laughed {killer}, yanking the carpet out from under {victim}.",
    "{killer} dared {victim} to dive into a conversation thread by leaping across a stairwell.",
    "{killer} led {victim} confidently toward an automatic door that wasn’t automatic.",
    "{killer} signed {victim} up for halftime mascot stunts without telling them.",
    "A rideshare car roof seemed safe until {killer} declared it a surfing challenge for {victim}.",

    // New – late story / portal collapse
    "The portal crackled ominously as {killer} pushed {victim} forward to ‘test the stability’.",
    "{killer} told {victim} to crawl into the portal stabilizer to ‘fix the signal’, then flipped random switches.",
    "A reality glitch shimmered; {killer} swore it was harmless and shoved {victim} straight into it.",
    "{killer} reassured {victim} the closing portal was ‘just a visual effect’ before nudging them inside.",
  ],
  resurrections: [
    // Early game
    "A tiny spark pops out of the unstable portal… and {victim} rematerializes with a confused scream.",
    "{victim} is vomited back into existence after the portal hiccups violently.",
    "A glitch ripples across the skyline — when it clears, {victim} is standing there like nothing happened.",

    // Mid-game
    "Two humans argue near a portal shard, causing an energy spike that resurrects {victim}.",
    "A burst of raw cosmic energy shoots out of a cracked portal crystal, reforming {victim} molecule by molecule.",
    "A malfunctioning Wi-Fi router boosts the portal signal and brings {victim} back to life.",

    // Late-game
    "The collapsing portal pulses one last time, ejecting {victim} back onto Earth.",
    "Reality stutters, rewinds, and plays again — suddenly {victim} is alive.",
    "A shard of portal glass detonates, rebooting {victim}’s existence.",

    // Ultra rare / chaotic
    "A cosmic checksum error restores {victim} with absolutely no explanation.",
    "{victim} is reconstructed from corrupted Squig data and walks out looking slightly pixelated.",
    "The backup emergency portal activates and spits out {victim}, who seems disappointed to be back.",
  ],
};

