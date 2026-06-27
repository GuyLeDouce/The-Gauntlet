// survivalEras.js
// Era-specific Squig Survival content. Shared images stay in the engine.

const DAY_ONE_LORE_LINES = [
  "🌀 {player} tries coffee for the first time and decides it is \"spicy water.\"",
  "🛒 {player} discovers grocery carts and insists they are \"metal steeds.\"",
  "📱 {player} scrolls for three hours and calls it \"research.\"",
  "🍕 {player} argues pineapple improves portals.",
  "🧦 {player} collects socks and declares them \"Earth skins.\"",
  "🎧 {player} hears lo-fi beats and refuses to stop vibing.",
  "🚌 {player} boards the wrong bus and calls it \"quest mode.\"",
  "🧴 {player} learns sunscreen exists and applies it to a hat.",
  "🧊 {player} meets ice for the first time and distrusts it.",
  "🪙 {player} trades a shiny pebble for a real coin and feels powerful.",
  "🧠 {player} reads a self-help book and still chooses chaos.",
  "🐸 {player} tries to befriend a frog and gets judged.",
  "🕶️ {player} buys sunglasses and claims \"the sun is rude.\"",
  "🍔 {player} believes burgers are a cultural handshake.",
  "🧼 {player} learns \"soap\" and becomes briefly unstoppable.",
  "🚦 {player} stares at traffic lights like they're speaking in riddles.",
  "📦 {player} discovers cardboard boxes are \"cozy portals.\"",
  "💤 {player} naps in public and calls it \"social camouflage.\"",
  "🎢 {player} rides a rollercoaster and rethinks gravity.",
  "📺 {player} watches a sitcom and decides humans are \"strange but funny.\"",
  "The day is calmer when {player} decides to simply people-watch.",
  "A vending machine teaches {player} the meaning of patience.",
  "Someone hands {player} a receipt and they keep it as a trophy.",
  "A pigeon stares back at {player}. They negotiate a truce.",
  "Today, {player} discovers escalators and calls them \"lazy stairs.\"",
  "An elevator stops. {player} bows out of respect.",
  "A hoodie becomes a ceremonial robe for {player}.",
  "The word \"brunch\" confuses {player} for 12 minutes.",
  "At the crosswalk, {player} misreads the tiny person as a warning sprite.",
  "On a walk, {player} decides sidewalks are \"ground rivers.\"",
  "A delivery driver nods at {player}. Diplomatic relations established.",
  "A subway map makes {player} feel briefly omniscient.",
  "A paper clip becomes a relic in {player}'s pocket.",
  "{player} declares socks optional and is immediately corrected by a breeze.",
  "A park bench adopts {player} for a quiet moment.",
  "The moon gets a casual wave from {player}. It does not wave back.",
  "Today, {player} learns the power of a good playlist.",
  "A rainy day turns {player}'s footsteps into percussion.",
  "A QR code confuses {player} and delights them anyway.",
  "A smoothie tastes like \"fruit lightning\" to {player}.",
  "A cat ignores {player}. This is taken as wisdom.",
  "A doorway welcomes {player} with a dramatic swoosh.",
  "A scarf becomes a cape, and {player} takes it seriously.",
  "A bakery aroma convinces {player} that Earth is worth it.",
  "A street musician inspires {player} to hum in Squig.",
  "Today, {player} decides that notebooks are sacred.",
  "A mailbox becomes {player}'s sworn enemy for five minutes.",
  "A carousel makes {player} consider spinning as a lifestyle.",
  "A mirror startles {player} with unexpected handsomeness.",
  "A water fountain teaches {player} to trust buttons.",
];

const DAY_ONE_MILESTONE_STAGES = [
  {
    title: "Landing Day 1 - First Impact",
    flavor:
      "Fresh from the portal, the Squigs splatter into Earth's atmosphere like confused cosmic confetti.",
  },
  {
    title: "Month 1 on Earth - First Confusion",
    flavor:
      "The Squigs are still learning gravity, weather, and why humans keep putting pineapple on pizza.",
  },
  {
    title: "Month 2 on Earth - Bad Influences",
    flavor:
      "They discover social media, NFTs, and the horrifying power of quote-tweets.",
  },
  {
    title: "Month 3 on Earth - Questionable Hobbies",
    flavor:
      "Some Squigs start side hustles. Others become professional lurkers. All of them are still extremely weird.",
  },
  {
    title: "Month 4 on Earth - Full Degeneracy",
    flavor:
      "Sleep schedules are gone. Caffeine is up. Decisions are... not always good ones.",
  },
  {
    title: "Month 5 on Earth - The Great Overthink",
    flavor:
      "The Squigs begin to wonder if humans actually know what they're doing. Signs point to 'no'.",
  },
  {
    title: "Month 6 on Earth - Vanishing Acts",
    flavor:
      "One by one, Squigs disappear into strange side quests, mysterious DMs, and badly-timed adventures.",
  },
  {
    title: "Last Known Squig Presence on Earth",
    flavor:
      "The portals flicker. Transmission logs corrupt. Only a handful of Squigs remain to tell the tale.",
  },
];

const DAY_ONE_STORIES = {
  hidingSpots: [
    "While exploring a suburban kitchen, {victim} mistook the garbage disposal for a cozy relaxation chamber.",
    "The ceiling fan spun three full rotations before launching {victim} across the room like a confused frisbee.",
    "A washing machine filled with warm water seemed inviting… until the spin cycle claimed {victim}.",
    "After blending in as a decorative lawn ornament, {victim} was eaten alive by a lawn mower.",
    "A vending machine accepted coins… and then accepted {victim}. Someone bought them with exact change.",
    "Inside the recycling bin, {victim} was compressed into what environmentalists proudly called ‘efficient storage’.",
    "After spending an hour posing as a gnome, {victim} was swallowed by an overenthusiastic leaf blower.",
    "The microwave hummed gently while {victim} sat inside calling it a ‘warm safe cave’. Popcorn mode disagreed.",
    "A zoo worker screamed when they noticed {victim} hiding among the flamingos—and the flamingos finished the job.",
    "The moment a human opened the backpack, {victim} tumbled out and down a flight of school stairs.",
    "Someone restocked the claw machine and didn’t notice {victim} buried under a mountain of plushies.",
    "The cereal box rattled suspiciously before {victim} was poured out with breakfast.",
    "A patio chair collapsed when {victim} tried nesting inside one of the hollow legs.",
    "The lava lamp bubbled peacefully while {victim} slowly dissolved into psychedelic goo.",
    "A shipping label slapped onto a box sealed {victim} inside, and the delivery truck handled the rest.",
    "A Halloween decoration bin swallowed {victim} moments before the lid slammed shut forever.",
    "As portals flickered above them, {victim} hid under a blanket fort—right as it collapsed into a space heater.",
    "Trying to avoid detection, {victim} retreated into a stack of portal crystals, which promptly imploded.",
    "A linen closet seemed safe until the vacuum turned on and claimed {victim}.",
    "Under a park slide, {victim} found shelter just before a skateboard wiped them out.",
    "A toolbox lid slammed shut on {victim}, and the rest was gravity.",
    "The couch springs were cozy until {victim} vanished into the cushions forever.",
    "Inside a doghouse, {victim} learned that not all residents share.",
    "A cardboard fort looked sturdy until a cat launched itself through it and {victim} followed.",
    "The trunk of a parked car became a hiding place, then it became a ride.",
    "A pizza oven door closed softly and {victim} discovered the heat setting.",
    "The attic was peaceful until a loose board gave way beneath {victim}.",
    "In the mailbox, {victim} was collected with the junk mail.",
    "Behind the stage curtain, {victim} was crushed by a falling prop.",
    "A fridge hum promised safety, then {victim} met the freezer fan.",
    "Under a bed, {victim} found dust, shadows, and a vacuum.",
    "A coat rack toppled as {victim} climbed it for cover.",
    "A storage bin clicked shut, trapping {victim} with the holiday lights.",
  ],
  clumsiness: [
    "Bird poop, gravity, and one bad step combined to send {victim} plummeting twelve stories.",
    "A basement stair decided to move slightly, causing {victim} to cartwheel into a mousetrap.",
    "That shiny reflection in the window? {victim} chased it straight off a windowsill.",
    "Leaning casually against a wall works better when the wall isn’t an unstable curtain, as {victim} discovered.",
    "{victim} froze at a ‘Caution: Wet Floor’ sign and accidentally sprinted into a doorframe.",
    "{victim} attempted a bold parkour flip and learned the ceiling was, unfortunately, not foam.",
    "One potato chip on the floor sent {victim} sliding into a plugged-in heater.",
    "The kiddie pool was only six inches deep; {victim} dove like it was the Mariana Trench.",
    "An escalator ate a shoelace and {victim} along with it.",
    "The revolving door spun a bit too fast and flung {victim} across the lobby.",
    "Black ice claimed another victim: {victim}, who attempted a majestic moonwalk.",
    "Crossing the street while staring at shiny things is how {victim} met their end.",
    "The Roomba, after years of patience, finally pushed {victim} off a balcony.",
    "An office chair rotated faster than physics intended, slingshotting {victim} into a bookshelf.",
    "While doomscrolling, {victim} walked into two lampposts—the second one did them in.",
    "A skateboard trick failed so violently that {victim} achieved viral status for all the wrong reasons.",
    "When a portal glitch rippled across the living room, {victim} stepped into it thinking it was Wi-Fi lag.",
    "A slick banana peel turned {victim} into a cautionary tale.",
    "{victim} tripped on a charging cable and face-planted into a toolbox.",
    "A wet umbrella stand spun out and smacked {victim} squarely.",
    "The automatic doors closed faster than {victim} could react.",
    "A wobbling ladder tipped and {victim} went with it.",
    "{victim} tried to sit on a rolling chair and missed the chair.",
    "A jump-scare sneeze launched {victim} into a glass table.",
    "{victim} slipped on a spilled soda and skidded into a display rack.",
    "A loose rug corner hooked {victim} at full sprint.",
    "Staring at fireworks, {victim} walked straight into a fountain.",
    "{victim} fell off a curb so dramatically that gravity took offense.",
    "A slippery stair railing turned {victim} into a human pinball.",
    "{victim} attempted to high-five a passing cyclist and lost balance.",
    "A spinning ceiling fan met {victim} mid-jump.",
    "{victim} backed up to admire a mural and stepped off the edge.",
  ],
  sabotage: [
    "{killer} shoved {victim} into a mailbox ‘for safety’, and the mailman handled the rest.",
    "The ceiling fan spun dangerously fast, especially after {killer} boosted {victim} onto it.",
    "{victim} received a high-five from {killer} that sent them tumbling into traffic.",
    "{killer} insisted the blender was a tiny teleportation gate, and {victim} dove in headfirst.",
    "After tying shoelaces together, {killer} watched {victim} stumble into an open sewer.",
    "‘Red buttons are always safe,’ said {killer}, moments before {victim} slapped the fire alarm.",
    "{killer} pushed {victim} into an electric fence, swearing it was ‘definitely off’.",
    "‘Blend in with the fireworks,’ {killer} said. {victim} did not blend in.",
    "The door didn’t stand a chance once {killer} dared {victim} to headbutt it like humans do.",
    "{killer} told {victim} that crossing the street on red lights earns bonus points.",
    "A swarm of sparrows descended on {victim} after {killer} recommended the bird feeder as a hiding spot.",
    "{killer} nudged {victim} under a hammock right as three humans decided to test it.",
    "‘Zipline to freedom!’ shouted {killer}, pushing {victim} down a clothesline.",
    "{killer} encouraged {victim} to hug a cyclist from behind. The cyclist had other plans.",
    "{killer} told {victim} the drone would provide great aerial footage; it did, right until the crash.",
    "Microwaving metal wasn’t a great idea, but {killer} insisted it was how humans charge devices.",
    "{killer} stuffed {victim} into a piñata ‘for the vibe’ at a birthday party.",
    "‘Rug pulls are fun!’ laughed {killer}, yanking the carpet out from under {victim}.",
    "{killer} dared {victim} to dive into a conversation thread by leaping across a stairwell.",
    "{killer} led {victim} confidently toward an automatic door that wasn’t automatic.",
    "{killer} signed {victim} up for halftime mascot stunts without telling them.",
    "A rideshare car roof seemed safe until {killer} declared it a surfing challenge for {victim}.",
    "The portal crackled ominously as {killer} pushed {victim} forward to ‘test the stability’.",
    "{killer} told {victim} to crawl into the portal stabilizer to ‘fix the signal’, then flipped random switches.",
    "A reality glitch shimmered; {killer} swore it was harmless and shoved {victim} straight into it.",
    "{killer} reassured {victim} the closing portal was ‘just a visual effect’ before nudging them inside.",
    "{killer} convinced {victim} the treadmill was a teleport pad.",
    "A shopping cart downhill race ended when {killer} gave {victim} a push.",
    "{killer} swapped the parachute for a bedsheet and wished {victim} luck.",
    "{killer} told {victim} the fireworks were safe to hug.",
    "‘Try the spicy chip challenge,’ said {killer}, as {victim} blacked out.",
    "{killer} dropped a magnet onto the circuit board {victim} was holding.",
    "{killer} insisted the escalator was a slide and {victim} believed them.",
    "{killer} dared {victim} to race the closing elevator doors.",
    "{killer} used {victim} as a bowling ball on a stairwell.",
    "{killer} handed {victim} a ‘safe’ sparkler that was actually a fuse.",
    "{killer} whispered ‘trust the skateboard,’ then yanked it away from {victim}.",
    "{killer} tossed {victim} a mystery drink labeled ‘speed potion’.",
    "{killer} blamed the map and sent {victim} straight into a dead end alley.",
    "{killer} offered {victim} a selfie stick that snapped like a trap.",
    "{killer} held the door for {victim}—right into a closing garbage compactor.",
  ],
  resurrections: [
    "A tiny spark pops out of the unstable portal… and {victim} rematerializes with a confused scream.",
    "{victim} is vomited back into existence after the portal hiccups violently.",
    "A glitch ripples across the skyline — when it clears, {victim} is standing there like nothing happened.",
    "Two humans argue near a portal shard, causing an energy spike that resurrects {victim}.",
    "A burst of raw cosmic energy shoots out of a cracked portal crystal, reforming {victim} molecule by molecule.",
    "A malfunctioning Wi-Fi router boosts the portal signal and brings {victim} back to life.",
    "The collapsing portal pulses one last time, ejecting {victim} back onto Earth.",
    "Reality stutters, rewinds, and plays again — suddenly {victim} is alive.",
    "A shard of portal glass detonates, rebooting {victim}’s existence.",
    "A cosmic checksum error restores {victim} with absolutely no explanation.",
    "{victim} is reconstructed from corrupted Squig data and walks out looking slightly pixelated.",
    "The backup emergency portal activates and spits out {victim}, who seems disappointed to be back.",
    "An email labeled 'Undo' arrives, and {victim} clicks it out of curiosity.",
    "A bored human says 'manifest' and {victim} pops back into reality.",
    "A cat walks across a keyboard and accidentally respawns {victim}.",
    "The portal sneezes, ejecting {victim} like a cosmic booger.",
    "A microwave beeps three times; {victim} reappears fully reheated.",
    "A glitchy elevator dings and {victim} steps out, confused and alive.",
    "Someone hits refresh on the universe and {victim} loads back in.",
    "The Wi-Fi reconnects and {victim} stops buffering back into existence.",
    "A vending machine refunds the wrong item: {victim}.",
    "The fog machine at a concert coughs out {victim} mid-chorus.",
    "A portal shard rolls under a couch and rolls out with {victim}.",
    "A QR code scans itself and summons {victim} by mistake.",
    "A cosmic receipt prints and returns {victim} with 'NO REFUNDS' stamped.",
    "An espresso shot hits reality and {victim} restarts.",
    "A trampoline boings and {victim} rebounds into the timeline.",
    "A cursed GIF loops, rewinding {victim} back to life.",
    "A plastic skeleton in a yard animates, then hands {victim} their body.",
    "The portal autopilot misfires and drops {victim} back on Earth.",
    "A squirrel steals a portal crystal and trades it for {victim}.",
    "A cosmic pop-up asks 'Restore last session?' and {victim} clicks yes.",
  ],
};

const DAY_ONE_ERA = {
  key: "day_one",
  label: "Day One",
  loreLines: DAY_ONE_LORE_LINES,
  milestoneStages: DAY_ONE_MILESTONE_STAGES,
  stories: DAY_ONE_STORIES,
};

const OFFICE_SQUIGS_LORE_LINES = [
  "☕ {player} learns the break room coffee is not a beverage so much as a disciplinary tool.",
  "🖨️ {player} stares down the printer until both agree this is now a personal feud.",
  "📎 {player} hoards paper clips like rare artifacts from a collapsed civilization.",
  "📅 {player} joins a meeting that could have been a shrug.",
  "🪑 {player} spins once in an office chair and immediately thinks they understand management.",
  "📊 {player} adds a pie chart to a report and calls it leadership.",
  "💼 {player} carries an empty briefcase because it makes the panic look intentional.",
  "📠 {player} discovers the fax machine and assumes it is a cursed flat portal.",
  "🧾 {player} submits an expense report for 'emotional damages from Outlook.'",
  "⌨️ {player} types very fast despite having no idea what the spreadsheet does.",
  "🕘 {player} arrives three minutes early and is praised as a visionary.",
  "🔔 {player} treats every Teams notification like a tiny declaration of war.",
  "📌 {player} pins a memo to a corkboard and calls it strategic alignment.",
  "🖥️ {player} opens nineteen tabs and refers to the chaos as workflow.",
  "🪴 {player} bonds with the office plant because it also looks underpaid.",
  "📈 {player} discovers KPIs and pretends the letters stand for 'Keep Panic Internal.'",
  "🫠 {player} nods through a status update while spiritually leaving the building.",
  "📂 {player} alphabetizes a folder and experiences a dangerous amount of power.",
  "🧍 {player} stands by the copier to seem busy and accidentally becomes part of operations.",
  "🍩 {player} brings donuts and is promoted in the hearts of the people.",
  "📣 {player} says 'circle back' once and immediately feels a little evil.",
  "📝 {player} takes meeting notes that are mostly doodles and one threat against the printer.",
  "🔌 {player} unplugs the wrong charger and learns how quickly peace can die.",
  "📉 {player} sees the quarterly numbers and invents a new facial expression.",
  "🚪 {player} opens a conference room door and interrupts a PowerPoint-based hostage situation.",
  "🧠 {player} realizes the org chart is just a puzzle where everyone loses.",
  "📬 {player} checks the internal mail tray like it might finally contain answers.",
  "🕵️ {player} learns who keeps stealing lunches and gains forbidden knowledge.",
  "🧼 {player} wipes down their desk once and is treated like a sanitation prophet.",
  "🎧 {player} puts on headphones so no one asks them to 'hop on a quick call.'",
  "🪟 {player} gazes out the office window and briefly considers freelance gardening.",
  "📱 {player} pretends to read a Slack thread while actually choosing survival.",
  "🧊 {player} uses the water cooler as both hydration source and intelligence network.",
  "🏷️ {player} prints a badge label and wears it like a military medal.",
  "🗃️ {player} opens the supply closet and whispers, 'So this is where the gods live.'",
  "📺 {player} watches the meeting room display reboot and calls it a morale event.",
  "🔒 {player} discovers the executive washroom and understands class warfare.",
  "🪪 {player} forgets their keycard and spends eight minutes negotiating with a door.",
  "🧍‍♂️ {player} lingers near the snack table long enough to become middle management by accident.",
  "💡 {player} suggests one useful idea and spends the afternoon hiding from follow-up tasks.",
];

const OFFICE_SQUIGS_MILESTONE_STAGES = [
  {
    title: "First Day - Badge Acquired",
    flavor:
      "Fresh from onboarding, the Squigs enter the office with badges, false confidence, and no idea what 'per my last email' means.",
  },
  {
    title: "Week 1 - Break Room Politics",
    flavor:
      "The coffee is toxic, the fridge is lawless, and someone has already labeled yogurt like a territorial warlord.",
  },
  {
    title: "Week 2 - Meeting Bloom",
    flavor:
      "Calendar invites multiply faster than common sense. The Squigs are now trapped in recurring rituals called syncs.",
  },
  {
    title: "Month 1 - Spreadsheet Fever",
    flavor:
      "Cells merge. Filters break. The Squigs begin weaponizing conditional formatting against each other.",
  },
  {
    title: "Quarter Close - Corporate Delirium",
    flavor:
      "Deadlines sharpen. Smiles become strategic. Nobody is sure if the dashboard is helping or hunting.",
  },
  {
    title: "Performance Review Season",
    flavor:
      "Every Squig is suddenly 'circling back' and 'driving value' while trying not to cry in the stairwell.",
  },
  {
    title: "Layoff Rumor Thursday",
    flavor:
      "The office air turns electric. Every Slack ping sounds like destiny wearing loafers.",
  },
  {
    title: "Final Shift - Last Squig Standing",
    flavor:
      "Lights flicker. Printers groan. Only a few battle-hardened Squigs remain to inherit the ergonomic chairs.",
  },
];

const OFFICE_SQUIGS_STORIES = {
  hidingSpots: [
    "{victim} hid inside a filing cabinet drawer until someone closed quarter-end with force.",
    "Trying to disappear in the supply closet, {victim} was buried under a landslide of toner and shame.",
    "{victim} tucked into the office shred bin, forgetting that 'confidential' is an active process.",
    "The ceiling tile above HR looked safe until {victim} fell through orientation.",
    "{victim} curled up inside an empty paper box and was pallet-stacked into oblivion.",
    "A decorative lobby planter concealed {victim} right up until Facilities rotated the soil.",
    "{victim} hid behind the presentation screen and was flattened by quarterly projections.",
    "Inside the company swag cabinet, {victim} was smothered by seventeen branded hoodies and a stress ball.",
    "{victim} slipped into a desk drawer for safety and met an aggressive staple remover.",
    "The recycling bin welcomed {victim}, then compacted its hospitality.",
    "{victim} nestled inside the mail cart and was delivered directly into consequences.",
    "A forgotten mini-fridge in the break room became {victim}'s sanctuary until the compressor kicked like destiny.",
    "{victim} hid in the server closet and was instantly judged by the cooling fans.",
    "The janitor's mop bucket seemed low profile until a hard left turn ended {victim}'s career.",
    "{victim} disguised themselves as office decor and was tragically dusted into history.",
    "A stack of printer paper looked sturdy enough for cover until it avalanched onto {victim}.",
    "{victim} wedged into the false bottom of the snack drawer and was discovered by a desperate accountant.",
    "Under the conference table, {victim} survived six slides before a wheeled chair found them.",
    "{victim} hid in the lost-and-found and was claimed by nobody but gravity.",
    "The coat closet swallowed {victim} whole when a rainstorm sent everyone reaching for jackets at once.",
    "{victim} camped in a cardboard archive box labeled 'FY2022' and was sealed for storage forever.",
    "A cubicle wall panel came loose just long enough for {victim} to crawl in and regret it.",
    "{victim} took shelter inside the giant mascot costume and suffocated under synthetic morale.",
    "The drawer beneath the coffee station seemed perfect until a crate of stirrers pinned {victim} flat.",
    "{victim} hid atop the break room microwave, then learned the vent has opinions.",
    "Behind the whiteboard, {victim} lasted until someone got ambitious with dry-erase enthusiasm.",
    "{victim} slipped into the returns shelf and was crushed beneath three defective keyboard boxes.",
    "The intern's backpack hid {victim} for half the day, then a staircase handled the rest.",
    "{victim} posed as a sticky note on a monitor until screen cleaner erased the bit.",
    "Inside the office aquarium stand, {victim} discovered that water features are structurally dishonest.",
  ],
  clumsiness: [
    "{victim} sprinted to make a meeting and skidded across a polished floor into a glass wall.",
    "An office chair rolled just far enough to betray {victim} at full sit-down velocity.",
    "{victim} tripped over a projector cable and gave the room one final interpretive chart.",
    "Reaching for the top shelf, {victim} pulled an avalanche of binders directly onto their future.",
    "{victim} leaned on a collapsible table that chose that moment to become theoretical.",
    "The automatic standing desk rose without warning and launched {victim} like a corporate trebuchet.",
    "{victim} mistook the glass conference room for an open doorway and introduced themselves at speed.",
    "A spilled latte turned the tile into a legal hazard and {victim} into a cautionary email.",
    "{victim} rode a swivel chair downhill and discovered why Risk Management exists.",
    "Trying to look casual, {victim} backed into a coat rack and lost an argument with umbrellas.",
    "{victim} yanked too hard on a jammed stapler and achieved instant desk-side tragedy.",
    "A monitor arm snapped back mid-adjustment and deleted {victim} from the workflow.",
    "{victim} climbed the bottom shelf like a ladder, which was creative but not survivable.",
    "The badge lanyard caught in the copy machine and dragged {victim} into office folklore.",
    "{victim} tried to carry six lunch containers at once and lost to soup gravity.",
    "One squeaky wheel on the file cart sent {victim} pinwheeling into the compliance posters.",
    "{victim} power-walked through the restroom on a freshly mopped tile and met the hand dryer face-first.",
    "Attempting to vault a low partition, {victim} learned cubicles are harder than ego.",
    "{victim} crouched under a desk for a charger, then stood up into the pure steel edge of accountability.",
    "A violent sneeze during printer troubleshooting launched {victim} backward into laminated doom.",
    "{victim} spun the office fan for fun and discovered centrifugal regret.",
    "Trying to scan two documents at once, {victim} leaned too far across the copier and lost the deal.",
    "{victim} stepped onto a rolling footrest and briefly became a hallway projectile.",
    "The elevator doors reopened on {victim}'s confidence but not on their balance.",
    "{victim} attempted a dramatic headset turn and got clotheslined by their own cord.",
    "A rogue thumbtack on the carpet sent {victim} hopping directly into a wastebasket dive.",
    "{victim} tried to moonwalk out of a bad meeting and collided with the snack cart.",
    "One aggressive power strip under the desk turned {victim}'s stride into performance art.",
    "{victim} leaned back to think and tipped chair, dignity, and body all at once.",
    "While admiring the skyline, {victim} stepped onto a wobbling vent cover and disappeared from payroll.",
  ],
  sabotage: [
    "{killer} told {victim} the red button under the conference table was a footrest. It was not.",
    "{killer} 'helped' {victim} fix the printer by feeding them into tray two.",
    "{killer} rolled {victim}'s chair back right as they sat, a timeless office betrayal.",
    "'The CEO loves initiative,' said {killer}, pushing {victim} into an active board meeting.",
    "{killer} convinced {victim} the shredder was a fast elevator for small professionals.",
    "{killer} labeled {victim}'s lunch 'free' and let the break room mob do the rest.",
    "{killer} sent {victim} to retrieve a file from the top shelf, then kicked the ladder of lies away.",
    "'Test the microphone,' whispered {killer}, shoving {victim} onto a live all-hands stream.",
    "{killer} claimed the rolling whiteboard was stable, then surfed {victim} straight into a wall.",
    "{killer} told {victim} Facilities loved surprise ceiling inspections.",
    "{killer} scheduled {victim} into four overlapping meetings and watched entropy finish the job.",
    "{killer} 'accidentally' unplugged {victim}'s desk fan during a toner fire.",
    "{killer} suggested hiding in the compactor-sized archive drawer for 'just five minutes.'",
    "'HR said you're cleared,' lied {killer}, sending {victim} into the biometric door at full speed.",
    "{killer} daisy-chained extension cords around {victim}'s feet and called it cable management.",
    "{killer} told {victim} the executive espresso machine responds to compliments, then hit steam.",
    "{killer} promised the office drone was safe enough to ride. It was safe for nobody.",
    "{killer} swapped {victim}'s ergonomic stool for a decorative one with vengeance in its legs.",
    "'Quick, present this slide,' said {killer}, catapulting {victim} into a room full of laser pointers.",
    "{killer} stapled two report covers around {victim} and filed them under 'resolved.'",
    "{killer} rerouted the motorized blinds while {victim} was peeking out the window.",
    "{killer} convinced {victim} the break room freezer was a good spot to 'cool down and focus.'",
    "{killer} baited {victim} onto the mail trolley and sent them express to the loading dock abyss.",
    "{killer} whispered that the floor outlet was a coin slot for bonus snacks.",
    "{killer} told {victim} to hide under the demo display, then started the standing desk showcase.",
    "{killer} locked {victim} in the phone booth pod and booked back-to-back sales calls.",
    "{killer} said the office mascot costume offered armor, then pushed {victim} into a stairwell pep rally.",
    "{killer} told {victim} to crawl through the duct under IT 'for better Wi-Fi.'",
    "{killer} replaced {victim}'s paper stack with laminated sheets and let the cutter decide the rest.",
    "{killer} sent {victim} to 'circle back' so many times they looped into the industrial fan.",
  ],
  resurrections: [
    "The printer spits out one final page, and somehow {victim} crawls off the tray with fresh trauma.",
    "A cursed calendar invite gets declined so hard that {victim} reappears in the hallway.",
    "The break room microwave dings at exactly the wrong frequency and resurrects {victim}.",
    "An intern plugs the wrong cable into the dock, rebooting {victim} along with three monitors.",
    "The office coffee reaches legally actionable strength and restarts {victim}'s heartbeat out of spite.",
    "A spreadsheet circular reference collapses reality long enough for {victim} to load back in.",
    "Someone hits 'undo' in the shared document and {victim} returns with version history attached.",
    "The motion-sensor lights flicker three times, then {victim} stands back up like nothing happened.",
    "A Teams call drops, reconnects, and takes {victim} with it on the way back.",
    "The vending machine jams, rattles, and refunds {victim} instead of chips.",
    "A mass reply-all storm bends spacetime and coughs {victim} back into the cubicles.",
    "The office aquarium bubbles ominously, then ejects {victim} fully hydrated and deeply confused.",
    "A rogue badge scan authorizes {victim}'s existence again.",
    "The paper shredder reverses for once in its miserable life and reconstructs {victim} from pure bureaucracy.",
    "Someone mutters 'synergy' with enough conviction that {victim} respawns out of compliance.",
    "The conference room display reboots to a black screen, then {victim} walks out of it.",
    "An espresso machine hiss becomes a summoning chant, and {victim} returns smelling like hazelnut panic.",
    "The ergonomic chair warranty finally activates and restores {victim} to factory settings.",
    "A suspiciously motivated HR memo rehires {victim} into the mortal plane.",
    "The supply closet inventory finally balances, and the universe returns {victim} as a correction.",
    "A whiteboard marker squeals at a pitch that redraws {victim} into existence.",
    "The automatic soap dispenser fires like a tiny blessing and revives {victim} in the restroom mirror.",
    "A calendar reminder labeled 'survive' pops up, and {victim} obediently does.",
    "A Bluetooth headset pairs with the void and pulls {victim} back from it.",
    "The office plant absorbs a little fluorescent light and gives it all to {victim}.",
    "A project status changes from red to yellow, and {victim} is granted one more quarter.",
    "The keycard reader beeps green on a dead credential, then resurrects {victim} out of policy.",
    "Someone opens the snack drawer and finds {victim} where the granola bars should be.",
    "A deeply haunted spreadsheet macro repopulates {victim} cell by cell.",
    "The fire drill alarm chirps once, thinks better of it, and revives {victim} instead.",
  ],
};

const OFFICE_SQUIGS_ERA = {
  key: "office_squigs",
  label: "Office Squigs",
  loreLines: OFFICE_SQUIGS_LORE_LINES,
  milestoneStages: OFFICE_SQUIGS_MILESTONE_STAGES,
  stories: OFFICE_SQUIGS_STORIES,
};

const JOBSITE_SQUIGS_LORE_LINES = [
  "🦺 {player} wears a hard hat sideways and insists it improves aerodynamics.",
  "🚧 {player} studies the caution tape like it contains ancient prophecy.",
  "🔨 {player} picks up a hammer and immediately feels overqualified for everything.",
  "🪚 {player} hears a circular saw and calls it 'the loud moon.'",
  "🧱 {player} stacks three bricks and starts talking like a foreman.",
  "🛻 {player} rides in the back of a truck for six seconds and becomes impossible to reason with.",
  "📏 {player} uses a tape measure once and begins judging the universe in inches.",
  "🪜 {player} climbs two rungs of a ladder and develops dangerous confidence.",
  "🔩 {player} collects loose bolts like tiny sacred relics of industry.",
  "🏗️ {player} stares at the crane hook and decides it is either destiny or lunch.",
  "🧤 {player} puts on oversized work gloves and loses all fine motor skills but none of the swagger.",
  "🪣 {player} sits on an upside-down bucket and calls it a site office.",
  "🪛 {player} finds a screwdriver and starts pointing at things with authority.",
  "🪵 {player} pats a stack of lumber and whispers, 'good rectangles.'",
  "🚜 {player} mistakes the skid steer for a friendly metal beast.",
  "🦺 {player} learns the phrase 'tool crib' and expects a nursery full of wrenches.",
  "📋 {player} clips a blank page to a board and suddenly looks employable.",
  "🧰 {player} opens a toolbox and gasps like they found pirate treasure.",
  "⛏️ {player} drags a shovel twice their size and calls it character building.",
  "🔦 {player} shines a flashlight into a crawlspace and hears the crawlspace judge them back.",
  "🪨 {player} kicks a pile of gravel and immediately regrets this leadership decision.",
  "🌧️ {player} learns the jobsite becomes fifty percent mud, fifty percent lies when it rains.",
  "🪤 {player} watches a porta-potty door slam and gains a new fear category.",
  "🚪 {player} tests a half-installed door and discovers the concept of 'not yet.'",
  "🧯 {player} points at a fire extinguisher like it might also dispense snacks.",
  "🪖 {player} nods through a safety briefing while absolutely no information sticks.",
  "📣 {player} hears someone yell 'heads up' and chooses the worst possible interpretation.",
  "🛠️ {player} says 'that looks level' with the confidence of a menace.",
  "🧼 {player} finds the hand-wash station and treats it like a luxury spa.",
  "🚛 {player} watches a concrete truck spin and becomes hypnotized by infrastructure.",
  "🔌 {player} sees an extension cord and immediately creates a trip hazard masterpiece.",
  "🪙 {player} trades a washer for a screw and feels like a market genius.",
  "📦 {player} hides in a pallet wrap cocoon and calls it weatherproofing.",
  "🥪 {player} opens a lunch cooler and briefly forgets all survival goals.",
  "🧠 {player} learns what rebar is and decides it sounds hostile.",
  "🧽 {player} wipes one surface clean and is hailed as the rare Squig who respects finishing work.",
  "🪫 {player} picks up a dead drill battery and mourns it like a fallen hero.",
  "🌬️ {player} stands too close to a leaf blower and becomes site confetti.",
  "📐 {player} holds a speed square and pretends this clarifies existence.",
  "🧍 {player} lingers near the foreman trailer just to absorb managerial aura.",
];

const JOBSITE_SQUIGS_MILESTONE_STAGES = [
  {
    title: "First Shift - Boots in the Dirt",
    flavor:
      "Fresh to the site, the Squigs arrive wearing hard hats, bad instincts, and a dangerous amount of optimism.",
  },
  {
    title: "Morning Safety Meeting",
    flavor:
      "The warnings are clear. The hand gestures are firm. The Squigs understand none of it but nod anyway.",
  },
  {
    title: "Before Lunch - Tool Chaos",
    flavor:
      "Cords snake across the ground, compressors roar, and every Squig now thinks they are qualified to operate something huge.",
  },
  {
    title: "After Lunch - Heavy Equipment Delusions",
    flavor:
      "The site gets hotter, louder, and somehow even more structurally threatening.",
  },
  {
    title: "Concrete O'Clock",
    flavor:
      "Mud hardens, tempers shorten, and the Squigs learn that wet concrete remembers everything.",
  },
  {
    title: "Inspection Panic",
    flavor:
      "Clipboards appear. Suddenly everyone starts pretending they knew the code all along.",
  },
  {
    title: "Late Day - Deadline Madness",
    flavor:
      "Sun dropping, generators humming, and the entire site running on caffeine, shouting, and questionable shortcuts.",
  },
  {
    title: "Final Whistle - Last Squig on Site",
    flavor:
      "Dust hangs in the air. The tools fall quiet. Only a few battered Squigs remain to clock out alive.",
  },
];

const JOBSITE_SQUIGS_STORIES = {
  hidingSpots: [
    "{victim} hid inside a stack of PVC pipe until gravity sorted the inventory.",
    "Trying to stay unseen, {victim} crawled under a tarp and was strapped down with the materials.",
    "{victim} tucked into a wheelbarrow for cover and got dumped into a trench with authority.",
    "A half-built wall looked safe until the loose cinder blocks introduced themselves to {victim}.",
    "{victim} climbed into the gang box and was sealed in with every sharp object on site.",
    "The porta-potty behind the trailer seemed like a sanctuary until the wind made a decision for {victim}.",
    "{victim} hid inside a pallet stack and was forklifted into the next life.",
    "A concrete form provided perfect cover right up until the pour began around {victim}.",
    "{victim} slipped beneath a pile of insulation and was compressed into a cautionary texture.",
    "Hiding behind the generator only worked until {victim} met the exhaust and regret.",
    "{victim} nestled under a stack of drywall and discovered that gypsum has no mercy.",
    "A bundle of rebar concealed {victim} until one shift turned into a metal cage.",
    "{victim} took shelter in the back of a pickup and was launched by a pothole the size of destiny.",
    "The tool trailer welcomed {victim} briefly, then a rolling compressor sealed the exit forever.",
    "{victim} hid in a spool of wire and was tightened into pure inconvenience.",
    "A trench box looked secure until the whole muddy wall introduced itself to {victim}.",
    "{victim} squeezed inside a cooler for shade and was buried under forty pounds of ice and indifference.",
    "Trying to blend into a stack of traffic cones, {victim} was flattened by actual traffic control.",
    "{victim} hid inside a cement bag pallet and became part of the mix.",
    "The crawlspace under a floor deck seemed safe until a worker dropped six bolts and a flashlight onto {victim}.",
    "{victim} curled up behind a stack of shingles and was roofed over by pure momentum.",
    "A plastic barricade shielded {victim} right until the wind weaponized it.",
    "{victim} slipped into a coil of hose and was dragged across the jobsite like a myth.",
    "The foreman trailer steps concealed {victim} until steel-toe reality arrived.",
    "{victim} hid in the sand pile and was scooped by a machine that believes in volume.",
    "Inside a bucket of fasteners, {victim} was shaken into structural alignment.",
    "{victim} crouched behind the laser level and was blinded by precision before the fall.",
    "A crate of tile became {victim}'s bunker until the straps snapped and made that everyone else's problem too.",
    "{victim} burrowed under geotextile fabric and was rolled flat by progress.",
    "The scaffold plank above looked harmless until dropped hardware found {victim} by instinct.",
  ],
  clumsiness: [
    "{victim} stepped on a loose board and catapulted themselves into unfinished legend.",
    "One muddy boot met one polished metal ramp, and {victim} left the site horizontally.",
    "{victim} tried to hop over an extension cord and discovered a second, meaner extension cord.",
    "A ladder shifted half an inch, which turned out to be all the distance {victim} needed to lose everything.",
    "{victim} leaned on temporary railing with permanent confidence.",
    "Trying to look experienced, {victim} backed directly into a running plate compactor.",
    "{victim} tripped over rebar, pinwheeled through gravel, and finished in a bucket of thinset.",
    "The scaffold plank bounced once under {victim}, then never negotiated again.",
    "{victim} slipped on wet plywood and introduced their face to a stack of conduit.",
    "A rogue air hose snapped loose and erased {victim} from the shift report.",
    "{victim} stepped into a shallow trench, then kept going far longer than expected.",
    "The wheelbarrow handles dipped suddenly, and {victim} followed the load into history.",
    "{victim} tried to sit on an upside-down bucket that was not, in fact, upside down.",
    "One badly timed gust turned a sheet of house wrap into a sail and {victim} into cargo.",
    "{victim} misjudged the distance between joists and learned what open framing means.",
    "A tape measure snapped back with such vengeance that {victim} lost the argument instantly.",
    "{victim} tried to carry too many offcuts at once and got folded by geometry.",
    "Stepping onto a pile of loose gravel, {victim} surfed all the way into a concrete form.",
    "{victim} yanked a jammed nail free and flew backward into the demo pile.",
    "A hose under pressure rolled beneath {victim}'s feet like it had been planning this all morning.",
    "{victim} hopped off the tailgate and landed directly in the only patch of wet mortar for miles.",
    "The chop saw noise startled {victim} so badly they walked into a support brace at full sincerity.",
    "{victim} sprinted to dodge a shouted warning and ran into a much larger, quieter danger.",
    "A stack of pavers shifted just enough to make {victim} reconsider balance too late.",
    "{victim} climbed the scaffolding one-handed, then remembered halfway up that they are mostly panic.",
    "While admiring a crane swing, {victim} walked straight off the edge of a slab cutout.",
    "{victim} slipped on dust, bounced off a dumpster, and completed the most humiliating route on site.",
    "A door frame under installation met {victim} at forehead height and ended the shift decisively.",
    "{victim} stood on a rolling pipe for one incredible second.",
    "Trying to avoid a puddle, {victim} stepped into a deeper, more educational puddle.",
  ],
  sabotage: [
    "{killer} told {victim} the saw was off, then let probability handle the rest.",
    "'Hold this steady,' said {killer}, right before the entire panel swung onto {victim}.",
    "{killer} convinced {victim} the trench edge was 'totally solid enough.'",
    "{killer} kicked the ladder base just to 'test the setup,' and {victim} failed the exam.",
    "{killer} sent {victim} to stand under a suspended load for 'the shade.'",
    "{killer} claimed the skid steer only bites if it smells fear. {victim} smelled terrified.",
    "{killer} handed {victim} the live extension cord end like it was a ceremonial ribbon.",
    "'Check if the concrete is set,' said {killer}, pushing {victim} face-first into the pour.",
    "{killer} used {victim} as a wheel chock and let the slope make the executive decision.",
    "{killer} said the scaffold plank was rated for 'one brave little guy.'",
    "{killer} waved {victim} into the blind spot of a reversing truck with criminal confidence.",
    "{killer} told {victim} to hide in the pipe trench and then forgot they existed on purpose.",
    "'Catch this,' yelled {killer}, dropping a socket set and a dream onto {victim}.",
    "{killer} insisted the compactor was basically a massage table.",
    "{killer} zip-tied {victim} to a bundle of conduit 'for transport efficiency.'",
    "{killer} pushed {victim} onto the forklift pallet and announced an unauthorized promotion.",
    "{killer} told {victim} the rebar cap was a helmet upgrade, then removed the actual helmet.",
    "{killer} sent {victim} into the crawlspace after a flashlight, then kept the flashlight.",
    "{killer} claimed the generator noise would drown out danger, then nudged {victim} closer to both.",
    "{killer} advised {victim} to test the fresh weld with their whole body.",
    "{killer} loaded {victim} into a dumpster bag and called it 'streamlining cleanup.'",
    "{killer} shouted 'duck!' just early enough for {victim} to choose the wrong direction.",
    "{killer} said the crane hook was safe to ride if you 'believe in vertical solutions.'",
    "{killer} locked {victim} inside the site trailer during a wildly preventable collapse.",
    "{killer} told {victim} to measure from the edge, then removed the edge.",
    "{killer} swapped {victim}'s anchor point for decorative rope and wished them growth.",
    "{killer} insisted the nail gun safety was 'mostly symbolic.'",
    "{killer} steered {victim} under the concrete chute to 'see the texture up close.'",
    "{killer} baited {victim} onto a stack of loose blocks and applauded the wobble.",
    "{killer} reassured {victim} that the demolition countdown was 'just motivational yelling.'",
  ],
  resurrections: [
    "A backup generator coughs, sputters, and somehow powers {victim} back on.",
    "The concrete truck drum spins backward and returns {victim} as an accounting error.",
    "A foreman yells 'we're not done yet,' and the universe reluctantly sends {victim} back.",
    "A hard hat rolls in a perfect circle, then {victim} pops out from under it fully reset.",
    "The site radio crackles with static so cursed that {victim} rematerializes near the rebar pile.",
    "A nail ricochets off three surfaces, hits nothing important, and revives {victim} anyway.",
    "Someone slaps a fresh battery into a drill, and {victim} starts up too.",
    "The portable fan turns toward the dust cloud and blows {victim} back into existence.",
    "A cement bag bursts open and {victim} crawls out looking slightly more structural.",
    "The laser level recalibrates the timeline and places {victim} back on grade.",
    "A clipboard checkmark lands on the correct box, and {victim} is permitted to continue existing.",
    "The lunch whistle blows, and {victim} returns purely out of habit.",
    "A forklift backup alarm beeps in exactly the wrong dimension, respawning {victim}.",
    "The porta-potty door slams, swings open, and {victim} exits deeply changed but alive.",
    "A safety vest catches a gust like a miracle flag and drags {victim} back from the brink.",
    "Wet concrete bubbles once, then politely gives {victim} back.",
    "The site trailer microwave dings and returns {victim} at medium power.",
    "A cracked tape measure retracts so hard it rewinds {victim} into the timeline.",
    "The water cooler glugs ominously before dispensing {victim} instead of hydration.",
    "Someone says 'good enough for inspection,' and reality lowers its standards enough for {victim} to reappear.",
    "A bucket tips over, and {victim} spills out with the fasteners.",
    "The crane hook descends empty, then rises with {victim} hanging on and refusing to explain.",
    "A box of screws bursts open, and {victim} is somehow the largest piece.",
    "The generator starts on the first pull, an event so impossible it revives {victim} on principle.",
    "A cloud of sawdust clears, leaving {victim} standing there like a badly planned reveal.",
    "The site light flickers at dusk and redraws {victim} in fluorescent disappointment.",
    "A caution sign falls flat, then flips back up with {victim} behind it.",
    "An inspector says 'carry on,' and {victim} does so literally.",
    "The mud releases {victim} after deciding they were not worth curing around.",
    "A rogue bolt lands in the exact cosmic socket needed to restore {victim}.",
  ],
};

const JOBSITE_SQUIGS_ERA = {
  key: "jobsite_squigs",
  label: "Jobsite Squigs",
  loreLines: JOBSITE_SQUIGS_LORE_LINES,
  milestoneStages: JOBSITE_SQUIGS_MILESTONE_STAGES,
  stories: JOBSITE_SQUIGS_STORIES,
};

const MOVIE_THEATER_LORE_LINES = [
  "🍿 Somewhere in the dark, {player} shakes a popcorn bucket like it might reveal plot spoilers.",
  "🎟️ With courtroom energy, {player} studies the ticket stub as if it is a legal defense.",
  "🥤 After one sip of theater soda, {player} sees three timelines at once.",
  "🪑 One kick into the recliner and {player} decides they have mastered luxury.",
  "📽️ In the projector beam, {player} sees what can only be a tractor beam for snacks.",
  "🤫 From row G comes a shush, and {player} treats it like a declaration of war.",
  "🍫 The candy wrapper betrays {player} with the stealth of a chainsaw in a church.",
  "🎬 'I could direct this better,' whispers {player}, instantly becoming suspicious.",
  "🧈 So much butter follows {player} that the popcorn develops structural shine.",
  "👓 Behind a pair of 3D glasses, {player} starts respecting flat surfaces less.",
  "📱 Even at one percent brightness, {player}'s phone turns them into public enemy number one.",
  "🚪 Just to see if it's dramatic, {player} tests the exit door with their whole shoulder.",
  "🎧 Through the surround sound swirl, {player} becomes convinced the walls are gossiping.",
  "🛋️ By the time the seat finishes swallowing them, {player} briefly qualifies as missing.",
  "🍬 One dropped gummy sends {player} into a full seat excavation mission.",
  "🎞️ To {player}, the trailers are simply 'the movie before the movie.'",
  "🧃 With repeat-offender confidence, {player} smuggles in snacks like a professional.",
  "🕶️ Indoors, {player} keeps the shades on and blames the projector glare.",
  "🍕 The whole smell profile of the room changes when {player} opens a contraband pizza box.",
  "🧍 Mid-scene, {player} stands like the aisle belongs to them personally.",
  "🔦 Like divine guidance, the floor lights lead {player} exactly nowhere useful.",
  "🎟️ After losing the seat number, {player} starts squatting in premium territory.",
  "🎭 The previews get treated like live theater once {player} decides applause is deserved.",
  "🍪 During the quietest possible scene, {player} chooses cookie violence.",
  "📣 Four new enemies appear the moment {player} guesses the twist out loud.",
  "🧨 At one jump scare, {player} detonates half the row into popcorn panic.",
  "🛎️ In the cheap seats, {player} still expects table service and will not be corrected.",
  "🎵 The score picks up, and {player} starts humming like they were hired for ambiance.",
  "🚨 Somehow, {player} mistakes the emergency exit sign for a review score.",
  "🪙 Ancient gum lore is all {player} finds while checking under the seat for dropped coins.",
  "👀 More than the movie itself, the audience becomes {player}'s research project.",
  "📼 For reasons known only to them, {player} refers to the whole experience as 'going to the tapes.'",
];

const MOVIE_THEATER_MILESTONE_STAGES = [
  {
    title: "Pre-Show - Trailers and Tension",
    flavor:
      "The Ugly Theater lights dim, snacks rustle, and every Squig is one bad decision away from getting bounced into the lobby.",
  },
  {
    title: "Opening Scene - House Rules Ignored",
    flavor:
      "Security makes the first lap through the aisles. Nobody looks innocent, and several Squigs are actively sticky.",
  },
  {
    title: "Act One - Snack Smuggling Escalates",
    flavor:
      "The movie is rolling, the contraband is flowing, and somebody in the back row is already losing their theater privileges.",
  },
  {
    title: "Mid-Movie - Audience Revolt",
    flavor:
      "The plot thickens, the seat-kicking intensifies, and accusations are now flying faster than popcorn.",
  },
  {
    title: "Third Act - Security Sweep",
    flavor:
      "Flashlights cut through the darkness. The staff have stopped asking questions and started making examples.",
  },
  {
    title: "Final Reel - Chaos in the Aisles",
    flavor:
      "The credits are still far away, but the patience of the theater staff absolutely is not.",
  },
  {
    title: "End Credits - Last Warnings",
    flavor:
      "Only the most disciplined, devious, or lucky Squigs are still in their seats as the theater enters legend status.",
  },
  {
    title: "Closing Night - Last Squig in the Theater",
    flavor:
      "The screen glows, the ushers circle, and one final Squig fights to stay in the building until the very end.",
  },
];

const MOVIE_THEATER_STORIES = {
  hidingSpots: [
    "Under a recliner, {victim} tried to hide after getting caught in the wrong screening and was escorted out anyway.",
    "Behind the screen, {victim} got caught wandering into a staff-only area and was immediately kicked out.",
    "Inside the janitor closet, {victim} was discovered dodging the ushers after sneaking in without a ticket.",
    "The projector booth briefly welcomed {victim}, then staff removed them for entering a restricted area.",
    "Beneath a mountain of coats in the back row, {victim} was found trying to avoid a seat check.",
    "Behind the arcade machine in the lobby, {victim} was removed for hanging around after being told to leave.",
    "A nacho cheese drip gave away {victim}, who had been hiding after trying to sneak between theaters.",
    "Tucked into the wheelchair space without needing it, {victim} got escorted out for refusing to move.",
    "Inside the cardboard movie standee, {victim} was caught messing with theater property and bounced.",
    "By the emergency exit curtain, {victim} got thrown out for blocking an exit and ignoring warnings.",
    "At the butter refill station, staff discovered {victim} trying to sneak extra guests in through the side.",
    "The lost-and-found bin was a poor hiding place for {victim}, who had already been kicked out once.",
    "Behind row J, {victim} got caught smoking where absolutely no smoking was allowed.",
    "Up in the ceiling access area above the lobby, {victim} turned a simple warning into a full security ejection.",
    "Folded into a cup holder area, {victim} was removed for refusing to leave the auditorium after the warning.",
    "The closed caption device cabinet got {victim} kicked out for tampering with accessibility equipment.",
    "Under the giant claw machine in the lobby, {victim} was found trying to wait out the staff after being bounced.",
    "Trying to blend in near the exit, {victim} still got taken out for sneaking back in after removal.",
  ],
  clumsiness: [
    "A full soda went down three rows after {victim} kept waving it around during the movie, and staff had enough.",
    "Over the glowing aisle lights, {victim} stumbled while recording on a phone and got escorted out on the spot.",
    "Between reclining seats, {victim} kept climbing over people instead of using the aisle and got ejected for it.",
    "Security stepped in after {victim} turned a popcorn refill into a loud argument with concessions staff.",
    "During the quietest scene, {victim} stood up and kept shouting commentary until six offended viewers reported them.",
    "On a sprint to the restroom during a jump scare, {victim} knocked things over after ignoring multiple warnings to settle down.",
    "Under row F, {victim} crawled around with a bright phone light and ruined enough viewing angles to get banned on sight.",
    "The handrail slowed {victim} down while they tried to rush back in after already being told to leave.",
    "Staff removed {victim} after the crinkly candy bag, loud chewing, and nonstop noise became a full-row problem.",
    "Trying to sneak in an entire pizza, {victim} made the whole theater smell like outside food and got escorted out in disgrace.",
    "A full-theater incident response began when {victim} opened the emergency exit for no good reason.",
    "Caught in a folding seat, {victim} still managed to keep arguing with the ushers and got removed for the disturbance.",
    "One dramatic aisle strut from {victim} turned into blocking the screen for half the room, which ended their night.",
    "The entire row voted {victim} off the premises after they laughed, talked, and reacted at full volume through every scene.",
    "While using a flashlight to find dropped candy, {victim} kept sweeping it across the audience and got removed for it.",
    "After one seat-kick too many, collective willpower and one fed-up usher sent {victim} back to the lobby.",
    "Mid-movie, {victim} kept switching seats and starting arguments with the people actually assigned to them.",
    "At a silent scene, {victim}'s squeaky shoes were the least of it; the ongoing disruption finally got them kicked out.",
  ],
  sabotage: [
    "Before {victim} could explain anything, {killer} told staff they were recording the movie and got them thrown out.",
    "By planting a burrito under the seat, {killer} framed {victim} for bringing in outside food.",
    "The whole row turned on {victim} after {killer} whispered that the spoilers were coming from their seat.",
    "Every word landed when {killer} blamed {victim} for the phone glow in row D.",
    "After swapping the spilled soda with {victim}'s cup, {killer} let the ushers remove the wrong Squig.",
    "While doing the seat-kicking personally, {killer} reported {victim} for it with total confidence.",
    "Contraband candy wrappers appeared in {victim}'s lap, and {killer} called for an usher at exactly the right moment.",
    "Security skipped the questions after {killer} claimed {victim} had opened the emergency exit.",
    "When the projector glitched, {killer} pointed at {victim} like they had caused the whole problem.",
    "The flashlight squad showed up the second {killer} told the manager {victim} had snuck in without a ticket.",
    "For leaking the ending out loud, {killer} framed {victim} and let the theater handle the rest.",
    "The smell of outside pizza became {victim}'s problem once {killer} blamed it on them.",
    "As soon as {killer} declared {victim} the source of the nonstop talking in row H, the ushers stepped in.",
    "Under {victim}'s seat, {killer} tucked a light-up recording toy and then acted shocked when staff found it.",
    "The ejection came fast after {killer} convinced staff that {victim} had moved into premium seats without permission.",
    "Claiming {victim} started the popcorn fight, {killer} disappeared behind innocence while security took over.",
    "The moment the alarm chirped, {killer} pointed to {victim} and said they had been messing with the exit door.",
    "For sneaking into a second screening, {killer} framed {victim} and got them removed for theater hopping.",
  ],
  resurrections: [
    "The wrong stamp gets checked, an usher shrugs, and {victim} walks back into the theater like nothing happened.",
    "With a fresh ticket and a better story, {victim} convinces the box office this was all a misunderstanding.",
    "While the manager gets distracted by a broken soda nozzle, {victim} slips back to their seat unnoticed.",
    "Somehow security buys it when a friend claims {victim} was in the restroom the whole time.",
    "A double-beep from the theater scanner reopens the timeline just long enough for {victim} to re-enter.",
    "At the front doors, a shift change gives {victim} the loophole needed to walk back in.",
    "'They already got checked,' someone says, and {victim} is allowed back with zero follow-up.",
    "During a loud trailer, the lights flicker and {victim} sneaks back into the darkness like a rumor.",
    "A spilled popcorn cleanup distracts the entire staff, letting {victim} reappear three rows deeper in the theater.",
    "Carrying a suspiciously official-looking refill cup, {victim} comes back with undeniable confidence.",
    "The ticket taker waves a line through too quickly, and {victim} rides the chaos back inside.",
    "Because a broken scanner forces staff to eyeball everyone, {victim} gets restored by pure theater negligence.",
    "Wearing a different hoodie, {victim} returns and the theater's standards collapse on contact.",
    "From nowhere appears a comped voucher, and {victim} uses it to legally haunt the screening again.",
    "With security chasing the wrong disturbance, {victim} quietly reclaims a seat in the confusion.",
    "'Just go in,' mutters a sympathetic employee, and {victim} accepts the miracle immediately.",
    "At intermission, the concession stand rush lets {victim} slip back in on pure foot traffic.",
    "Holding enough popcorn to look legitimate, {victim} re-enters and somehow that works.",
  ],
};

const MOVIE_THEATER_ERA = {
  key: "movie_theater",
  label: "Movie Theater",
  loreLines: MOVIE_THEATER_LORE_LINES,
  milestoneStages: MOVIE_THEATER_MILESTONE_STAGES,
  stories: MOVIE_THEATER_STORIES,
  useEraLockedImagesOnly: true,
};

const AIRPORT_ERA_LORE_LINES = [
  "🧳 {player} arrives with one carry-on, two bad instincts, and a boarding group they absolutely made up.",
  "🎫 {player} studies the boarding pass like it might contain a secret extraction route.",
  "🛫 The departures board changes once, and {player} immediately stops trusting civilization.",
  "☕ {player} buys airport coffee at criminal pricing and calls it a survival tax.",
  "🪑 {player} claims three charging seats with one backpack and a dangerous amount of entitlement.",
  "📣 Every gate announcement sounds to {player} like destiny speaking through static.",
  "🧦 {player} takes off their shoes near the gate and becomes a regional problem.",
  "🔌 {player} finds the only working outlet and guards it like inherited land.",
  "🥨 {player} spends $14 on a pretzel and decides air travel is mostly psychological warfare.",
  "🛄 At baggage drop, {player} watches a suitcase vanish and feels spiritually warned.",
  "📱 {player} refreshes the airline app so often it starts to feel threatened.",
  "🚶 On the moving walkway, {player} acts like they've discovered advanced transportation.",
  "🪪 {player} pats every pocket twice, then a third time for drama.",
  "🚨 One security beep later, {player} is suddenly explaining their entire life story.",
  "🛍️ {player} wanders duty-free with the posture of someone who was never going to buy anything.",
  "🥤 {player} forgets the water bottle is full and learns that TSA has no sense of poetry.",
  "🧠 {player} invents three alternate routes home while standing perfectly still at gate C19.",
  "🍟 {player} treats airport fries like a medically necessary intervention.",
  "📍 {player} loses the gate, finds the gate, then loses faith.",
  "🛬 {player} hears another flight land and assumes it is showing off.",
  "🪫 {player} hits five percent battery and enters a more honest stage of consciousness.",
  "🧥 {player} uses a neck pillow with the confidence of a veteran traveler and the posture of a shrimp.",
  "📦 {player} opens a carry-on like it contains tactical options instead of tangled cords.",
  "🕶️ In the terminal glare, {player} looks suspicious entirely by accident.",
  "🚪 {player} walks toward the wrong gate with enough confidence to mislead others.",
  "🧼 {player} leaves the airport bathroom feeling less clean and more informed.",
  "📡 {player} connects to airport Wi-Fi and immediately distrusts every notification they've ever received.",
  "🛒 {player} loads their whole emotional state onto a luggage cart and starts pushing.",
  "🌧️ A weather delay hits, and {player} begins bargaining with the sky personally.",
  "😴 {player} falls asleep at the gate in a pose only airports can produce.",
  "🗺️ {player} checks the terminal map and somehow becomes less certain.",
  "🎧 {player} keeps headphones on through every announcement and calls that self-care.",
];

const AIRPORT_ERA_MILESTONE_STAGES = [
  {
    title: "Check-In - Hope Still Exists",
    flavor:
      "The terminal lights glare, the suitcase wheels rattle, and every Squig still believes they might actually get home today.",
  },
  {
    title: "Bag Drop - First Separation",
    flavor:
      "Suitcases vanish behind rubber curtains, and the Squigs begin learning that trust is not an airport resource.",
  },
  {
    title: "TSA Shuffle - Bin Economics",
    flavor:
      "Belts, shoes, phones, and dignity are redistributed into grey plastic trays at industrial speed.",
  },
  {
    title: "Security Line - Shoes Off, Dignity Lower",
    flavor:
      "Bins slide forward, scanners hum, and one forgotten water bottle is already rewriting fate.",
  },
  {
    title: "Secondary Screening - Fate Beeps Once",
    flavor:
      "Somewhere near the body scanner, random selection starts feeling very personal.",
  },
  {
    title: "Post-Security - False Confidence Returns",
    flavor:
      "The hard part appears over, which is exactly how the airport likes to set up the next disappointment.",
  },
  {
    title: "Gate Hunt - Terminal Delirium",
    flavor:
      "The signs contradict each other, the moving walkways judge silently, and every Squig is speed-walking toward uncertainty.",
  },
  {
    title: "Food Court Drift - Expensive Stabilization",
    flavor:
      "Salt, grease, and seven-dollar bottled water briefly convince the Squigs they can survive anything.",
  },
  {
    title: "Charging Station Politics",
    flavor:
      "Outlet territory becomes sacred land, and every cable now represents power in both senses.",
  },
  {
    title: "First Delay - Optimism Under Review",
    flavor:
      "An announcement crackles overhead. The departure board flickers. The phrase 'just a short delay' begins ruining lives.",
  },
  {
    title: "App Refresh Hour - Digital Misery",
    flavor:
      "Every phone screen tells a slightly different story, and none of them are good.",
  },
  {
    title: "Weather Hold - Sky-Based Tyranny",
    flavor:
      "Somewhere beyond the windows, clouds have unionized against the departure schedule.",
  },
  {
    title: "Terminal Spiral - Snacks and False Rumors",
    flavor:
      "Battery levels dip, overpriced food circulates, and every nearby stranger suddenly becomes an unverified source.",
  },
  {
    title: "Crew Delay - Operational Folklore",
    flavor:
      "A missing crew, a vague update, and one gate agent trying not to become history in front of the line.",
  },
  {
    title: "Standby Panic - Hope on a Spreadsheet",
    flavor:
      "Names rise and fall on invisible lists while the Squigs begin bargaining with mathematics.",
  },
  {
    title: "Gate Change - Full Stampede",
    flavor:
      "A new gate appears across the terminal, and the airport transforms into rolling luggage, panic, and betrayal.",
  },
  {
    title: "Cross-Terminal Migration",
    flavor:
      "The whole pack moves at once, dragged by rumor, signage, and the sound of suitcase wheels screaming on tile.",
  },
  {
    title: "Boarding Zone Lies",
    flavor:
      "Nobody belongs to the group being called, and yet somehow everyone is already standing.",
  },
  {
    title: "Carry-On Conflict - Overhead Justice",
    flavor:
      "Bag dimensions become a moral issue as the line tightens and the bins fill with consequences.",
  },
  {
    title: "Final Boarding Call - Last Bad Decisions",
    flavor:
      "The line tightens, the app refreshes again, and only the fastest, luckiest, or most morally flexible Squigs are still in this.",
  },
  {
    title: "Door Reopen Mirage",
    flavor:
      "Someone says the plane door might reopen, and false hope sprints faster than any Squig can.",
  },
  {
    title: "Rebooking Queue - Ritual Suffering",
    flavor:
      "The customer service line grows theological, testing faith, patience, and leg strength all at once.",
  },
  {
    title: "Voucher Diplomacy",
    flavor:
      "Meal vouchers appear like minor miracles, but nobody can eat enough to repair the timeline.",
  },
  {
    title: "Hotel Shuttle Rumors",
    flavor:
      "The stranded begin speaking in hearsay, QR codes, and the names of distant airport hotels.",
  },
  {
    title: "Last Agent Standing",
    flavor:
      "One exhausted gate agent remains, and every Squig now treats eye contact like a negotiation channel.",
  },
  {
    title: "Cancellation Board - Last Squig in the Terminal",
    flavor:
      "Flights vanish from the screen, customer service hardens into stone, and one final Squig fights to beat the airport itself.",
  },
];

const AIRPORT_ERA_STORIES = {
  hidingSpots: [
    "{victim} hid behind the gate desk hoping to dodge the boarding cutoff, but a reroute announcement buried them in pure chaos.",
    "Trying to disappear under a row of charging seats, {victim} got folded by three rolling suitcases and a desperate family of six.",
    "{victim} tucked into the oversized luggage zone and was conveyor-belted straight out of contention.",
    "The neck pillow display looked harmless until {victim} vanished beneath an avalanche of travel accessories.",
    "{victim} hid beside baggage claim carousel 4 and got claimed by the carousel's infinite confidence instead.",
    "Inside an unattended stroller parking lane, {victim} was flattened the moment pre-boarding turned feral.",
    "The moving walkway side panel concealed {victim} briefly, then the maintenance hatch made the rest permanent.",
    "{victim} squeezed into the gap behind a self check-in kiosk and was discovered by one violent printer jam.",
    "Under the customer service rope maze, {victim} survived two complaints before the stampede reached them.",
    "The airport chapel offered {victim} a moment of peace right up until rolling luggage entered at highway speed.",
    "{victim} hid in a duty-free stock corner and was boxed in by perfume crates and regret.",
    "Between stacked carry-on bins, {victim} learned that overhead storage technology was never meant for the ground.",
    "{victim} curled up near gate C27's dead outlet and was trampled by a wave of charger-seeking pilgrims.",
    "The janitor closet near arrivals almost saved {victim} until a mop bucket came off the turn too hot.",
    "{victim} camped inside the family restroom queue and got erased when a stroller convoy breached the lane.",
    "Behind the arrivals board, {victim} was pinned when another cancellation lit up the screen like prophecy.",
    "{victim} hid under the food court table forest and was ended by a falling tray and terminal-grade panic.",
    "The luggage cart return corral swallowed {victim}, then snapped back into service with brutal efficiency.",
  ],
  clumsiness: [
    "While sprinting to a gate that had already changed, {victim} wiped out on polished tile and never recovered the boarding group.",
    "A full-speed merge between {victim}, a rolling suitcase, and the moving walkway ended exactly how airport physics intended.",
    "{victim} tried to repack a bag in the middle of the security line and got obliterated by bins, belts, and collective hatred.",
    "Mid-announcement, {victim} spun to check the departures board and walked straight into a pillar with terminal velocity.",
    "Trying to save a phone at three percent battery, {victim} lunged for an outlet and lost the entire terminal negotiation.",
    "{victim} took the escalator with too much luggage and too little planning, then became a cautionary story for gate B.",
    "At the water refill station, {victim} slipped on one heroic drop and skidded directly into a luggage cart pileup.",
    "{victim} power-walked through a gate crowd while staring at the airline app and got introduced to a metal stanchion at speed.",
    "A neck pillow overcorrection sent {victim} backward off the charging seat island and into the airport's final judgment.",
    "{victim} tried to hop the rope line at customer service and discovered why the airport prefers suffering in order.",
    "One badly timed shoe-removal at security turned {victim} into a barefoot projectile of pure inconvenience.",
    "Trying to grab a falling passport, {victim} dove under the scanner and let the conveyor finish the sentence.",
    "{victim} sprinted for final boarding, clipped a carry-on wheel, and cartwheeled into the last call of their life.",
    "An aggressive pivot toward a gate-change rumor sent {victim} face-first into the world's least sympathetic trash can.",
    "{victim} misjudged the speed of the airport train doors and got deleted by regional transit indifference.",
    "The food court floor turned traitor under {victim}, who was carrying too many fries and not enough balance.",
    "{victim} tried to sleep sitting upright, slid off the gate chair stack, and woke up eliminated.",
    "While attempting a dramatic terminal shortcut, {victim} tripped over a charging cable nest and lost the whole route.",
  ],
  sabotage: [
    "{killer} told {victim} the gate had moved to the far terminal, then watched them miss reality by twenty-seven minutes.",
    "'They're still boarding,' lied {killer}, sending {victim} straight into a closed door and permanent regret.",
    "{killer} swapped {victim}'s carry-on tag and let baggage services erase the rest of the travel plan.",
    "{killer} pointed {victim} to the longest security line in North America and called it a shortcut.",
    "With fake urgency, {killer} convinced {victim} to leave the gate for snacks right before the final boarding call.",
    "{killer} said the airline app was bugged and talked {victim} into waiting at the wrong gate on purpose.",
    "{killer} stacked luggage in {victim}'s path just before the terminal stampede began.",
    "'They never check liquids,' said {killer}, letting TSA write the rest of {victim}'s obituary.",
    "{killer} sent {victim} to customer service for a problem that did not exist and let the line consume them whole.",
    "{killer} claimed pre-boarding had already started and launched {victim} into a stroller battalion with no mercy.",
    "At the moving walkway, {killer} gave {victim} one little shove and let airport momentum do the rest.",
    "{killer} told {victim} the passport was definitely in the other pocket, buying just enough delay to end the run.",
    "{killer} baited {victim} into arguing with the gate agent while the boarding line quietly vanished.",
    "Just as the gate changed, {killer} sent {victim} in the exact opposite direction with professional confidence.",
    "{killer} unplugged {victim}'s phone at one percent battery and let the dead screen finish the navigation disaster.",
    "{killer} insisted the airport train was optional and watched {victim} attempt an unsustainable sprint.",
    "{killer} framed {victim} as the seat thief at the charging station, and the resulting luggage war handled everything else.",
    "{killer} told {victim} there was more time, then watched the cancellation board close over them like a coffin lid.",
  ],
  resurrections: [
    "A replacement aircraft appears from nowhere, and {victim} is suddenly back in the game with fresh delusions.",
    "The gate agent takes pity, taps a keyboard twice, and {victim} gets rebooked into existence.",
    "A standby list collapses in divine order, opening one improbable seat for {victim}.",
    "An apology voucher, a gate swap, and one broken scanner combine to restore {victim}'s entire travel destiny.",
    "The weather clears just enough for operations to pretend this was manageable, and {victim} returns to contention.",
    "A miracle announcement confirms the door is reopening, and {victim} materializes in line like they were always there.",
    "Baggage services finds the missing passport in the least honest possible place, reviving {victim} on technicality alone.",
    "A customer service agent whispers, 'run,' and {victim} obeys so effectively it counts as resurrection.",
    "The delayed crew arrives at a sprint, and with them comes {victim}, reborn through scheduling failure.",
    "A fresh boarding pass prints from the kiosk and somehow includes {victim}'s soul.",
    "The airline app refreshes one more time and reverses {victim}'s fate out of pure instability.",
    "An overbooked volunteer deal shifts the whole manifest, and {victim} slides back onto the plane by loophole.",
    "The airport train stalls every other passenger just long enough for {victim} to catch up with destiny.",
    "A gate agent says, 'one more,' and against all policy that turns out to mean {victim}.",
    "The cancellation gets uncancelled in a burst of corporate confusion, restoring {victim} to the departures board.",
    "A lost-and-found miracle returns {victim}'s documents, charger, and will to continue in one blessed bundle.",
    "The final boarding call repeats a second time, and {victim} takes that as legal resurrection.",
    "A seat opens in row 32, and {victim} is hurled back into hope by raw airline math.",
  ],
};

const AIRPORT_ERA = {
  key: "airport",
  label: "Airport",
  loreLines: AIRPORT_ERA_LORE_LINES,
  milestoneStages: AIRPORT_ERA_MILESTONE_STAGES,
  stories: AIRPORT_ERA_STORIES,
  useEraLockedImagesOnly: true,
};

const ZOMBIE_APOCALYPSE_LORE_LINES = [
  "🧟 {player} hears one bite rumor and immediately starts side-eyeing everybody's neck.",
  "🩸 {player} follows a blood trail through the dark and comes back carrying antibiotics, shells, and one thousand-yard stare.",
  "🥫 {player} kicks open a pantry door and loads a bag with canned food like tomorrow is trying to kill everyone.",
  "🪓 {player} buries an axe in a walker's skull and keeps moving before the body even hits the floor.",
  "🔦 {player} sweeps a flashlight across the street and finds a pharmacy, three corpses, and one usable medkit.",
  "💉 {player} digs through a clinic freezer hunting antidote vials before the backup generator dies for good.",
  "🧱 {player} hauls back lumber, nails, and a better reason for the safehouse to survive one more night.",
  "📻 {player} catches a military broadcast on the radio and maps a supply cache before the signal gets swallowed by static.",
  "🧯 {player} caves in a biter's jaw with a fire extinguisher and keeps the extinguisher because it still has work to do.",
  "🛒 {player} rams a shopping cart through a dead grocery line and comes back with batteries, water, and blood on the wheels.",
  "🧪 {player} raids a wrecked lab for chemicals nobody can pronounce and swears one of them matters.",
  "🩹 {player} strips bandages from an abandoned ambulance and treats them like hard currency.",
  "🪟 {player} boards a window shut properly this time, then paints an arrow toward the next supply route.",
  "📦 {player} cracks open a military crate and finds ammo, painkillers, and a little bit of hope.",
  "🧤 {player} pulls on bloodstiff gloves and starts clearing shelves with brutal efficiency.",
  "🚨 {player} lures a pack of infected into a security gate, slams it shut, and scavenges the bodies they left behind.",
  "🥤 {player} drains the last clean water from a vending machine and counts that as a win.",
  "🗺️ {player} redraws the city map with dead zones, loot spots, and places nobody comes back from.",
  "🔋 {player} tears open a hardware store display and stuffs a pack full of batteries, flares, and spite.",
  "🚪 {player} kicks in a locked apartment door and finds canned meat, shotgun shells, and one survivor too late.",
  "🪵 {player} drags a stack of planks home through the rain while the infected beat themselves stupid against the fence.",
  "🏥 {player} strips an abandoned ER for IV bags, morphine, and anything that still looks sealed.",
  "⛽ {player} siphons gas from a wrecked bus while a walker burns on the pavement ten feet away.",
  "🔪 {player} buries a knife up to the hilt in a biter's neck and checks the corpse for keys.",
  "🥩 {player} comes back with smoked meat, two painkillers, and a story nobody wants to hear twice.",
  "🚚 {player} hotwires a delivery truck just long enough to loot the back before the horde notices.",
  "🧼 {player} cleans dried blood off an antidote case like that somehow makes the contents less cursed.",
  "🪤 {player} rigs a hallway with noise traps, then harvests the dead that pile up under them.",
  "🧯 {player} blasts a walker's face apart with the extinguisher valve and pockets the last trauma kit behind it.",
  "🪦 {player} loots a dead drop near the cemetery fence because the dead outside are somehow less dangerous than the living inside.",
  "📣 {player} shouts from a rooftop to pull the horde off the supply team, then slips away with the last ammo crate.",
  "😬 {player} says nothing, reloads, and drags another sack of food through the safehouse door before dawn.",
];

const ZOMBIE_APOCALYPSE_MILESTONE_STAGES = [
  {
    title: "Outbreak Alert - City in Collapse",
    flavor:
      "Sirens scream, power fails, and the Squigs learn in one ugly night that the world outside the safehouse is already gone.",
  },
  {
    title: "First Bite - Infection Confirmed",
    flavor:
      "One bite changes every rule in the room, and from that moment on every cough sounds like a death sentence.",
  },
  {
    title: "Barricade Hour - Hold the Line",
    flavor:
      "Wood, nails, and furniture slam into the doors while everyone pretends the walls can hold back hunger forever.",
  },
  {
    title: "Supply Run - No Choice Left",
    flavor:
      "Food, medicine, and ammo are running low, so the Squigs start leaving the safehouse and paying for every supply run in blood.",
  },
  {
    title: "Antidote Rumors - Desperation Rising",
    flavor:
      "Rumors of an antidote spread through the shelter, and every vial starts looking more valuable than a loaded gun.",
  },
  {
    title: "Nightfall - Claws on the Walls",
    flavor:
      "Darkness drops over the block, the windows shake, and the infected start clawing at the safehouse like they know dinner is inside.",
  },
  {
    title: "Shelter Breach - Dead Inside",
    flavor:
      "Boards snap, screams cut short, and the dead finally force their way through the same doors everyone trusted too much.",
  },
  {
    title: "Final Safehouse - Last Ones Breathing",
    flavor:
      "The safehouse is dying, the antidote supply is nearly gone, and the last Squigs standing have to kill or sacrifice their way to sunrise.",
  },
];

const ZOMBIE_APOCALYPSE_STORIES = {
  hidingSpots: [
    "{victim} hid under a shelf of canned food until the whole rack collapsed and broke them open for the horde.",
    "Trying to stay quiet in a bathtub, {victim} yanked the curtain down, brought the pipe with it, and rang out like a dinner bell.",
    "{victim} squeezed into an air vent, got stuck, and screamed until dead hands started reaching through the grate.",
    "The supply closet looked safe until {victim} got pinned under fallen shelving while the infected clawed through the door.",
    "{victim} hid behind a boarded window just as the nails ripped loose and the glass came in with the dead.",
    "Inside a shopping cart corral, {victim} learned metal bars do nothing when thirty infected slam into them at once.",
    "{victim} crawled into a dumpster for cover and got crushed when a panicked survivor rolled it into the compactor.",
    "A pharmacy shelf hid {victim} for about ten seconds before bottles rained down and brought every walker in the block.",
    "{victim} slipped into the back seat of an abandoned car, leaned on the horn, and got torn apart through both windows.",
    "Trying to hide in a freezer, {victim} lost the handle in the dark and was found frozen stiff with blood under the door.",
    "{victim} hid in the attic until the rotten floor split and dropped them straight into a feeding frenzy.",
    "Under a collapsed couch, {victim} stayed quiet until the infected smelled the blood pooling beneath the cushions.",
    "{victim} buried themselves in a laundry pile and got dragged out by the ankle when a dead hand caught fabric instead of flesh.",
    "The rooftop water tank looked safe until {victim} slipped off the ladder and hit the pavement hard enough to ring the street.",
    "{victim} hid under a checkout counter and got trampled when starving survivors stampeded for the last case of soup.",
    "Inside a tool chest, {victim} stayed hidden until someone dropped it down a stairwell and the metal folded shut around them.",
    "{victim} curled into a school locker and was ripped in half when the infected bent the door backward.",
    "Trying to hide behind a field tent, {victim} got tangled in the frame and eaten standing up.",
    "{victim} burrowed into a pile of blankets and suffocated under the weight while the room burned around them.",
    "A church confessional hid {victim} until the infected toppled the booth and crushed them inside it.",
    "{victim} climbed into a lifeguard stand and got kicked loose, splintered, and chewed on before they hit the sand.",
    "Under the generator tarp, {victim} touched a live cable and convulsed loud enough to bring the dead running.",
    "{victim} wedged into a boarded storefront window and was pulped when the crowd blew the whole frame inward.",
    "Trying to hide in a cereal display, {victim} pulled the stack down on themselves and died under cheap cardboard and broken glass.",
    "{victim} crawled into a hospital laundry cart and got rolled into a corridor full of fresh infected.",
    "The fake wall panel hid {victim} until the board tore loose and dumped them at the feet of the horde.",
    "{victim} locked themselves in a dog crate and learned too late that thin bars only slow teeth down.",
    "Behind a vending machine, {victim} got crushed when desperate hands tipped the whole thing for one last snack.",
    "{victim} hid in a church pantry until mason jars burst underfoot and every corpse in the hall came flooding in.",
    "Inside a school bus seat compartment, {victim} got stuck, broke a leg, and listened to the dead climb aboard.",
  ],
  clumsiness: [
    "{victim} slipped on spilled sanitizer and drove their throat into a barricade nail.",
    "Trying to sprint back from a supply run, {victim} tripped over a duffel bag and broke open on the concrete.",
    "{victim} climbed a chain-link fence in the rain, lost their grip, and landed on the wrong side with the dead.",
    "One rotten floorboard snapped under {victim} and dumped them leg-first into the basement horde.",
    "{victim} swung an axe too hard, buried it in a wall, and got dragged down before they could wrench it free.",
    "A blind turn in the dark sent {victim} shoulder-first through a glass door and neck-first into the shards.",
    "{victim} backed into a lit camp stove, caught fire, and ran screaming straight into the infected.",
    "Trying to leap a blood slick, {victim} hit the floor face-first and never got back up before the dead arrived.",
    "{victim} tripped over their own rescue rope and snapped their spine down a concrete stairwell.",
    "A shopping basket snagged {victim}'s ankle and left them screaming in the middle of the loot run.",
    "{victim} misjudged the roof edge by one step and painted the alley red.",
    "While checking a scratch that was not there, {victim} walked straight into exposed rebar.",
    "{victim} dove for a medkit, missed, and smashed their skull against the pharmacy counter.",
    "A stripped generator cable wrapped around {victim}'s wrist and cooked them where they stood.",
    "{victim} tried to kick a zombie hand away from under a door and kicked the whole entrance open.",
    "Mid-reload, {victim} missed a stair, broke a leg, and got swallowed in seconds.",
    "{victim} slipped in the rain, bounced off a barricade, and split their head open on the curb.",
    "Trying to slide under a closing gate, {victim} got pinned halfway and torn apart from the legs up.",
    "{victim} grabbed the wrong shelf during a pharmacy sprint and brought the whole aisle down on their chest.",
    "An overturned antidote cooler sent {victim} skidding under the feet of a charging horde.",
    "{victim} cut their flashlight for stealth, missed the landing, and vanished down a concrete stairwell.",
    "While hauling batteries, {victim} tripped over a body and cracked their head on the loading dock.",
    "{victim} tried to vault a hospital gurney and opened their stomach on the metal frame.",
    "One bad pivot around a supply crate sent {victim} face-first into a wall of rusted pipes.",
    "{victim} stepped on a loose can, went down hard, and got mobbed before they could crawl.",
    "Trying to hold the barricade alone, {victim} leaned too far through the gap and got dragged out in pieces.",
    "{victim} stopped to save a dropped ration pack and died hugging it in the street.",
    "A falling exit sign split {victim}'s scalp open mid-sprint and left them twitching on the tiles.",
    "{victim} tried to outrun the horde in sandals and left most of their skin behind on the asphalt.",
    "While staring at the radio for hope, {victim} walked clean off the loading dock and never stood back up.",
  ],
  sabotage: [
    "{killer} saw a bite on {victim}'s arm, said nothing, and shoved them back into formation when the dead hit the gate.",
    "{killer} slammed the barricade shut one second early and left {victim} outside beating on the metal while the horde climbed them.",
    "Claiming the alley was clear, {killer} sent {victim} straight into a knot of infected and used the screaming to get away.",
    "{killer} switched the real medkit for an empty case and watched {victim} bleed out on the tile.",
    "{killer} yelled 'run left' just to turn the horde onto {victim} and buy a cleaner escape.",
    "{killer} threw {victim} to the dead during a supply run and never broke stride.",
    "After hearing one cough, {killer} screamed that {victim} was turning and let the safehouse tear them apart first.",
    "{killer} shoved {victim} into the pharmacy shutters as they dropped and left them pinned there for the dead.",
    "{killer} held the roof ladder steady until {victim} was halfway up, then tipped it and walked away.",
    "{killer} made {victim} test a fake antidote first and watched the seizures take over.",
    "{killer} crushed {victim}'s fingers in the safehouse door and kicked them back into the infected.",
    "{killer} hurled a can down the hallway, blamed {victim} for the noise, and let the horde answer it.",
    "{killer} knew the basement was full of biters and sent {victim} down there anyway for batteries.",
    "{killer} cut {victim} off the escape rope and listened to the fall before the screaming started.",
    "With one hard shove, {killer} put {victim} through a weak barricade and fed them to the mouths waiting on the other side.",
    "{killer} handed {victim} an empty gun and kept the loaded one for the sprint back to safety.",
    "{killer} pointed at blood on {victim}'s sleeve and yelled 'BITE' until everyone else did the killing for them.",
    "{killer} baited {victim} into opening the supply van, then slammed the doors behind them with the dead already inside.",
    "{killer} promised to cover {victim}'s retreat, then used the distraction to lock the gate behind them.",
    "{killer} kicked the plank stack out from under {victim} and let the breach open right under their feet.",
    "{killer} sent {victim} to restart the generator knowing the fuel leak would light them up.",
    "{killer} whispered that evac had landed on the roof and watched {victim} run into open air and waiting teeth.",
    "{killer} framed {victim} as the ration thief and let hunger, fear, and a hammer handle the rest.",
    "{killer} jammed the closing gate with {victim}'s body to buy three more seconds for themself.",
    "{killer} shoved {victim} into a hospital ward packed wall to wall with the freshly dead.",
    "{killer} swapped out {victim}'s flashlight batteries before sending them into the tunnel alone.",
    "{killer} cracked the barricade open just enough to throw {victim} through it and seal it again.",
    "{killer} lied that {victim}'s bite scan was clean and waited for the turn to happen in the middle of the room.",
    "{killer} blamed {victim} for the alarm, and the shelter beat them bloody before the dead even got their turn.",
    "{killer} pushed {victim} into the evac bus doorway and held them there while the crowd crushed and chewed.",
  ],
  resurrections: [
    "An antidote slams through {victim}'s veins, the fever breaks, and they stagger back upright before the dead can finish chewing.",
    "Someone finds one last antidote vial in a bloodstained cooler, and {victim} claws their way back from the edge.",
    "The injection hits hard, the infection stalls, and {victim} comes back shaking but alive.",
    "A field dose of antidote burns through {victim}'s system and drags them back before the turn can finish.",
    "{victim} coughs black blood, seizes once, then snaps back after the antidote finally takes.",
    "The bite was winning until an antidote shot drove the rot out of {victim}'s blood the ugly way.",
    "A scavenged antidote syringe punches into {victim}'s neck and buys them another chance at sunrise.",
    "The room is ready to write {victim} off when the antidote kicks in and they sit up gasping.",
    "After minutes of fever and convulsions, {victim} survives the antidote and rejoins the living.",
    "The infection reaches {victim}'s eyes before the antidote drags them back clear.",
    "A stolen antidote dose reverses the bite just before {victim} crosses the line for good.",
    "The shelter doctor jams a last-resort antidote into {victim}, and somehow it works.",
    "{victim} crashes hard, flatlines for a breath, then comes roaring back when the antidote floods their system.",
    "An expired antidote vial should have failed, but it still rips {victim} back out of the grave.",
    "The fever breaks, the shaking slows, and {victim} survives on borrowed chemistry.",
    "A bootleg antidote mixed in a ruined clinic buys {victim} one more round with death.",
    "{victim} is halfway to turning when the antidote finally starts killing the infection instead.",
    "One clean shot of antidote clears the fog from {victim}'s head and puts them back in the fight.",
    "The bite mark darkens, then fades after the antidote tears through {victim}'s bloodstream.",
    "Against every sane expectation, the antidote holds and {victim} comes back breathing.",
  ],
};

const ZOMBIE_APOCALYPSE_ERA = {
  key: "zombie_apocalypse",
  label: "Zombie Apocalypse",
  loreLines: ZOMBIE_APOCALYPSE_LORE_LINES,
  milestoneStages: ZOMBIE_APOCALYPSE_MILESTONE_STAGES,
  stories: ZOMBIE_APOCALYPSE_STORIES,
  useEraLockedImagesOnly: true,
};

function appendMilestones(targetStages, entries) {
  targetStages.push(
    ...entries.map(([title, flavor]) => ({
      title,
      flavor,
    }))
  );
}

appendMilestones(DAY_ONE_MILESTONE_STAGES, [
  ["Month 7 on Earth - Strange Routines", "The Squigs start acting like they belong here, which only makes their behavior more alarming to everyone else."],
  ["Month 8 on Earth - Retail Exposure", "Automatic doors hiss open, shopping carts rattle past, and the Squigs discover consumer chaos at full volume."],
  ["Month 9 on Earth - Side Quest Saturation", "Every innocent errand becomes a lore-heavy detour with unclear stakes and terrible navigation."],
  ["Month 10 on Earth - Patio Season Aggression", "Outdoor seating, aggressive pigeons, and suspiciously unstable umbrellas begin shaping the survivor pool."],
  ["Month 11 on Earth - City Noise Enlightenment", "Sirens, scooters, and loud strangers teach the Squigs that peace on Earth may have been oversold."],
  ["Month 12 on Earth - Anniversary Delusions", "One full year in and the Squigs celebrate by making even worse choices with much greater confidence."],
  ["Year 2 - Apartment Mythology", "Lease agreements, laundry rooms, and neighbor diplomacy become the new battlegrounds of survival."],
  ["Year 2, Spring - Farmers Market Tensions", "Fresh produce, folding tables, and artisanal pricing create a dangerously fragile ecosystem."],
  ["Year 2, Summer - Festival Mistakes", "Street fairs bloom across the city, and every Squig suddenly thinks they can handle crowds, heat, and novelty food."],
  ["Year 2, Autumn - Decorative Menace", "Porch skeletons return, candle scents intensify, and seasonal vibes become operational hazards."],
  ["Year 2, Winter - Layering Failure", "The Squigs put on seven mismatched layers and still fail to understand wind, slush, or bus schedules."],
  ["Year 3 - Domestic Adaptation", "They know where the outlets are, which only makes their misuse of household life more sophisticated."],
  ["Year 3, Quarter 1 - Errand Density Rising", "Pharmacies, hardware stores, and post offices become recurring arenas of tiny, humiliating danger."],
  ["Year 3, Quarter 2 - Park Bench Diplomacy", "Warmer weather draws everyone outside, including the birds, cyclists, and deeply unhelpful random witnesses."],
  ["Year 3, Quarter 3 - Rooftop Confidence", "Someone suggests going upstairs for the view, and that sentence immediately starts taking casualties."],
  ["Year 3, Quarter 4 - Holiday Logistics", "Gift bags multiply, extension cords spread, and the Squigs learn that celebration is mostly infrastructure stress."],
  ["Year 4 - Human Culture Cram School", "The Squigs now reference memes, weather apps, and local gossip with the confidence of fake natives."],
  ["Year 4, Spring - Public Transit Lore", "Missed stops, suspicious seat fabric, and platform announcements continue thinning the field."],
  ["Year 4, Summer - Beach Episode Errors", "Sunscreen, boardwalks, and reckless optimism combine into a very preventable chapter of the timeline."],
  ["Year 4, Fall - Civic Festival Fatigue", "Parades, pop-up booths, and live music turn the city into one long test of attention span and balance."],
  ["Year 4, Winter - Indoor Survival", "Heaters hum, windows fog, and cabin fever starts giving even the smart Squigs weird ideas."],
  ["Year 5 - Earth Veteran Delusion", "Having survived this long, the Squigs finally mistake familiarity for immunity."],
  ["Year 5, Month 2 - Grocery Cart Theology", "Aisle traffic hardens, freezer doors swing wide, and every basket now carries strategic weight."],
  ["Year 5, Month 4 - Parking Lot Omens", "Shopping returns, cart corrals, and distracted drivers give the outside world a renewed sense of menace."],
  ["Year 5, Month 6 - Neighborhood Legends", "Rumors spread about the last few Squigs still roaming Earth with half-charged phones and no backup plan."],
  ["Year 5, Month 8 - Sidewalk Heat", "The pavement shimmers, tempers shorten, and even an ordinary walk starts feeling like a hostile event."],
  ["Year 5, Month 10 - Night Market Instability", "Lanterns glow, food stalls steam, and the crowd moves with the confidence of a wave that forgot mercy."],
  ["Year 5, Month 12 - New Year's Reckoning", "The countdowns begin, and the Squigs discover that celebration has all the balance of a collapsing shopping cart."],
  ["Year 6 - Local Cryptid Status", "Humans start telling stories about tiny weirdos in hoodies, and the survivors stop denying anything."],
  ["Year 6, Spring - Community Event Collapse", "Fundraisers, raffles, and folding chairs introduce new forms of highly organized chaos."],
  ["Year 6, Summer - Heatwave Brain Fog", "Fans spin uselessly while the last Squigs make sun-baked decisions with dangerous sincerity."],
  ["Year 6, Autumn - Streetlight Omens", "The city starts glowing earlier, and every shadow now looks like a bad invitation."],
  ["Year 6, Winter - Portable Heater Politics", "Warmth becomes contested territory, and diplomacy fails almost instantly."],
  ["Year 7 - Portal Memory Rot", "Only fragments remain of where they came from, but every survivor still flinches when a doorway hums strangely."],
  ["Year 7, Midyear - Hyperlocal Folklore", "The remaining Squigs are now part rumor, part nuisance, and part weather-resistant myth."],
  ["Year 8 - Small Circle Catastrophe", "With fewer survivors left, every weird decision lands harder and every witness feels more important."],
  ["Year 9 - Fading Footprints", "The city has nearly absorbed the whole story, leaving only a few stubborn traces of portal-born nonsense."],
  ["Year 10 - Transmission Decay", "Records fail, evidence vanishes, and the last surviving Squigs move through Earth like corrupted save data."],
  ["After the Logs - Urban Legend Tier", "Whatever remains of the original arrival has become rumor, static, and the sound of someone making a terrible choice nearby."],
  ["End of the Signal - Last Echo on Earth", "The timeline is almost out of witnesses. One last Squig keeps moving, either bravely or by clerical mistake."],
]);

appendMilestones(OFFICE_SQUIGS_MILESTONE_STAGES, [
  ["Month 2 - Desk Colony Formation", "Personal mugs, passive-aggressive snacks, and suspicious cables spread across the floor like evolving office terrain."],
  ["Month 3 - Slide Deck Dominion", "Transitions sparkle, fonts multiply, and the Squigs begin fighting wars through bullet points and color palettes."],
  ["Month 4 - Workflow Superstition", "Nobody knows which process actually works, but everyone is terrified to stop doing it now."],
  ["Month 5 - Printer Vendetta", "The machines have names, the names are insults, and toner shortages now feel spiritually targeted."],
  ["Month 6 - Badge Tap Theology", "Doors refuse certain people at random, and the Squigs start treating keycard access like prophecy."],
  ["Month 7 - Kitchen Sink Diplomacy", "Dirty mugs pile high, leftovers ferment with confidence, and no one remembers who started the fridge war."],
  ["Month 8 - Calendar Siege", "Back-to-back meetings stretch across the day until lunch becomes a rumor and focus becomes a myth."],
  ["Month 9 - Spreadsheet Arms Race", "Formula errors spread like sabotage while the last competent Squigs guard their tabs with open paranoia."],
  ["Month 10 - Fluorescent Attrition", "The lights buzz, the HVAC lies, and everyone begins negotiating with exhaustion in formal business language."],
  ["Month 11 - Policy Memo Season", "Fresh rules arrive in dense paragraphs, and each one somehow creates three new opportunities for disaster."],
  ["Month 12 - Office Holiday Fragility", "Cheap decorations, too much sugar, and one overloaded power strip destabilize the entire floor."],
  ["Fiscal Year Reset", "Budgets refresh, expectations inflate, and the survivors discover that optimism is now an administrative hazard."],
  ["Quarter 1 - Open Office Fatigue", "Every conversation carries, every cough travels, and privacy is downgraded to a premium feature."],
  ["Quarter 2 - KPI Heat", "Dashboards glow with fake certainty while the Squigs try to survive increasingly colorful measurements of failure."],
  ["Quarter 3 - Talent Retention Theater", "Managers start saying all the right words, which is how everyone knows things are getting worse."],
  ["Quarter 4 - Expense Audit Hunger", "Receipts surface, reimbursements stall, and every missing staple becomes a small legal thriller."],
  ["Merger Week - New Logo, Same Panic", "Fresh branding lands on old problems, and the floor plan becomes an emotional obstacle course."],
  ["Compliance Month - Smiles Under Observation", "Training videos multiply while the survivors attempt to look harmless under increasingly watchful systems."],
  ["All-Hands Season - Corporate Weather Event", "The whole office gathers at once, and every microphone, swivel chair, and iced coffee becomes tactically relevant."],
  ["Team-Building Retreat Fallout", "Name tags return from storage, trust exercises fail immediately, and morale becomes a contact sport."],
  ["Desk Hoteling Era", "No seat is permanent now, which means every surviving Squig spends half the day defending charger access."],
  ["Return-to-Office Week 1", "The hallways refill with noise, perfume, and the sound of chairs remembering their enemies."],
  ["Return-to-Office Week 2", "Badge readers glow, conference rooms vanish, and the break room reaches old levels of territorial hostility."],
  ["Promotion Rumor Cycle", "Suddenly everyone is networking with a little too much eye contact and not enough humanity."],
  ["Budget Freeze Afternoon", "Projects stop moving, but the panic absolutely does not."],
  ["Security Drill", "Phishing tests, locked screens, and whispered blame turn the office into a cautionary maze."],
  ["CEO Visit Day", "Plants get rotated, snacks improve briefly, and every survivor starts pretending their chaos is strategic."],
  ["Office Move Preparation", "Boxes arrive, labels spread, and half the floor becomes a trip hazard with a relocation budget."],
  ["Temporary Seating - Permanent Consequences", "Nobody knows whose desk is whose anymore, but everyone knows where the good monitor arms went."],
  ["Quarter-End Night Shift", "The bright ones stay late, the tired ones break faster, and the office hums like a machine with regrets."],
  ["Comp Time Mythology", "Promises of future rest circulate freely, which is exactly how the survivors know not to trust them."],
  ["Vendor Demo Invasion", "Branded tote bags appear, acronyms intensify, and the Squigs get trapped in a fresh ecosystem of nonsense."],
  ["Restructuring Week", "Job titles mutate overnight, and every Slack status starts looking like a coded distress signal."],
  ["Laptop Refresh Lottery", "Some get new machines, some get adapters from another century, and envy becomes a workflow blocker."],
  ["Knowledge Transfer Panic", "Half the office is documenting processes they were definitely hiding on purpose two days earlier."],
  ["Quarterly Survey Window", "Leadership asks for honesty, and the surviving Squigs immediately start speaking in emotionally encrypted language."],
  ["Fire Drill with Lanyards", "Stairwells fill, coffee spills, and the badge clips of the strong begin to fail."],
  ["Last Working Friday", "Nobody is truly present, which somehow makes the office even more dangerous."],
  ["Archive Floor - Legacy System Haunting", "Old folders, older grudges, and legacy software rise together to menace the few still standing."],
  ["Permanent WFH Rumors", "The end may be near, or it may just be another email chain. Only the final office Squigs remain to find out."],
]);

appendMilestones(JOBSITE_SQUIGS_MILESTONE_STAGES, [
  ["Week 2 - Mud Authority", "Boot prints deepen, materials shift, and every Squig suddenly speaks with unjustified confidence about drainage."],
  ["Week 3 - Cord Nest Expansion", "Extension lines spread across the ground in patterns that feel both temporary and vindictive."],
  ["Week 4 - Tool Belt Ego", "The survivors carry too much steel, too little restraint, and exactly one dangerous new opinion each."],
  ["Month 2 - Framing Fever", "Walls rise, gaps narrow, and every surface starts pretending it is more complete than it really is."],
  ["Month 3 - Weather Delay Logic", "Rain shifts the schedule, mud shifts the footing, and the site learns fresh ways to punish impatience."],
  ["Month 4 - Scaffold Philosophy", "Higher platforms mean louder confidence and much worse consequences for anyone testing gravity casually."],
  ["Month 5 - Delivery Window Ambush", "Pallets arrive, forklifts weave, and the whole site briefly becomes a logistics-based survival trial."],
  ["Month 6 - Rebar Forest", "Metal spikes multiply across the slab, turning every shortcut into an educational mistake."],
  ["Month 7 - Generator Gospel", "Power hums through the site while the last sensible Squigs start respecting extension limits too late."],
  ["Month 8 - Dust Cloud Season", "Visibility drops, coughing rises, and every shouted warning feels one second behind destiny."],
  ["Month 9 - Roofing Madness", "Elevation, loose shingles, and summer heat combine into a cruel final exam in balance."],
  ["Month 10 - Siding Spiral", "Panels slap in the wind, ladders shift, and every corner now wants a piece of the survivors."],
  ["Month 11 - Punch List Paranoia", "Tiny defects become major battles while the remaining Squigs trip over everything labeled 'almost done.'"],
  ["Month 12 - Winter Jobsite", "Frozen mud, stiff gloves, and false confidence create a colder, sharper kind of chaos."],
  ["Year 2 - New Crew, Old Hazards", "Fresh faces arrive, old mistakes return, and nobody learns fast enough to matter."],
  ["Year 2, Spring - Excavation Mood", "The trenches deepen, the warnings grow louder, and the site starts swallowing entire plans whole."],
  ["Year 2, Summer - Heat Index Delusion", "Tempers snap, sunscreen fails, and steel surfaces become a lesson in instant regret."],
  ["Year 2, Fall - Material Mountain", "Drywall stacks, lumber towers, and wrapped pallets form a skyline of highly unstable optimism."],
  ["Year 2, Winter - Portable Heater Politics", "Warm air becomes a strategic resource, and every survivor starts orbiting it like a desperate moon."],
  ["Inspection Week - Clipboard Judgment", "Every angle is scrutinized, every excuse sounds weaker, and the jobsite itself seems offended by the attention."],
  ["Concrete Cure Watch", "Nothing is dry enough, everything is in the way, and footprints start looking like confessions."],
  ["Roof Tie-In Day", "Edges multiply, harnesses tangle, and all remaining Squigs are one bad pivot from myth."],
  ["Mechanical Rough-In", "Ducts, pipes, and wires invade the airspace until the whole structure feels crowded with future arguments."],
  ["Electrical Pull Afternoon", "Conduits hum with possibility while the site rehearses new forms of accidental betrayal."],
  ["Framing Correction Pass", "Measurements get challenged, walls get reopened, and confidence gets very expensive very quickly."],
  ["Window Install Winds", "Glass, sealant, and overcommitted ladders put a polished finish on basic danger."],
  ["Exterior Grade Panic", "The ground itself becomes a moving target as machines redraw the site around the last survivors."],
  ["Final Pour Countdown", "Trucks queue up, hoses swing wide, and every second starts hardening into permanent consequences."],
  ["Shutdown Before Storm", "Tarps slap, materials get rushed, and the whole site moves like weather has a personal grudge."],
  ["Rework Monday", "Something passed on Friday, failed by Monday, and now everybody pays in noise and balance."],
  ["Overtime Drift", "The light gets meaner, the coffee gets worse, and the last Squigs start making moonlit mistakes."],
  ["Temporary Power Roulette", "Cords reroute, lights flicker, and every plug now feels like a suggestion from chaos itself."],
  ["Fence Line Breach", "Deliveries stack up outside, curious strangers drift in, and the perimeter stops meaning much at all."],
  ["Subcontractor Stampede", "Too many crews occupy one narrow reality, turning every corner into an argument with boots."],
  ["Crane Day - Sky Hooks and Bad Nerves", "Loads rise, shadows shift, and the survivors learn to fear the sound of someone yelling 'hold up.'"],
  ["Dust-Off Inspection", "Brooms come out, hiding spots disappear, and all the site's lies get exposed under sunlight."],
  ["Near Completion - Most Dangerous Phase", "Everything looks finished enough to trust, which is exactly why it becomes lethal again."],
  ["Hand-Off Week", "Punch items linger, temp rails vanish, and the site starts pretending it was never chaos here."],
  ["After the Ribbon Cut", "The tools go quiet, but a few stubborn jobsite Squigs are still fighting unfinished reality."],
  ["Final Lockup - Last Squig on the Build", "The gates close, the dust settles, and one final survivor remains to argue with the structure itself."],
]);

appendMilestones(MOVIE_THEATER_MILESTONE_STAGES, [
  ["Late Seating - Aisle Hostility", "The movie is already rolling, flashlights are already annoyed, and every late arrival looks one mistake away from exile."],
  ["Trailer Recall - Loud Wrapper Age", "The house is darker now, but the candy wrappers have chosen to become a public issue."],
  ["Row C Escalation", "Seat disputes, elbow politics, and whispered threats begin spreading through the front half of the room."],
  ["Row F Mutiny", "Someone keeps talking, someone else keeps kicking, and the ushers are starting to remember faces."],
  ["Row H Popcorn Front", "Butter slicks the armrests while accusations travel faster than the jokes on screen."],
  ["Projection Drift", "A tiny flicker on the screen gives every already-irritated Squig one more reason to lose composure."],
  ["Concession Refill Stampede", "The hallway floods with snack loyalty, refill cups, and questionable re-entry decisions."],
  ["Bathroom Break Disaster", "Half the room thinks they can sneak out and back without consequence. The theater disagrees loudly."],
  ["3D Glasses Diplomacy", "Wrong glasses, wrong rows, and wrong assumptions start blurring the social order."],
  ["Phone Glow Crackdown", "One bright rectangle in the dark is all it takes to turn a whole row into witnesses."],
  ["Aisle Light Confession Hour", "The floor lights reveal every careless footstep and every survivor trying to act invisible anyway."],
  ["Midnight Screening Energy", "Restraint dissolves, crowd etiquette weakens, and every whispered joke lands closer to a chargeable offense."],
  ["Director's Cut Delusion", "The movie runs long, patience runs short, and the remaining Squigs begin misreading endurance as authority."],
  ["Double Feature Fatigue", "Eyes dry out, sugar crashes hit, and seat ownership disputes start sounding like legal arguments."],
  ["VIP Row Tension", "Premium seats become strategic territory, and every survivor nearby starts bluffing with dangerous confidence."],
  ["Lobby Re-Entry Smugness", "Those who slip back inside return too proud, too loud, and far too visible."],
  ["Snack Contraband Phase II", "Jackets rustle with hidden supplies while the smell of outside food starts writing its own ejection order."],
  ["Surround Sound Overreaction", "Every jump scare now detonates snacks, drinks, and at least one fragile social contract."],
  ["Usher Recognition Arc", "The staff no longer need descriptions. They know the survivors by silhouette, posture, and nonsense level."],
  ["Seat Recline Cold War", "Tiny button presses become personal attacks as neighboring rows escalate by inches and pure malice."],
  ["Back Row Tribunal", "A few hardened squigs in the dark appoint themselves judge, jury, and spoiler enforcement."],
  ["Concession Stand Amnesty Window", "Brief mercy appears at the soda station, though nobody survives it with dignity intact."],
  ["House Lights Fake-Out", "The room brightens for a second, giving every guilty Squig the worst adrenaline spike of the night."],
  ["Fire Exit Rumor", "Someone whispers about a side door, and half the room starts moving with criminal optimism."],
  ["Preview Flashback", "Another trailer dump hits the screen and the survivors briefly lose track of what part of the experience is trying to kill them."],
  ["Sticky Floor Reckoning", "The carpet grips, the cup holders wobble, and mobility becomes a privilege of the careful."],
  ["Arcade Spillover", "Noise from the lobby leaks in, tempting the reckless and distracting the nearly competent."],
  ["Staff Shift Change", "Fresh ushers arrive with new energy, lower tolerance, and no attachment to prior warnings."],
  ["Crowd Thinning - Trouble Concentrates", "With fewer innocent viewers left, every remaining issue now points directly at the same tiny group of suspects."],
  ["Second Warning Era", "No one can claim ignorance anymore. The theater has moved into documentation mode."],
  ["Endgame in Row K", "The survivors gather in fewer seats, making every rustle, whisper, and bad excuse easier to target."],
  ["Closing Sweep One", "Brooms appear in the hall, the trash cans roll closer, and the room starts feeling pre-eviction."],
  ["Closing Sweep Two", "The movie nears its end, but the staff patience reached credits half an hour ago."],
  ["Post-Credits Hope", "A few Squigs decide the tag scene is worth risking everything the ushers have left."],
  ["Lobby Lights Full Bright", "Under unforgiving light, the remaining survivors look much less clever than they did in the dark."],
  ["Cleaning Crew Advance", "Mops, bins, and industrial indifference press in from every side of the room."],
  ["Final Seat Holdout", "Only a handful remain planted in place, defending their positions like the carpet owes them loyalty."],
  ["Last Screening of the Night", "The building is nearly empty, which somehow makes every surviving Squig easier to notice and harder to forgive."],
  ["After Hours Auditorium", "The soundtrack fades, the exits glow, and the final theater Squigs are left negotiating directly with consequences."],
  ["Projector Fade - Last Seat Standing", "The beam weakens, the ushers close in, and one last survivor tries to outlast both the movie and the building."],
]);

appendMilestones(AIRPORT_ERA_MILESTONE_STAGES, [
  ["Terminal Sweep - Coffee and Damage Control", "The terminal stays bright, the coffee gets worse, and every surviving Squig starts moving like they've been delayed for years."],
  ["Board Flip - Hope Reassigned", "A single gate update sends luggage wheels screaming and reroutes half the survivor pool into fresh confusion."],
  ["Seat Hunt - Outlet War Continues", "Open chairs vanish instantly, and any visible plug becomes sovereign territory defended by cables and spite."],
  ["Connection Risk Window", "Everyone with a layover starts doing desperate arithmetic while the airport quietly sharpens the knife."],
  ["Courtesy Announcement Spiral", "Polite overhead language masks increasingly catastrophic truths about crews, weather, and basic human timelines."],
  ["Terminal Train Anxiety", "Doors slide open, people surge in, and every surviving Squig starts treating public transit like a boss fight."],
  ["Food Court Relapse", "The fries are stale, the prices are criminal, and still the survivors line up for false comfort."],
  ["Gate Compression Event", "Three flights now share one zone, making personal space feel like an old luxury from another civilization."],
  ["Standby Screen Theology", "The list changes by one name at a time, and the Squigs begin praying to pure spreadsheet behavior."],
  ["Delayed Again - Soul Fatigue", "Another update lands with no real information, and morale drops straight through the terminal floor."],
  ["Rain Cell Excuse Hour", "Somewhere beyond the runway, bad weather continues doing public relations for failure."],
  ["Customer Service Pilgrimage", "The line bends around stanchions and into legend, populated by the desperate and the nearly feral."],
  ["Charger Brick Economy", "Portable batteries, borrowed cables, and suspicious generosity become the last functioning currency in the terminal."],
  ["Baggage Rumor Bloom", "A whisper about diverted luggage reaches the gate and instantly destabilizes everyone still pretending to be calm."],
  ["Group Boarding Fraud", "Zone numbers are called, ignored, and spiritually reinvented by every survivor within earshot."],
  ["Jet Bridge Mirage", "The doorway opens just enough to restart hope, then closes again with airport-grade cruelty."],
  ["Manifest Shuffle", "Seat maps mutate, upgrades vanish, and the few remaining Squigs begin negotiating with impossible geometry."],
  ["Overhead Bin Doctrine", "Carry-ons become contested philosophy as the jet bridge backs up with rolling evidence of poor judgment."],
  ["Taxiway Rumor Cycle", "Someone's cousin's app says movement is happening, and that flimsy hope immediately infects the whole gate."],
  ["Airline App Collapse", "Notifications arrive late, out of order, and with just enough confidence to cause fresh panic."],
  ["Tarmac Heat Distortion", "The windows shimmer, the departures freeze, and all certainty melts into gate-area superstition."],
  ["Crew Sighting - False Resurrection", "A uniform appears in the distance and the terminal nearly worships before learning it belongs to the wrong flight."],
  ["Voucher Line Expansion", "Compensation becomes its own side quest, complete with paperwork, shrugs, and stale snacks."],
  ["Hotel Counter Hunger Games", "The stranded move as one toward lodging answers that were never designed for this many survivors."],
  ["Rental Car Delusion", "Someone suggests driving instead, and suddenly the airport is full of tiny doomed strategists."],
  ["Midnight Gate Drift", "Shops shutter, voices thin out, and the surviving Squigs enter the weird fluorescent after-hours layer of travel."],
  ["Red-Eye Boarding Psychology", "Exhaustion flattens everyone into the same haunted expression, but the competition remains intensely personal."],
  ["Morning Reset - Same Disaster", "Sunlight returns just in time to reveal that absolutely none of the important problems have moved."],
  ["Breakfast Queue Realignment", "Coffee, eggs, and regret form a new line while the gate screen continues radiating controlled harm."],
  ["Customs of Delay", "The rules of the terminal change by the hour, and every remaining Squig is now accidentally an expert in suffering."],
  ["Rebooking Round Two", "Previous plans are abandoned, recreated, and abandoned again under the watchful glow of customer service monitors."],
  ["Regional Transfer Gamble", "Smaller aircraft and stranger routes appear, tempting the reckless into fresh aviation folklore."],
  ["Gate Agent Mythic Tier", "The last staff member with answers becomes a near-religious figure surrounded by chargers, carry-ons, and desperation."],
  ["Boarding Reopened - Stampede Lite", "The call returns unexpectedly, and everyone instantly remembers how to run badly with luggage."],
  ["Seat Assignment Duel", "Two boarding passes, one row, and no patience remain between the final travelers and airborne survival."],
  ["Door Close Warning", "Every remaining second grows sharp as the plane threatens to leave with or without the last terminal legends."],
  ["Pushback Promise", "At last the aircraft moves, but not enough for anyone to fully trust what their own eyes are telling them."],
  ["Return to Gate Betrayal", "A tiny mechanical issue turns forward motion into fresh humiliation for the few survivors still emotionally invested."],
  ["Final Rebook Horizon", "No one remembers the original itinerary anymore. Only the last airport Squigs still believe arrival exists."],
  ["Departure Board Endgame", "The screens glow, the last announcements crackle, and one final survivor tries to beat the terminal before it rewrites them too."],
]);

const RELOADED_LORE_LINES = [
"🌀 {player} asked the portal for directions. It responded with 47 pages of updated terms and conditions.",
"🧹 {player} has swept the same patch of floor for an hour. The dirt apparently has respawn enabled.",
"🧬 {player}'s rare trait started giving financial advice. Its entire strategy is 'acquire more brooms.'",
"📢 {player} typed 'gm' in six Discord channels and immediately requested the rest of the day off.",
"🧪 {player} drank the control sample because the label seemed overly confident.",
"🌍 {player} discovered Earth has taxes and began searching for the emergency return portal.",
"🪩 {player} mistook a disco ball for a shattered moon and has already negotiated a peace treaty.",
"🧻 {player} discovered toilet paper and listed three rolls as limited-edition ancient Earth scrolls.",
"📉 {player} bought the floor and received eight square feet of laminate covered in mop water.",
"🧠 {player} attempted to think outside the box while refusing to physically leave the box.",
"🛒 {player} named a shopping cart the Terrestrial Liquidity Vehicle and is now seeking investors.",
"👁️ {player}'s eye trait keeps winking at the moderators in a pattern that violates several server rules.",
"🧤 {player} placed oven mitts over their ears and declared themselves fully protected from human cuisine.",
"🗑️ {player} found a bin labelled 'metadata' and began searching for a less embarrassing personality.",
"🚪 {player} opened a supply closet, saw an unnatural purple glow, and responsibly waited four seconds before entering.",
"🪙 {player} tried tipping a Roomba and accidentally became the majority shareholder of its cleaning route.",
"🎨 {player} changed backgrounds twice and updated their bio to 'focused on personal growth.'",
"🛜 {player} blamed portal latency for a decision made nowhere near a functioning portal.",
"🧃 {player} called juice 'fruit alpha' and had their laboratory speaking privileges permanently revoked.",
"🫡 {player} saluted the Ugly Labs broom closet after learning senior management holds meetings inside."
];


const RELOADED_MILESTONE_STAGES = [
["Reload Sequence — Mint Condition*",
"The new Squigs arrive polished, unstable, and immediately begin pressing controls labelled DO NOT TOUCH."],

["Trait Calibration — Results May Vary",
"Eyes blink sideways, hats develop opinions, and one background quietly spreads into the staff kitchen."],

["Portal Test 01 — Earth Adjacent",
"The portal reaches Earth, technically, but unloads everyone into a hardware store twelve minutes after closing."],

["Discord Onboarding — Ping Responsibly",
"Roles multiply, notifications detonate, and the Squigs discover that nobody reads the announcements until something goes wrong."],

["Floor Discovery — Literal Alpha",
"Several Squigs begin sweeping beneath the charts after concluding that liquidity must be trapped under the tiles."],

["Broom Protocol — Privileges Escalated",
"The cleaning equipment receives cosmic firmware and immediately gains more authority than half of Ugly Labs."],

["Metadata Refresh — Identity Pending",
"Traits rearrange themselves in public while the team confidently insists everything is displaying exactly as intended."],

["Earth Week One — Degen Contamination",
"The Squigs learn charts, slang, and the dangerous confidence created by three consecutive green candles."],

["Trait Rebellion — Accessories Assemble",
"Hats, mouths, eyes, and backgrounds form rival factions, each promising utility and none providing a roadmap."],

["Portal Spill — Mop the Fabric of Reality",
"Purple energy floods the laboratory and the newly sentient brooms begin charging fees to cross it."],

["Ugly Labs Stand-up — Situation Remains Ugly",
"Every experiment is metaphorically on fire, except the one currently under administrative review for being actually on fire."],

["Community Call — Unmuted by Nature",
"Six Squigs speak simultaneously, one shares the wrong screen, and the host has apparently left the dimension."],

["Rare Trait Panic — Source: Trust Me",
"Rumours outperform evidence as ordinary accessories receive valuations normally reserved for small islands."],

["Sweep Cycle Two — Floor Resistance",
"The tiles reject cleaning, liquidity, and every Squig unable to demonstrate sufficiently strong conviction."],

["Cosmic Patch Notes — New Bugs Added",
"Reality receives an emergency hotfix that repairs one portal and gives gravity three experimental settings."],

["Earth Culture Exam — Open Discord",
"The remaining Squigs copy one another's answers and collectively conclude that sandwiches are a form of governance."],

["Portal Merge Conflict — Choose Neither",
"Two exits attempt to occupy the same doorway while version control labels the entire laboratory emotionally incompatible."],

["Trait Support — Ticket Storm",
"Every mouth files complaints against every eye while the backgrounds demand recognition as independent ecosystems."],

["Degen Night Shift — Sleep Deprecated",
"Charts glow, judgement fades, and the survivors begin mistaking exhaustion for advanced market intuition."],

["BroomDAO Vote — Governance Swept Aside",
"A proposal to sweep clockwise passes, fails, and passes again before anyone confirms the location of the floor."],

["Metadata Basement — Attributes Unfiltered",
"The Squigs descend beneath the collection into raw data, where names are temporary and cached mistakes live forever."],

["Portal Weather — Sideways with a Chance of Chaos",
"Cosmic winds tear through the lab, rearranging furniture, traits, and several opinions previously described as permanent."],

["Normality Audit — Anomaly Detected",
"Inspectors searching for sensible behaviour discover one suspiciously average Squig hiding behind the accounting department."],

["Collection Sync — Heavy Token Traffic",
"Thousands of portraits queue for one unstable portal while the server fan begins whispering forgotten seed phrases."],

["Ugly Labs Cleanup — Mess Is Structural",
"Every available broom is deployed at once, revealing that several major disasters are currently load-bearing."],

["Discord Slowmode — Consequences Unrestricted",
"Messages arrive one at a time while the resulting disasters continue operating without rate limits."],

["Trait Singularity — Cosmetic Event Horizon",
"Every accessory collapses into one impossible trait that immediately creates its own Discord server."],

["Liquidity Sweep — Wet Floor Market",
"A mop bucket becomes the laboratory's largest market maker and begins demanding favourable trading conditions."],

["Final Portal Window — Destination Unclear",
"The remaining exits flicker between home, Earth, and a suspiciously furnished broom closet labelled EXECUTIVE."],

["Reloaded Endgame — Too Ugly to Fail",
"Only the least explainable Squigs remain, which Ugly Labs officially records as successful quality control."],

["Last Trait Standing — Improperly Documented",
"The metadata settles, Discord falls briefly silent, and one completely unverified Squig remains undeniably present."]
];


const RELOADED_STORIES = {
hidingSpots: [
"Inside a forgotten metadata field, {victim} waited quietly until the entire sentence was marked deprecated.",
"What appeared to be floor liquidity survived unnoticed until the industrial mop discovered it was actually {victim}.",
"Behind the portal stabilizer, {victim} found perfect cover and an automatic export route to an unsupported chain.",
"A rare background agreed to hide {victim}, then delisted them for negatively affecting the composition.",
"The broom closet protected {victim} until its residents held an emergency vote to remove unauthorized debris.",
"Forty thousand unread messages buried {victim} safely inside a muted Discord channel until the moderators clicked 'Mark All as Read.'",
"By posing as an ordinary Earth object, {victim} became the first thing removed for violating Ugly Labs design standards.",
"Routine collection maintenance unchecked the trait filter containing {victim}, removing them from all known search results.",
"An error log provided shelter for {victim} right up until someone solved the issue by clicking 'Clear All.'",
"Beneath the laboratory rug, {victim} discovered that the decorative pattern was actually a tightly rolled wormhole.",
"A suspicious green candle concealed {victim} perfectly until the market corrected and took both of them down.",
"For maximum stealth, {victim} compressed into a thumbnail and never successfully loaded again.",
"Holder verification protected {victim} for almost seven minutes before their role expired halfway through a plea for help.",
"The unclaimed mop bucket seemed safe until it bridged {victim} into a janitorial ecosystem with no return route.",
"A stack of failed experiments hid {victim} until management relabelled the entire pile 'Production Ready.'",
"After entering a cardboard portal marked BETA, {victim} became a broken image icon with excellent uptime.",
"Nobody noticed {victim} hiding inside the pinned announcement, including the moderator who eventually deleted it unread.",
"Beneath the estimated gas fee, {victim} remained unseen until network congestion flattened everything nearby.",
"An oversized hoodie trait swallowed {victim} completely before being sent through the laboratory wash cycle.",
"Dark mode kept {victim} concealed behind the artificial moon until someone changed the server theme.",
"The unreleased roadmap draft sheltered {victim} until Ugly Labs accidentally published and deleted it within the same minute.",
"Inside the wallet connection window, {victim} stayed perfectly still while every available account selected 'Reject.'",
"Six hundred impatient refreshes finally crushed the hiding place {victim} had chosen beneath the reload button.",
"An offline Discord bot stored {victim} safely in memory until an unexpected factory reset restored everything except them.",
"Behind a Legendary 1/1, {victim} passed unnoticed until the owner zoomed in and reported an unexplained common trait.",
"Cached metadata kept {victim} alive until someone performed the collection's first genuinely successful hard refresh.",
"Management never checked the folder marked COMING SOON, making it ideal for {victim} until the feature unexpectedly launched.",
"Accounting opened the TAX DOCUMENTS closet for the first time in recorded history and found a deeply disappointed {victim}.",
"Disguised as part of a QR code, {victim} survived until the camera refused to focus and the poster entered recycling.",
"The terms and conditions contained {victim} for months before a legal update replaced the section without anyone reading either version."
],

clumsiness: [
"A second click on 'Reveal Traits' launched {victim} through a ceiling portal the first click had not displayed.",
"While attempting to sweep the floor price upward, {victim} rode the broom directly beyond the collection boundary.",
"The emergency metadata button looked load-bearing, so {victim} leaned against it and was immediately renamed null.",
"Mistaking portal residue for an energy drink left {victim} buffering indefinitely somewhere above Cleveland.",
"Without warning, the hat trait belonging to {victim} expanded into a deeply unfashionable weather system.",
"The cosmic anomaly looked photographable until the image preview closed around {victim}.",
"One fake collaboration link later, {victim} was trapped in a universe where every surface required selecting all the traffic lights.",
"While checking beneath a wet-floor sign for liquidity, {victim} slipped on the only warning available.",
"Setting the background to transparent worked perfectly, which is why Ugly Labs immediately lost {victim}.",
"The portal was plugged into itself by {victim}, producing one extremely compact loading spinner.",
"A formal duel with the Roomba ended when it calmly pushed {victim} beyond render distance.",
"Earth's gravity slider reached maximum moments before {victim} became permanent basement inventory.",
"After equipping every available trait at once, {victim} was rejected by the metadata for showing off.",
"An urgent notification ping led {victim} through three channels and directly into an archived portal thread.",
"For a better view, {victim} stood on the mint button and was permanently issued as laboratory furniture.",
"The phrase 'What could go wrong?' activated every nearby experiment except the one containing {victim}'s common sense.",
"Using a token ID as a boarding pass sent {victim} directly to oversized baggage.",
"Portal reception improved briefly when {victim} raised a cosmic broom overhead and became its antenna.",
"While trying to remove a suspicious message, {victim} selected themselves and confidently clicked 'Hide Spam.'",
"Slippage was set to one hundred percent moments before {victim} disappeared through the laboratory floor.",
"A celebratory reveal-day backflip placed {victim} permanently inside the unrevealed placeholder image.",
"The glowing button explicitly said DO NOT LICK, which {victim} interpreted as incomplete testing instructions.",
"Among forty-seven open browser tabs, one was a portal; session recovery restored every tab except {victim}.",
"Synchronizing traits with a disco ball transformed {victim} into reflected light with no physical roadmap.",
"To improve liquidity, {victim} poured juice into the portal and was processed as a beverage.",
"The elevator marked L2 carried {victim} to a Layer 2 network unsupported by everyone currently employed.",
"A complimentary towel convinced {victim} that the burn address was probably some kind of spa.",
"Despite being clearly marked DECORATIVE, the rare hat was used by {victim} as an emergency parachute.",
"Crouching during the collection photo caused {victim} to be cropped out of reality at full resolution.",
"Holder verification failed because {victim} was holding a door, and the bot assigned every available role to the door."
],

sabotage: [
"The glowing broom was a rideable whitelist spot, {killer} promised. Deep-clean mode introduced itself to {victim} shortly afterward.",
"Moments before cleanup began, {killer} changed the rarity of {victim} to 'common household dust.'",
"A portal giveaway shared by {killer} awarded {victim} the grand prize of permanent dimensional exile.",
"According to {killer}, the floor chart was completely safe to use as a trampoline. {victim} landed exactly when the candle closed red.",
"Ugly Labs received a report from {killer} classifying {victim} as a failed experiment and approved it without requesting evidence.",
"The background behind {victim} became an active wormhole after {killer} quietly swapped the trait and requested complete stillness.",
"A mop labelled LIQUIDITY TOOL was handed to {victim} by {killer}, along with directions toward the largest cosmic spill.",
"After muting every warning from {victim}, {killer} invited the self-aware eye traits into the channel.",
"The metadata freezer preserved rarity, or so {killer} explained while locking {victim} inside it.",
"Five minutes before laboratory cleanup, {killer} added {victim} to the inventory under 'Miscellaneous Floor Items.'",
"The RANDOM CHAIN button looked harmless once {killer} removed the travel warnings and dared {victim} to press it.",
"A replacement roadmap supplied by {killer} guided {victim} directly into the industrial broom testing lane.",
"Moderators responded immediately after {killer} reported {victim} for displaying an unacceptable level of normality.",
"The mouth trait belonging to {victim} could definitely negotiate with the garbage disposal portal, according to {killer}.",
"A cursed accessory arrived in the wallet of {victim}, courtesy of {killer}, and immediately assumed full control.",
"Exclusive alpha waited behind the laboratory door, {killer} claimed, before activating the ceiling-mounted leaf blower on {victim}.",
"Fake patch notes from {killer} informed {victim} that gravity had become optional and could safely be disabled.",
"While {victim} was distracted, {killer} replaced their connected wallet with a library card and initiated portal verification.",
"The burn address was described by {killer} as a private wellness retreat, complete with a towel reserved for {victim}.",
"Spoiler tags concealed the name of {victim} moments before {killer} convinced moderators to purge every spoiler in the channel.",
"Opacity dropped to one percent after {killer} edited the settings of {victim} and notified the cleaners about a faint stain.",
"Every route on the premium exit map sold by {killer} delivered {victim} to the same broom testing chamber.",
"The emergency ejection switch became CLAIM ALPHA after {killer} changed the label and invited {victim} to move quickly.",
"Portal output was connected directly to the headphones of {victim} while {killer} promised an unforgettable bass drop.",
"A LEGENDARY sticker placed by {killer} convinced {victim} to inspect the cosmic disposal hatch from inside.",
"Confidence was all anyone needed to defeat a Roomba, explained {killer} while handing fabricated duel instructions to {victim}.",
"Every notification belonging to {victim} was rerouted by {killer} through an industrial portal ventilation fan.",
"The chair beneath {victim} became an open cross-chain bridge after a last-second furniture adjustment by {killer}.",
"A high-yield staking opportunity offered by {killer} placed {victim} inside a supply locker with an undisclosed lockup period.",
"Support received a ticket from {killer} requesting removal of the duplicate {victim} and completed the request without identifying the original."
],

resurrections: [
"During a routine metadata rollback, one deprecated trait, two spelling errors, and {victim} returned unexpectedly.",
"The return receipt presented by {victim} was rejected so forcefully that the portal threw them back into the game.",
"Moving backward through time, a confused broom deposited {victim} beside the wet-floor sign.",
"A Discord cache refresh restored 9,000 notifications, three deleted memes, and {victim} with absolutely no context.",
"By reclassifying the experiment as 'unexpectedly successful,' Ugly Labs revived {victim} through administrative policy.",
"Two incompatible traits collided and respawned {victim} wearing both hats involved in the accident.",
"Restoring the previous collection metadata brought {victim} back at twelve percent opacity.",
"After blinking twice, the self-aware eye trait ejected a living and deeply offended {victim} from its pupil.",
"One degen purchased the wrong floor and accidentally lifted {victim} out of the mop bucket.",
"From the portal recycle bin emerged a functional copy of {victim} named 'final_FINAL_2.png.'",
"The wrong Discord thread was unarchived, allowing {victim} to walk out and immediately continue an old argument.",
"For the first recorded time, the laboratory undo button worked and returned {victim} to everyone else's disappointment.",
"A delayed transaction finally confirmed, placing {victim} back into the competition several disasters behind schedule.",
"Unable to reach quorum without another member, the remaining traits voted unanimously to restore {victim}.",
"A sudden rise in the floor price lifted {victim} out of basement inventory and back into active circulation.",
"Someone kicked the laboratory router, causing the broken image icon representing {victim} to load normally.",
"Reversing the latest broom firmware update also reversed the sweep that had removed {victim}.",
"After six to eight business dimensions, portal support finally reviewed and approved the appeal submitted by {victim}.",
"An abandoned browser session reopened with one tab still running and {victim} standing patiently inside it.",
"The cursed accessory controlling {victim} became bored, disconnected itself, and released its host back into the game.",
"A typo discovered in the elimination command gave Ugly Labs no choice but to quietly restore {victim}.",
"Once the wet floor dried, {victim} peeled away from the tile and resumed competing as though nothing had happened.",
"An off-by-one error in the leaderboard audit revealed that {victim} had been eliminated from the wrong position.",
"Scanning the cosmic receipt for a refund caused the universe to return {victim} in mostly original condition.",
"When the unclaimed inventory automatically restocked, one confused but functional {victim} appeared among the supplies.",
"Resetting the trait filter to 'Show All' revealed that {victim} had technically never left.",
"A chain reorganization reversed several questionable transactions, including the elimination of {victim}.",
"The Roomba emptied its dust compartment and released {victim}, who immediately demanded another duel.",
"Legacy support restored a deprecated metadata field along with everything still stored inside it, including {victim}.",
"A passenger-manifest glitch duplicated the final portal entry and printed one replacement {victim}."
]
};


const RELOADED_ERA = {
  key: "reloaded",
  label: "RELOADED",
  loreLines: RELOADED_LORE_LINES,
  milestoneStages: RELOADED_MILESTONE_STAGES.map(([title, flavor]) => ({ title, flavor })),
  stories: RELOADED_STORIES,
  milestoneImage: {
    urlPrefix: "http://viewer.squigs.io/images/",
    urlSuffix: ".png",
    minTokenId: 1,
    maxTokenId: 4444,
  },
  useEraLockedImagesOnly: true,
};

const UGLY_CITY_BASE_IMAGE_PROMPT = [
  "Use the attached Squig image or images as exact character references. Preserve each Squig’s exact face, body shape, skin color, eyes, ears, hair, hat, clothing, accessories, markings, proportions, personality, and intentionally ugly charm. Do not redesign, merge, simplify, humanize, or replace the Squigs. If multiple Squigs are attached, include them as separate individual characters and keep each one recognizable.",
  "Create the entire scene in the same visual style as the attached Squigs: clean flat vector cartoon art, thick black outlines, simple bold shapes, bright pastel colors, playful ugly energy, minimal shading, expressive faces, and a slightly chaotic meme-ready composition. The setting should look like part of Ugly City, a ridiculous half-built cartoon city made from bad decisions, scrap materials, crooked signs, duct tape, mismatched buildings, and community chaos.",
  "Make the Squigs the focus of the image. The scene should clearly show the milestone event in progress, with the Squigs actively building, exploring, getting into trouble, or being removed from the active crew in a funny non-violent cartoon way. No gore, no death, no horror, no realistic violence. Keep it funny, chaotic, colorful, and readable as a square 1:1 image.",
].join("\n\n");

const UGLY_CITY_CURATED_IMAGE_PROMPTS = [
  "Show the attached Squig or Squigs claiming a dusty empty lot as the beginning of Ugly City. Include a crooked “WELCOME TO UGLY CITY” sign falling over, fake permits blowing through the dirt, scattered shovels, and the Squigs looking way too proud of absolutely nothing.",
  "Show the Squigs building the first camp from ripped tarps, scrap wood, bent poles, and badly tied ropes. Include tents leaning in every direction, one sleeping bag dragging someone away, and the whole scene feeling like a terrible but enthusiastic community campsite.",
  "Show the Squigs building Ugly City’s first dirt road, which loops in a useless circle around the empty lot. Include crooked road signs, a tiny steamroller, dust clouds, one Squig confused by the circular road, and construction chaos everywhere.",
  "Show the Squigs opening a chaotic storage yard filled with crates, barrels, pallets, and labels that all say “IMPORTANT UGLY STUFF.” Include boxes stacked too high, one crate tipping open, and the Squigs trying to organize supplies very badly.",
  "Show the Squigs inside a ridiculous workshop full of unsafe cartoon tools, oversized hammers, drills, saws, clamps, and unfinished inventions. Make it look like the city’s first attempt at productivity went immediately wrong.",
  "Show the Squigs celebrating the opening of Ugly City’s junkyard, surrounded by towering piles of scrap metal, broken appliances, rusty shopping carts, old signs, bent pipes, and weird treasures. Include one huge scrap pile starting to collapse in a funny cartoon way.",
  "Show the Squigs raising a crooked water tower above Ugly City, with leaks spraying everywhere and loose pipes shaking under pressure. Include a giant tank, ladders, puddles, panicked but funny expressions, and a Squig getting blasted by cartoon water pressure.",
  "Show the Squigs exploring the first sewer tunnels beneath Ugly City, with glowing puddles, dripping pipes, traffic cones, weird tunnel signs, and suspicious slime. Make the scene funny and gross, not scary, with one Squig peeking into a “shortcut maybe” tunnel.",
  "Show the Squigs setting up Ugly City’s first trailer park with crooked trailers, mismatched lawn chairs, tiny fences, loose wheels, and ugly decorations. Include one trailer being accidentally towed away while the others proudly admire their new luxury district.",
  "Show the Squigs cutting the ribbon on a ridiculous bridge crossing a tiny ditch. The bridge should look overbuilt, crooked, and unstable, with loose planks, a sagging rope rail, and Squigs acting like it is a major engineering achievement.",
  "Show the Squigs inside Ugly City’s newly built hospital made from junkyard parts, duct tape, crooked medical signs, and questionable machines. Include an experimental medical machine launching someone upward in a harmless cartoon way, with confused Squigs in fake doctor gear.",
  "Show the Squigs opening a tiny Ugly City police station with crooked bars, flashing lights, evidence boxes, and a sign that says “NO LOOKING TOO ORGANIZED.” Include one Squig being hauled into the evidence locker for looking suspiciously prepared.",
  "Show the Squigs at Ugly City’s fire hall, with a tiny fire truck that only turns left, a shiny fire pole, tangled hoses, helmets, and dramatic sirens. Include one Squig spinning down the pole into a laundry basket while others panic badly.",
  "Show the Squigs holding Ugly City’s first town hall meeting inside a crooked civic building. Include stacks of paperwork, a tiny mayor chair, complaint forms, bad charts, and Squigs arguing over useless rules and fake taxes.",
  "Show the Squigs opening the first Ugly City school, with crooked desks, a chalkboard full of terrible construction lessons, hallway passes, lockers, and safety posters nobody follows. Make it feel like chaos disguised as education.",
  "Show the Squigs running Ugly City’s post office with one mailbox, too many packages, stamps everywhere, sorting bins, and carts going the wrong direction. Include one Squig being accidentally labeled “FRAGILE” or “RETURN TO UGLY.”",
  "Show the Squigs turning on Ugly City’s power plant, filled with giant levers, glowing gauges, warning signs, sparks, and pipes. Make the plant look powered by bad decisions, with lights flickering on across the city in the background.",
  "Show the Squigs opening Ugly City’s bank, with a tiny vault, bottle caps, fake money, casino coupons, pneumatic tubes, and a nervous teller window. Include one Squig being sucked into a tube or locked near the vault in a funny way.",
  "Show the Squigs standing outside a tall crooked apartment block with too many windows, uneven balconies, strange pipes, and an elevator door that opens to nowhere. Include tenants peeking from windows and one Squig stuck in a model unit.",
  "Show the Squigs inside a huge messy warehouse full of crates, forklifts, pallets, shrink wrap, and mystery orders. Include signs for impossible aisles, one Squig wrapped to a pallet, and the others trying to keep inventory with no success.",
  "Show the Squigs opening a crowded Ugly City market with stalls selling bent nails, mystery fruit, weird tools, and bad advice. Include bargain signs, chaotic vendors, and one Squig being traded for buckets and a coupon.",
  "Show the Squigs at a strange Ugly City gas station with two pumps, a tiny convenience store, suspicious hot dogs, air pumps, and a car wash. Include one Squig trapped in the car wash or floating after using the air pump.",
  "Show the Squigs opening a restaurant called “Probably Edible,” with crooked tables, mystery food, wobbly chairs, and a kitchen full of steam. Include one Squig disappearing through swinging kitchen doors while others inspect the menu with concern.",
  "Show the Squigs inside Ugly City’s shopping mall, where every store says “COMING SOON.” Include a sideways escalator, a dramatic fountain, sale signs, empty storefronts, and Squigs looking both excited and deeply confused.",
  "Show the Squigs in a buzzing arcade with glowing cabinets, sticky floors, prize counters, claw machines, tickets, and old game screens. Include one Squig trapped inside a claw machine as a prize and another becoming part of a high score board.",
  "Show the Squigs checking into Ugly City’s hotel, with a crooked front desk, tiny soaps, luggage carts, weird carpets, and an elevator that opens to the wrong place. Make the lobby feel fancy but deeply questionable.",
  "Show the Squigs running Ugly City’s factory with assembly lines, conveyor belts, boxes, warning signs, and machines producing useless items like left shoes. Include one Squig accidentally boxed as a limited edition factory product.",
  "Show the Squigs opening the harbor with crooked docks, cargo containers, nets, tiny boats, and water nobody wants to test. Include one Squig tangled in a shipping net while another cargo boat drifts away.",
  "Show the Squigs at the grand opening of Ugly City’s casino, with slot machines, rubber chicken jackpots, poker chips, cheap carpets, and a mysterious High Rollers Lounge. Make everyone look like they have no idea how gambling works.",
  "Show the Squigs trapped in an Ugly City office building full of cubicles, bad lighting, meetings, coffee cups, whiteboards, and endless paperwork. Include one Squig getting promoted into a doorless department while another gets buried in sticky notes.",
  "Show the Squigs opening a ridiculous zoo with empty cages, fake animal signs, penguins claiming one Squig, and an exhibit labeled “RARE UGLY.” Make it look like the Squigs accidentally became the main attraction.",
  "Show the Squigs inside a cloudy aquarium with tanks, bubbles, strange fish, touch pools, and leaking glass. Include one Squig being classified as marine life and another peeking from a filter room.",
  "Show the Squigs at a dangerous-looking but fun Ugly City theme park with a crooked roller coaster, mascot tunnel, bright signs, and rides built from spare bridge parts. Include one Squig stuck on an endless coaster loop.",
  "Show the Squigs inside a sticky-floored movie theater with a giant screen, popcorn buckets, recliner seats, and dramatic previews. Include one Squig folded into a recliner while another peeks behind the screen.",
  "Show the Squigs at a bowling alley with crooked lanes, weird rental shoes, glowing scoreboards, and bowling balls that look too motivated. Include one Squig being swept toward the pin machine in a harmless cartoon way.",
  "Show the Squigs opening a museum of Ugly City history, with artifacts from earlier districts, misspelled plaques, wax displays, and dramatic velvet ropes. Include one Squig mistaken for an ancient artifact behind glass.",
  "Show the Squigs enjoying Ugly City’s beach with questionable water, crooked umbrellas, sandcastles, snack stands, and inflatable chairs. Include one Squig buried inside an overbuilt sandcastle while another drifts away on a float.",
  "Show the Squigs inside a concert hall with a huge stage, curtains, speakers, lights, and instruments nobody can play responsibly. Include a sound check blasting one Squig into the balcony curtains in a funny cartoon way.",
  "Show the Squigs in a stadium where nobody agreed on the sport, with goalposts, cones, marching band gear, mascot carts, and confused referees. Make it look like every game is happening at once.",
  "Show the Squigs at an Ugly City nightclub with fog machines, flashing lights, a pulsing dance floor, velvet ropes, and a dramatic DJ booth. Include one Squig failing the vibe check at the VIP section.",
  "Show the Squigs at a train station with too many platforms, confusing signs, delayed boards, suitcases, and a train arriving from nowhere. Include one Squig boarding the wrong express while another gets stuck in the announcement booth.",
  "Show the Squigs underground in a subway station with tunnels that twist strangely, turnstiles, route maps, flickering lights, and a train labeled “PLATFORM NOPE.” Include one Squig trapped at a turnstile demanding exact change.",
  "Show the Squigs at Ugly City airport with one runway, luggage carts, check-in counters, mystery gates, and departure boards full of question marks. Include one Squig coming through baggage claim with an oversized tag.",
  "Show the Squigs at Ugly City University with crooked lecture halls, campus signs, diplomas, lockers, and a class called “Advanced Ugliness.” Make it feel like nobody is qualified to teach or learn there.",
  "Show the Squigs in a research lab with glowing beakers, warning labels, testing chambers, big red buttons, and questionable science machines. Include one Squig stepping into a “personality rinse” chamber while others take notes badly.",
  "Show the Squigs broadcasting live from Ugly City’s TV station with cameras, stage lights, weather maps, microphones, and breaking news graphics. Include one Squig stuck in the weather map pointing at fake storms.",
  "Show the Squigs at a hilltop observatory with a giant telescope, star charts, glowing sky, and suspicious space objects. Include one Squig climbing into the telescope lens while others stare at a confusing star map.",
  "Show the Squigs building crooked skyscrapers high above Ugly City, with cranes, window-washing baskets, revolving doors, and tiny clouds. Include one Squig stuck between floors while the skyline looks proud and unstable.",
  "Show the Squigs in Ugly City’s luxury district with gold-painted fountains, velvet ropes, tiny robes, fancy signs, and fake elegance. Make everything look expensive but still deeply ugly and poorly built.",
  "Show the Squigs discovering Old Town, an older dusty part of Ugly City with cobblestone paths, ancient crooked doors, old signs, and mysterious mailboxes. Make it feel like the city was ugly long before anyone admitted it.",
  "Show the Squigs inside the Mayor’s Office with an empty chair, cold coffee, complaint papers, unsigned disaster approvals, filing cabinets, and a too-important desk. Include one Squig buried in complaints.",
  "Show the Squigs opening Founders Plaza with crooked benches, uneven bricks, dedication plaques, a tiny parade float, and ceremonial ribbon. Include one Squig accidentally cemented into the walkway as “interactive history.”",
  "Show the Squigs building a giant crooked city monument that is supposed to look heroic but mostly looks confused. Include scaffolding, cranes, dust, and one Squig stuck inside the base as the statue tilts into place.",
  "Show the Squigs opening a hidden vault beneath the city monument, filled with bottle caps, fake treasure, glowing locks, and strange old city plans. Include a huge slow-closing vault door and Squigs scrambling comically.",
  "Show the Squigs exploring The Underground, a secret second city beneath Ugly City with glowing arrows, maintenance tunnels, weird trams, and pipes everywhere. Include a mysterious crew of signs, tools, and strange underground doors.",
  "Show the Squigs opening the Grand Gate of Ugly City, a huge crooked entrance with banners, turnstiles, flags, and bad decorations. Include one giant turnstile causing chaos while the Squigs celebrate too early.",
  "Show the Squigs building Ugly Castle with crooked towers, squeaky drawbridge, a tiny moat, cardboard crowns, and dramatic flags. Include one Squig stuck in a tower with no stairs and another crossing the drawbridge at the worst possible moment.",
  "Show the Squigs inside the Hall of Survivors with portraits, plaques, trophies, curtains, and names spelled wrong on purpose. Include one Squig posing forever for an unfinished painting while another hides behind a portrait.",
  "Show the Squigs gathered around The Crown on a velvet pillow in the center of Ugly City. Include a ceremonial chair, applause machine, banners, dramatic lighting, and the Squigs acting like leadership is both exciting and dangerous.",
  "Show the Squigs making final adjustments to the Founder’s Statue, a huge heroic but ugly statue with scaffolding, cracked stone, tools, and dramatic city skyline behind it. Include one Squig sealed comically into the pedestal as a “structural contribution.”",
  "Show the Squigs inside Ugly City’s courthouse with a crooked judge bench, jury box, legal papers, evidence boxes, and a dramatic gavel. Include one Squig trapped in jury duty while another is found guilty of leaning on evidence.",
  "Show the Squigs waiting inside the Permit Office with endless chairs, numbered tickets, windows that are closed, and stacks of forms. Include one Squig stamped “PENDING” while another waits at a window that does not exist.",
  "Show the Squigs at a recycling center turning old junk into new junk, with conveyor belts, sorting bins, warning labels, and piles of questionable materials. Include one Squig sorted into the wrong bin with a confused label.",
  "Show the Squigs at a bus depot full of buses marked “OUT OF SERVICE” that are somehow still moving. Include route signs, benches, tickets, and one Squig looping forever on Route 0.",
  "Show the Squigs inside a crooked library with whispering signs, tall shelves, overdue notices, and books rearranging themselves. Include one Squig trapped in the overdue section and another stepping into a pop-up book.",
  "Show the Squigs inside a laundromat with shaking washers, spinning dryers, soap bubbles, lost socks, and static electricity. Include one Squig tumbling out folded and confused while another is stuck in the permanent press cycle.",
  "Show the Squigs at a chaotic food court with too many restaurants, one unreadable menu, trays, sauces, sample spoons, and fry smells. Include one Squig trapped in the sample line forever.",
  "Show the Squigs in Ugly City park with three crooked trees, benches, a pond that reflects everyone uglier, and ceremonial ribbon around a sapling. Include one Squig tangled in ribbon like protected greenery.",
  "Show the Squigs inside a pawn shop packed with lost city items, cursed trophies, lamps, coupons, tools, and price tags based on confidence. Include one Squig displayed behind glass as a rare collectible.",
  "Show the Squigs high above Ugly City in the rooftop district, with ladders, chimneys, rooftop bridges, pigeons, antennas, and city skyline below. Include one Squig stranded on a chimney while a ladder refuses to help.",
  "Show the Squigs broadcasting from a tall radio tower with antennas, wires, microphones, speakers, and static bolts. Include one Squig stuck on the antenna while another becomes part of a traffic report.",
  "Show the Squigs at a weather station with wind tunnels, radar screens, fake storm maps, fog machines, rain gauges, and warning flags. Include one Squig being blown across the scene by a test wind tunnel.",
  "Show the Squigs at an absurd toll booth on a bad road, with exact change signs, coin baskets, traffic cones, and a line of confused vehicles. Include one Squig stuck arguing with the booth over a missing coin.",
  "Show the Squigs lost inside a huge parking garage with spiral ramps, arrows pointing nowhere, ticket machines, compact spaces, and echoing honks. Include one Squig parked in a tiny compact spot with a parking ticket.",
  "Show the Squigs inside the Department of Bad Decisions, a government office approving terrible plans with stamps, charts, forms, and warning signs. Include one Squig being promoted to Assistant Mistake Manager.",
  "Show the Squigs waiting at the Ugly DMV with endless chairs, number signs, bad photo booths, forms, and windows that never open. Include one Squig failing the photo test for looking too prepared.",
  "Show the Squigs at the City Dump, an even worse version of the Junkyard with trash hills, rejected appliances, old mattresses, raccoon-like chaos, and rolling tires. Include one Squig mistaken for a rejected appliance.",
  "Show the Squigs building or riding along a strange canal through Ugly City, with lock gates, tiny boats, murky water, and crooked bridges. Include one Squig drifting away in a maintenance boat while others operate gates badly.",
  "Show the Squigs at a ferry terminal with a late ferry, damp tickets, life jackets, dock ropes, signs for “SOMEWHERE DAMP,” and water travel confusion. Include one Squig trapped inside a life jacket demonstration.",
  "Show the Squigs on a crooked boardwalk with carnival games, greasy snacks, prize booths, loose planks, cotton candy, and pier lights. Include one Squig falling through a loose board into prize storage.",
  "Show the Squigs at a flickering Ugly City motel with tiny rooms, brick keychains, suspicious ice machine, peeling signs, and weird doors. Include one Squig checking into room 13, which is actually a closet.",
  "Show the Squigs hosting a chaotic convention center event with booths, banners, folding tables, keynote stage, lanyards, and panels about city disasters. Include one Squig stuck behind a booth selling emergency whistles.",
  "Show the Squigs at a bright but suspicious ice cream stand with strange flavors, freezer truck, cones, sprinkles, and a soft-serve machine. Include one Squig stuck in the soft-serve swirl in a harmless cartoon way.",
  "Show the Squigs inside the Underground Mall beneath the subway, with closed kiosks, identical candle shops, escalators going too deep, and strange neon signs. Include one Squig lost between two identical stores.",
  "Show the Squigs building a giant crooked clock tower displaying four different times. Include gears, bells, ropes, ladders, and one Squig stuck inside the clock hands at “quarter past nope.”",
  "Show the Squigs at a questionable water park with crooked slides, wave pool, lazy river, inflatable tubes, and lifeguard signs wearing sunglasses. Include one Squig stuck in the longest slide while another floats in the aggressively lazy river.",
  "Show the Squigs inside a community center with folding chairs, activity posters, sign-up sheets, lost-and-found bins, nametags, and awkward classes. Include one Squig teaching “Advanced Standing Around.”",
  "Show the Squigs inside a tattoo shop with buzzing machines, flash sheets, waiver forms, mirrors, and designs that look like city warning signs. Include one Squig trapped in an oversized tattoo waiver.",
  "Show the Squigs at a newsstand with flying newspapers, insulting headlines, crossword puzzles, and papers reporting events before they happen. Include one Squig folded into the Sunday edition as a special insert.",
  "Show the Squigs running a soup kitchen with a giant bubbling pot, bowls, ladles, folding tables, and recipes that change on the wall. Include one Squig assigned to stir forever like they have ladle authority.",
  "Show the Squigs inside a security office with camera monitors, case files, flickering screens, walkie-talkies, and suspicious shadows. Include monitors showing every district except the one they need.",
  "Show the Squigs at an elevated monorail station above Ugly City with one sleek train, unstable supports, tourist brochures, and scenic overlook signs. Include one Squig stuck at the scenic overlook while the train keeps looping.",
  "Show the Squigs in a botanical garden with warning-labeled plants, glowing flowers, greenhouse glass, vines, and weird pollen. Include one Squig hugged by a vine with boundary issues.",
  "Show the Squigs inside a statue factory making confused heroic monuments, with plaster molds, chisels, cranes, half-finished statues, and polishing machines. Include one Squig accidentally cast as a temporary mold.",
  "Show the Squigs at an emergency bunker with a heavy hatch, canned beans, whistles, warning posters, drills, and maps. Include one Squig locked inside during a drill while others argue over whether that means it worked.",
  "Show the Squigs inside the Records Office with filing cabinets, archive stacks, personal files, complaint records, and folders labeled with every city disaster. Include one Squig misfiled under “miscellaneous structures.”",
  "Show the Squigs in The Last Alley, a narrow crooked alley full of dumpsters, flickering signs, trash cans, brick walls, and suspicious dead ends. Include one dumpster lid opening like someone might return from inside.",
  "Show the Squigs facing the Final Permit Desk in the middle of the road, like a cartoon final boss made of paperwork. Include a tiny clerk window, approval stamps, endless forms, and one Squig sent back for missing initials.",
  "Show the Squigs climbing the grand City Hall steps with banners, dust, a ceremonial carpet, guest seating, and the final doors ahead. Include one Squig tripping over the carpet into committee review while the others keep climbing.",
  "Show the final surviving Squig or remaining Squigs inside the Founder’s Office, with a crooked desk, cracked nameplate, important chair, city plans, and a window overlooking all of Ugly City. Make it feel like the end of a ridiculous journey, with the Founder’s title about to be claimed.",
];

const UGLY_CITY_CURATED_CHAPTER_KEYS = [
  "empty_lot",
  "first_camp",
  "dirt_road",
  "storage_yard",
  "workshop",
  "junkyard",
  "water_tower",
  "sewer",
  "trailer_park",
  "bridge",
  "hospital",
  "police_station",
  "fire_hall",
  "town_hall",
  "school",
  "post_office",
  "power_plant",
  "bank",
  "apartment_block",
  "warehouse",
  "market",
  "gas_station",
  "restaurant",
  "shopping_mall",
  "arcade",
  "hotel",
  "factory",
  "harbor",
  "casino",
  "office_building",
  "zoo",
  "aquarium",
  "theme_park",
  "movie_theater",
  "bowling_alley",
  "museum",
  "beach",
  "concert_hall",
  "sports_stadium",
  "nightclub",
  "train_station",
  "subway",
  "airport",
  "university",
  "research_lab",
  "tv_station",
  "observatory",
  "skyscrapers",
  "luxury_district",
  "old_town",
  "mayors_office",
  "founders_plaza",
  "city_monument",
  "the_vault",
  "the_underground",
  "grand_gate",
  "ugly_castle",
  "hall_of_survivors",
  "the_crown",
  "founders_statue",
  "courthouse",
  "permit_office",
  "recycling_center",
  "bus_depot",
  "library",
  "laundromat",
  "food_court",
  "city_park",
  "pawn_shop",
  "rooftop_district",
  "radio_tower",
  "weather_station",
  "toll_booth",
  "parking_garage",
  "department_of_bad_decisions",
  "ugly_dmv",
  "city_dump",
  "canal",
  "ferry_terminal",
  "boardwalk",
  "motel",
  "convention_center",
  "ice_cream_stand",
  "underground_mall",
  "clock_tower",
  "water_park",
  "community_center",
  "tattoo_shop",
  "newsstand",
  "soup_kitchen",
  "security_office",
  "monorail",
  "botanical_garden",
  "statue_factory",
  "emergency_bunker",
  "records_office",
  "the_last_alley",
  "final_permit_desk",
  "city_hall_steps",
  "founders_office",
];

const UGLY_CITY_CURATED_CHAPTERS = [
  {
    district: "Empty Lot",
    story: "The crew claimed a dusty patch of nothing and proudly declared it the future home of Ugly City, even though the welcome sign was already leaning the wrong way. Before the first shovel hit the dirt, {removed1} got trapped under the crooked sign while {removed2} wandered off chasing a fake permit across the lot.",
    singleRemovalStory: "The crew claimed a dusty patch of nothing and proudly declared it the future home of Ugly City, even though the welcome sign was already leaning the wrong way. Before the first shovel hit the dirt, {removed1} got trapped under the crooked sign and was officially removed from active construction.",
    revivalStory: "The crew claimed a dusty patch of nothing and proudly declared it the future home of Ugly City, only to find {revived} already sleeping under the crooked welcome sign like they owned the place. The reunion lasted until {removed1} got pinned beneath the sign and {removed2} wandered off chasing a fake permit across the lot.",
    next: "The crew needs shelter, so the First Camp is already a bad idea waiting to happen."
  },
  {
    district: "First Camp",
    story: "The Squigs built the First Camp from scrap wood, ripped tarps, and the kind of confidence only Uglies should be allowed to have. By nightfall, {removed1} had been zipped inside the wrong tent for structural support while {removed2} got dragged away by a runaway sleeping bag.",
    singleRemovalStory: "The Squigs built the First Camp from scrap wood, ripped tarps, and the kind of confidence only Uglies should be allowed to have. By nightfall, {removed1} had been zipped inside the wrong tent for structural support and nobody could figure out which flap opened.",
    revivalStory: "The Squigs built the First Camp from scrap wood, ripped tarps, and suspiciously sticky rope, then discovered {revived} hiding in a supply crate labeled “Definitely Not A Squig.” By nightfall, {removed1} had been zipped inside the wrong tent while {removed2} got dragged away by a runaway sleeping bag.",
    next: "The camp needs a road, which is unfortunate because nobody brought a level."
  },
  {
    district: "Dirt Road",
    story: "Ugly City’s first Dirt Road was supposed to connect the camp to the rest of absolutely nothing. Instead, {removed1} followed the road in a perfect circle until they gave up, while {removed2} was accidentally paved into the soft shoulder by an overexcited roller.",
    singleRemovalStory: "Ugly City’s first Dirt Road was supposed to connect the camp to the rest of absolutely nothing. Instead, {removed1} followed the road in a perfect circle until they gave up and became the city’s first official traffic concern.",
    revivalStory: "Ugly City’s first Dirt Road somehow led directly to {revived}, who had been walking in circles since the Empty Lot and insisted they were “almost there.” The celebration ended when {removed1} got lost on the loop and {removed2} was accidentally paved into the soft shoulder by an overexcited roller.",
    next: "With supplies scattered everywhere, the crew decides to build a Storage Yard."
  },
  {
    district: "Storage Yard",
    story: "The Storage Yard opened with every crate carefully labeled, then immediately became impossible to navigate because every label said “important ugly stuff.” {removed1} climbed into a box to check inventory and got shipped to the wrong pile, while {removed2} disappeared behind a stack of mystery barrels marked “probably fine.”",
    singleRemovalStory: "The Storage Yard opened with every crate carefully labeled, then immediately became impossible to navigate because every label said “important ugly stuff.” {removed1} climbed into a box to check inventory and got shipped to the wrong pile before anyone noticed.",
    revivalStory: "The Storage Yard opened with every crate labeled “important ugly stuff,” including one that started yelling until the crew pried it open and found {revived} inside. Unfortunately, {removed1} got shipped to the wrong pile and {removed2} disappeared behind mystery barrels marked “probably fine.”",
    next: "The crew needs tools, so construction begins on the Workshop."
  },
  {
    district: "Workshop",
    story: "The Workshop was built so the Squigs could finally make proper tools, but every machine seemed to have been designed by someone who hated fingers and common sense. {removed1} got stuck inside the automatic hammer tester while {removed2} was carried away by a drill press that apparently had places to be.",
    singleRemovalStory: "The Workshop was built so the Squigs could finally make proper tools, but every machine seemed to have been designed by someone who hated fingers and common sense. {removed1} got stuck inside the automatic hammer tester and was declared unavailable for future measuring.",
    revivalStory: "The Workshop opened with a loud clang, a bad smell, and {revived} crawling out from behind the tool wall wearing safety goggles upside down. Then {removed1} got stuck inside the automatic hammer tester while {removed2} was carried away by a drill press that apparently had places to be.",
    next: "The broken tools need somewhere to go, so the Junkyard becomes inevitable."
  },
  {
    district: "Junkyard",
    story: "The survivors finally finished stacking enough scrap to create Ugly City’s official Junkyard, proudly insisting every twisted piece of metal would come in handy someday. Moments after celebrating, the tallest pile gave way without warning, burying {removed1} beneath a mountain of junk while {removed2} disappeared trying to pull them free before the dust settled.",
    singleRemovalStory: "The survivors finally finished stacking enough scrap to create Ugly City’s official Junkyard, proudly insisting every twisted piece of metal would come in handy someday. Moments after celebrating, the tallest pile gave way without warning and buried {removed1} beneath a mountain of highly questionable materials.",
    revivalStory: "The Junkyard opened with a ceremonial toss of a broken toaster, which immediately bounced off a pile and revealed {revived} living inside an old fridge like it was a condo. The celebration ended when the tallest scrap mountain collapsed, swallowing {removed1} and {removed2} into the junk.",
    next: "With dust everywhere and no clean water, the crew turns its attention to the Water Tower."
  },
  {
    district: "Water Tower",
    story: "The Water Tower rose above Ugly City like a proud metal mushroom, leaking from only seven places at once. During the first pressure test, {removed1} was blasted into a pile of wet sand while {removed2} climbed inside to investigate and floated out through a pipe nobody remembered installing.",
    singleRemovalStory: "The Water Tower rose above Ugly City like a proud metal mushroom, leaking from only seven places at once. During the first pressure test, {removed1} was blasted into a pile of wet sand and removed from the crew until they stopped dripping.",
    revivalStory: "The Water Tower’s first leak produced more than water when {revived} shot out of a pipe and landed in the mud claiming they had “been plumbing.” Then the pressure test launched {removed1} into wet sand while {removed2} floated away through a pipe nobody remembered installing.",
    next: "All that water has to drain somewhere, so the Sewer plan gets approved against everyone’s judgment."
  },
  {
    district: "Sewer",
    story: "The Sewer was supposed to carry water away from Ugly City, but it mostly carried rumors, weird echoes, and one smell nobody could name. {removed1} followed a glowing puddle around the wrong corner while {removed2} got sucked into a maintenance tunnel labeled “shortcut maybe.”",
    singleRemovalStory: "The Sewer was supposed to carry water away from Ugly City, but it mostly carried rumors, weird echoes, and one smell nobody could name. {removed1} followed a glowing puddle around the wrong corner and became part of the underground problem.",
    revivalStory: "Deep in the Sewer, the crew heard banging from inside a traffic cone fortress and found {revived} living comfortably with a throne made of pipe fittings. The reunion ended when {removed1} followed a glowing puddle around the wrong corner and {removed2} got sucked into a tunnel labeled “shortcut maybe.”",
    next: "The crew climbs back above ground and decides permanent housing is somehow the next priority."
  },
  {
    district: "Trailer Park",
    story: "The Trailer Park became Ugly City’s first residential district, mostly because the trailers were already halfway falling into place. {removed1} tried leveling one with a crowbar and got locked inside forever storage, while {removed2} accidentally hitched themselves to a moving trailer headed toward the horizon.",
    singleRemovalStory: "The Trailer Park became Ugly City’s first residential district, mostly because the trailers were already halfway falling into place. {removed1} tried leveling one with a crowbar and got locked inside forever storage before the keys were even invented.",
    revivalStory: "The Trailer Park grand opening was interrupted when {revived} stepped out of a trailer bathroom they had apparently been renting since Chapter One. Then {removed1} got locked inside forever storage while {removed2} accidentally hitched themselves to a moving trailer headed toward the horizon.",
    next: "To connect the growing mess, the crew decides Ugly City needs a Bridge."
  },
  {
    district: "Bridge",
    story: "The Bridge was designed to cross a tiny ditch, but the crew built it like they were challenging physics personally. Halfway through the ribbon cutting, {removed1} slid between two loose planks while {removed2} chased the ribbon over the side and landed in the municipal shrub pile.",
    singleRemovalStory: "The Bridge was designed to cross a tiny ditch, but the crew built it like they were challenging physics personally. Halfway through the ribbon cutting, {removed1} slid between two loose planks and became a caution sign with legs.",
    revivalStory: "The Bridge ceremony paused when {revived} crawled out from under the planks and claimed they had been “checking the underside for vibes.” Then {removed1} slipped through two loose boards and {removed2} chased the ribbon over the side into the shrub pile.",
    next: "With everyone somehow injured, the Hospital finally becomes impossible to ignore."
  },
  {
    district: "Hospital",
    story: "After borrowing parts from the Junkyard, the crew built a Hospital that looked only slightly more dangerous than the injuries it was treating. The opening exam ended when {removed1} and {removed2} tested an experimental machine that launched them straight through the roof.",
    singleRemovalStory: "After borrowing parts from the Junkyard, the crew built a Hospital that looked only slightly more dangerous than the injuries it was treating. The opening exam ended when {removed1} tested an experimental machine and was launched straight through the roof.",
    revivalStory: "After borrowing parts from the Junkyard, the crew built a Hospital that looked only slightly more dangerous than the injuries it was treating. While searching a forgotten supply room, they found {revived} wrapped in bandages and eating pudding, but the celebration ended when {removed1} and {removed2} tested an experimental machine that launched them through the roof.",
    next: "Someone should probably build a Police Station before things get worse."
  },
  {
    district: "Police Station",
    story: "The Police Station opened with exactly one rule: nobody was allowed to look suspiciously organized. {removed1} was hauled into the evidence locker for carrying a clipboard, while {removed2} got arrested after confessing to crimes nobody had reported yet.",
    singleRemovalStory: "The Police Station opened with exactly one rule: nobody was allowed to look suspiciously organized. {removed1} was hauled into the evidence locker for carrying a clipboard and the key was immediately misplaced.",
    revivalStory: "The Police Station opened with a dramatic siren test and accidentally released {revived} from a holding cell they had been using as a nap room. Minutes later, {removed1} was hauled into evidence for carrying a clipboard while {removed2} confessed to crimes nobody had reported yet.",
    next: "The crew decides a Fire Hall is needed, mostly because the Police Station is smoking."
  },
  {
    district: "Fire Hall",
    story: "The Fire Hall was built with a shiny pole, a crooked garage door, and a truck that only turned left. During the first drill, {removed1} got launched down the pole into a laundry basket while {removed2} drove the truck in circles until nobody could catch them.",
    singleRemovalStory: "The Fire Hall was built with a shiny pole, a crooked garage door, and a truck that only turned left. During the first drill, {removed1} got launched down the pole into a laundry basket and was declared too folded to continue.",
    revivalStory: "The Fire Hall’s siren accidentally called {revived} back from wherever they had been hiding, and they arrived wearing a helmet made of soup cans. Then {removed1} got launched down the pole into a laundry basket while {removed2} drove the truck in circles until nobody could catch them.",
    next: "The city needs leadership, which is how Town Hall becomes everyone’s next mistake."
  },
  {
    district: "Town Hall",
    story: "Town Hall opened with a serious meeting about rules, taxes, and whether chewing on blueprints counted as participation. {removed1} was trapped in a committee that refused to adjourn, while {removed2} got sealed behind a wall of paperwork taller than the mayor’s chair.",
    singleRemovalStory: "Town Hall opened with a serious meeting about rules, taxes, and whether chewing on blueprints counted as participation. {removed1} was trapped in a committee that refused to adjourn and slowly became part of the agenda.",
    revivalStory: "Town Hall’s first roll call accidentally included {revived}, who popped out from behind the mayor’s chair and demanded back pay. Then {removed1} got trapped in a committee that refused to adjourn while {removed2} disappeared behind a wall of paperwork.",
    next: "The crew decides education might fix things, so the School is doomed from the start."
  },
  {
    district: "School",
    story: "The School opened to teach basic construction, public safety, and how not to lick wet paint. {removed1} failed recess and got locked in the supply closet, while {removed2} followed a hallway pass so far they transferred to a different district.",
    singleRemovalStory: "The School opened to teach basic construction, public safety, and how not to lick wet paint. {removed1} failed recess and got locked in the supply closet by a door labeled “advanced learning.”",
    revivalStory: "The School’s first lesson was interrupted when {revived} crawled out of a locker covered in gold stars and claimed they had perfect attendance. Then {removed1} failed recess and {removed2} followed a hallway pass all the way to another district.",
    next: "The city needs mail, even though nobody knows their address."
  },
  {
    district: "Post Office",
    story: "The Post Office opened with one mailbox, twelve stamps, and no agreement on where Ugly City actually was. {removed1} climbed into a sorting bin and got labeled “fragile,” while {removed2} chased a delivery cart through a back door marked “out for delivery forever.”",
    singleRemovalStory: "The Post Office opened with one mailbox, twelve stamps, and no agreement on where Ugly City actually was. {removed1} climbed into a sorting bin and got labeled “fragile” before being routed to an unknown counter.",
    revivalStory: "The Post Office found its first undeliverable package, and inside was {revived} with a note that simply read “return to ugly.” Then {removed1} got labeled fragile in a sorting bin while {removed2} chased a delivery cart into forever delivery.",
    next: "With mail barely functioning, the crew somehow decides to build a Power Plant."
  },
  {
    district: "Power Plant",
    story: "The Power Plant promised to bring electricity to Ugly City, assuming anyone could figure out which lever was decorative. When the lights flickered on, {removed1} got stuck in a rotating warning sign while {removed2} was assigned to watch a gauge in a room nobody could reopen.",
    singleRemovalStory: "The Power Plant promised to bring electricity to Ugly City, assuming anyone could figure out which lever was decorative. When the lights flickered on, {removed1} got stuck in a rotating warning sign and became part of the display.",
    revivalStory: "The Power Plant came online with a loud buzz and spat {revived} out of a cable tunnel holding a wrench they definitely did not earn. Then {removed1} got stuck in a rotating warning sign while {removed2} was assigned to watch a gauge in a room nobody could reopen.",
    next: "Now that the lights work, the crew makes the terrible decision to open a Bank."
  },
  {
    district: "Bank",
    story: "The Bank opened to store the city’s wealth, which currently consisted of bottle caps, casino coupons, and one suspiciously valuable wrench. {removed1} got locked in the vault during a practice deposit, while {removed2} was carried away by a pneumatic tube after trying to withdraw dignity.",
    singleRemovalStory: "The Bank opened to store the city’s wealth, which currently consisted of bottle caps, casino coupons, and one suspiciously valuable wrench. {removed1} got locked in the vault during a practice deposit and the combination was immediately voted private.",
    revivalStory: "The Bank vault opened for the first time and revealed {revived} counting bottle caps like they had been appointed treasurer. The audit went poorly when {removed1} got locked in the vault and {removed2} was carried away by a pneumatic tube after trying to withdraw dignity.",
    next: "With money now technically existing, the crew starts stacking the first Apartment Block."
  },
  {
    district: "Apartment Block",
    story: "The Apartment Block rose five crooked floors above Ugly City and somehow had six basements. {removed1} entered the elevator on floor two and arrived nowhere, while {removed2} got stuck in a model unit that the leasing office refused to admit existed.",
    singleRemovalStory: "The Apartment Block rose five crooked floors above Ugly City and somehow had six basements. {removed1} entered the elevator on floor two and arrived nowhere, making them the building’s first unresolved maintenance request.",
    revivalStory: "The Apartment Block’s first tenant meeting revealed {revived} living in the walls and complaining about noise like a true resident. Then {removed1} entered an elevator to nowhere while {removed2} got stuck inside a model unit the leasing office denied building.",
    next: "The city needs bulk storage, so a Warehouse is about to become everyone’s problem."
  },
  {
    district: "Warehouse",
    story: "The Warehouse was built to organize Ugly City’s supplies, but it immediately filled with crates nobody remembered ordering. {removed1} followed a forklift into aisle thirteen and vanished from the inventory, while {removed2} was shrink-wrapped to a pallet labeled “later.”",
    singleRemovalStory: "The Warehouse was built to organize Ugly City’s supplies, but it immediately filled with crates nobody remembered ordering. {removed1} followed a forklift into aisle thirteen and vanished from the inventory.",
    revivalStory: "The Warehouse crew opened a crate marked “miscellaneous regret” and found {revived} inside, surrounded by packing peanuts and confidence. Then {removed1} disappeared into aisle thirteen while {removed2} was shrink-wrapped to a pallet labeled “later.”",
    next: "With supplies everywhere, the Market opens before anyone can stop it."
  },
  {
    district: "Market",
    story: "The Market opened with stalls selling bent nails, mystery fruit, and advice nobody asked for. {removed1} got traded for three buckets and a coupon, while {removed2} followed a vendor into a tent that packed itself up and left.",
    singleRemovalStory: "The Market opened with stalls selling bent nails, mystery fruit, and advice nobody asked for. {removed1} got traded for three buckets and a coupon, which everyone agreed was a surprisingly fair price.",
    revivalStory: "At the back of the Market, {revived} was found running a booth called “Definitely Not Missing,” selling maps to places they had never been. Moments later, {removed1} was traded for three buckets and {removed2} vanished with a self-packing vendor tent.",
    next: "The crew needs fuel, snacks, and worse decisions, so the Gas Station is next."
  },
  {
    district: "Gas Station",
    story: "The Gas Station opened with two pumps, one squeaky door, and hot dogs that were already under investigation. {removed1} got trapped inside the automatic car wash without a car, while {removed2} inflated themselves at the air pump and drifted into traffic control.",
    singleRemovalStory: "The Gas Station opened with two pumps, one squeaky door, and hot dogs that were already under investigation. {removed1} got trapped inside the automatic car wash without a car and came out looking legally different.",
    revivalStory: "The Gas Station freezer made a loud thunk and {revived} fell out holding a frozen burrito like it was survival gear. The reunion ended when {removed1} got trapped in the car wash and {removed2} inflated themselves at the air pump.",
    next: "The city is hungry, which means the Restaurant is about to lower every standard."
  },
  {
    district: "Restaurant",
    story: "The Restaurant opened under the name “Probably Edible,” which was somehow the safest part of the business plan. {removed1} disappeared into the kitchen after asking about ingredients, while {removed2} got seated at a table so wobbly it migrated out the back door.",
    singleRemovalStory: "The Restaurant opened under the name “Probably Edible,” which was somehow the safest part of the business plan. {removed1} disappeared into the kitchen after asking about ingredients and was added to the waitlist instead.",
    revivalStory: "During the first lunch rush, {revived} crawled out of the walk-in cooler claiming they had been “marinating emotionally.” Then {removed1} vanished into the kitchen and {removed2} rode a wobbly table straight out the back door.",
    next: "With commerce booming terribly, the crew builds a Shopping Mall."
  },
  {
    district: "Shopping Mall",
    story: "The Shopping Mall opened with every store marked “Coming Soon” and a fountain that seemed personally offended by coins. {removed1} got trapped in an escalator that only went sideways, while {removed2} followed a sale sign into a store that vanished after closing.",
    singleRemovalStory: "The Shopping Mall opened with every store marked “Coming Soon” and a fountain that seemed personally offended by coins. {removed1} got trapped in an escalator that only went sideways and became part of mall security’s problem.",
    revivalStory: "The Shopping Mall information desk finally answered the phone and revealed {revived} had been working there under a fake name. Then {removed1} got trapped in a sideways escalator while {removed2} followed a sale sign into a store that vanished after closing.",
    next: "The crew finds a pile of old machines and declares the Arcade open."
  },
  {
    district: "Arcade",
    story: "The Arcade opened with buzzing machines, sticky floors, and prizes that looked like they had seen too much. {removed1} got pulled into a claw machine after reaching for a plush, while {removed2} challenged the high score cabinet and was absorbed into the leaderboard.",
    singleRemovalStory: "The Arcade opened with buzzing machines, sticky floors, and prizes that looked like they had seen too much. {removed1} got pulled into a claw machine after reaching for a plush and was listed as a medium prize.",
    revivalStory: "The Arcade’s oldest cabinet flashed “CONTINUE?” and released {revived} from the coin slot covered in tickets. Before anyone could celebrate, {removed1} got caught in the claw machine and {removed2} was absorbed into the high score board.",
    next: "Visitors need somewhere questionable to sleep, so the Hotel checks in."
  },
  {
    district: "Hotel",
    story: "The Hotel opened with one working bell, infinite tiny soaps, and a lobby carpet that whispered complaints. {removed1} took the elevator to the mezzanine and never found the lobby again, while {removed2} was locked out on the balcony of a room nobody rented.",
    singleRemovalStory: "The Hotel opened with one working bell, infinite tiny soaps, and a lobby carpet that whispered complaints. {removed1} took the elevator to the mezzanine and never found the lobby again.",
    revivalStory: "Housekeeping knocked on room 404 and found {revived} inside wearing a robe and claiming late checkout. Then {removed1} got lost in the mezzanine elevator and {removed2} was locked out on the balcony of a room nobody rented.",
    next: "The city wants production, so the Factory starts making things nobody ordered."
  },
  {
    district: "Factory",
    story: "The Factory opened to mass-produce useful supplies, but the first assembly line only made left shoes and emotional damage. {removed1} got boxed as a limited edition part, while {removed2} rode the conveyor belt into quality control and failed twice.",
    singleRemovalStory: "The Factory opened to mass-produce useful supplies, but the first assembly line only made left shoes and emotional damage. {removed1} got boxed as a limited edition part and nobody wanted to break the seal.",
    revivalStory: "The Factory whistle blew and {revived} rolled out of the assembly line with a sticker that said “inspected eventually.” Then {removed1} got boxed as a limited edition part while {removed2} rode the conveyor into quality control and failed twice.",
    next: "With goods piling up, the Harbor becomes Ugly City’s next terrible expansion."
  },
  {
    district: "Harbor",
    story: "The Harbor opened on a body of water nobody remembered naming, with docks that bobbed like they were laughing. {removed1} got tangled in a net meant for shipping crates, while {removed2} boarded a cargo boat that immediately backed away from responsibility.",
    singleRemovalStory: "The Harbor opened on a body of water nobody remembered naming, with docks that bobbed like they were laughing. {removed1} got tangled in a net meant for shipping crates and was accidentally scheduled for export.",
    revivalStory: "The first cargo container washed ashore and inside was {revived}, eating crackers and insisting the trip was “mostly scenic.” Then {removed1} got tangled in a shipping net while {removed2} boarded a boat that backed away from responsibility.",
    next: "With shipping handled badly, the Casino opens for even worse math."
  },
  {
    district: "Casino",
    story: "The Casino opened to overwhelming excitement, mostly because nobody understood the rules. {removed1} bet the city’s entire concrete supply on one spin while {removed2} claimed to have a guaranteed system, and both vanished into the High Rollers Lounge after losing to a machine shaped like a raccoon.",
    singleRemovalStory: "The Casino opened to overwhelming excitement, mostly because nobody understood the rules. {removed1} bet the city’s entire concrete supply on one spin and vanished into the High Rollers Lounge after losing to a machine shaped like a raccoon.",
    revivalStory: "The Casino buffet line suddenly produced {revived}, who claimed they had been comped a room after getting lost weeks ago. Then {removed1} bet the city’s concrete supply on one spin while {removed2} followed a guaranteed system into the High Rollers Lounge.",
    next: "The city needs paperwork and bad coffee, so the Office Building goes up."
  },
  {
    district: "Office Building",
    story: "The Office Building opened with cubicles, flickering lights, and meetings about meetings nobody attended. {removed1} got promoted into a department with no exit, while {removed2} disappeared after being asked to circle back on something urgent.",
    singleRemovalStory: "The Office Building opened with cubicles, flickering lights, and meetings about meetings nobody attended. {removed1} got promoted into a department with no exit and was last seen updating a spreadsheet nobody needed.",
    revivalStory: "The Office Building printer jammed, screamed, and released {revived} holding a stack of reports titled “Where I Have Been.” Then {removed1} got promoted into a department with no exit while {removed2} vanished after being asked to circle back.",
    next: "The crew decides the city needs animals, which means the Zoo is already a liability."
  },
  {
    district: "Zoo",
    story: "The Zoo opened with empty cages, confusing signs, and a suspicious feeling that the exhibits were judging everyone. {removed1} accidentally became part of the rare Ugly habitat, while {removed2} was adopted by the penguins and refused to explain why.",
    singleRemovalStory: "The Zoo opened with empty cages, confusing signs, and a suspicious feeling that the exhibits were judging everyone. {removed1} accidentally became part of the rare Ugly habitat and the plaque was already printed.",
    revivalStory: "The Zoo’s lost-and-found enclosure opened and revealed {revived} calmly feeding snacks to creatures nobody could identify. Then {removed1} became part of the rare Ugly habitat while {removed2} was adopted by the penguins.",
    next: "The crew adds water, glass, and more bad ideas with the Aquarium."
  },
  {
    district: "Aquarium",
    story: "The Aquarium opened with cloudy tanks, dramatic bubbles, and one fish that looked like it knew secrets. {removed1} leaned too close to the touch tank and got classified as marine life, while {removed2} followed a maintenance ladder into the filter room and never resurfaced in the tour route.",
    singleRemovalStory: "The Aquarium opened with cloudy tanks, dramatic bubbles, and one fish that looked like it knew secrets. {removed1} leaned too close to the touch tank and got classified as marine life before anyone could appeal.",
    revivalStory: "The biggest tank bubbled twice and {revived} floated up in a diving helmet, acting like this was a normal commute. Then {removed1} got classified as marine life and {removed2} disappeared into the filter room tour route.",
    next: "The crew decides fun should be louder, taller, and less inspected, so the Theme Park begins."
  },
  {
    district: "Theme Park",
    story: "The Theme Park opened with rides built from spare bridge parts and signs promising “mostly safe fun.” {removed1} got stuck on a roller coaster that refused to stop at the station, while {removed2} entered the mascot tunnel and came out on the wrong side of the map.",
    singleRemovalStory: "The Theme Park opened with rides built from spare bridge parts and signs promising “mostly safe fun.” {removed1} got stuck on a roller coaster that refused to stop at the station and kept waving every lap.",
    revivalStory: "The mascot tunnel burst open and {revived} stumbled out wearing giant foam shoes and no clear explanation. Then {removed1} got stuck on an endless roller coaster while {removed2} exited the mascot tunnel on the wrong side of the map.",
    next: "For quieter entertainment, the crew builds a Movie Theater that is definitely haunted by bad reviews."
  },
  {
    district: "Movie Theater",
    story: "The Movie Theater opened with sticky floors, one giant screen, and previews that seemed to last all afternoon. {removed1} got folded into a recliner that would not release them, while {removed2} followed the popcorn smell behind the screen and entered a staff hallway with no credits.",
    singleRemovalStory: "The Movie Theater opened with sticky floors, one giant screen, and previews that seemed to last all afternoon. {removed1} got folded into a recliner that would not release them and was listed under reserved seating.",
    revivalStory: "Halfway through the previews, the screen flickered and {revived} walked out of the movie like they had been cast without permission. Then {removed1} got folded into a recliner while {removed2} followed the popcorn smell behind the screen.",
    next: "The crew rolls directly into the Bowling Alley."
  },
  {
    district: "Bowling Alley",
    story: "The Bowling Alley opened with crooked lanes, rented shoes, and balls that seemed personally motivated. {removed1} slipped past the foul line and got swept into the pin machine, while {removed2} tried to retrieve a ball and returned only as a scoreboard error.",
    singleRemovalStory: "The Bowling Alley opened with crooked lanes, rented shoes, and balls that seemed personally motivated. {removed1} slipped past the foul line and got swept into the pin machine as a spare problem.",
    revivalStory: "The pin machine clattered loudly and spit {revived} back onto lane five with a perfect score nobody believed. Then {removed1} slipped into the pin sweeper while {removed2} vanished trying to retrieve a ball.",
    next: "The crew decides Ugly City deserves culture, so the Museum opens with immediate regrets."
  },
  {
    district: "Museum",
    story: "The Museum opened to preserve Ugly City’s history, even though most of that history had happened by accident last week. {removed1} got mistaken for an ancient artifact, while {removed2} stepped into a wax display and was roped off before they could object.",
    singleRemovalStory: "The Museum opened to preserve Ugly City’s history, even though most of that history had happened by accident last week. {removed1} got mistaken for an ancient artifact and the tour guides refused to give them back.",
    revivalStory: "The Museum unveiled a new exhibit called “Stuff We Found,” and {revived} was standing in the middle of it pretending to be priceless. Then {removed1} got labeled as an artifact while {removed2} was roped into a wax display.",
    next: "The city wants a vacation, so the Beach is somehow approved."
  },
  {
    district: "Beach",
    story: "The Beach opened beside water that was almost certainly connected to the Harbor, but nobody wanted to check. {removed1} got buried during a sandcastle competition, while {removed2} drifted away on an inflatable chair shaped like poor judgment.",
    singleRemovalStory: "The Beach opened beside water that was almost certainly connected to the Harbor, but nobody wanted to check. {removed1} got buried during a sandcastle competition and the judges called it architecture.",
    revivalStory: "A wave rolled in, dropped {revived} onto the sand wearing sunglasses, and immediately rolled back out like it had completed delivery. Then {removed1} got buried in a sandcastle competition while {removed2} drifted away on an inflatable chair.",
    next: "The crew follows the noise inland and starts building a Concert Hall."
  },
  {
    district: "Concert Hall",
    story: "The Concert Hall opened with perfect acoustics, which was unfortunate because nobody in the crew could sing responsibly. During the first sound check, {removed1} was blasted into the balcony curtains while {removed2} got sealed inside a giant speaker labeled “bass storage.”",
    singleRemovalStory: "The Concert Hall opened with perfect acoustics, which was unfortunate because nobody in the crew could sing responsibly. During the first sound check, {removed1} was blasted into the balcony curtains and remained there as decoration.",
    revivalStory: "The first drum hit shook {revived} loose from the ceiling rig, where they had apparently been living with the stage lights. Then {removed1} got blasted into the balcony curtains while {removed2} was sealed inside a giant speaker.",
    next: "The city needs sports, cheering, and medical waivers, so the Stadium begins."
  },
  {
    district: "Sports Stadium",
    story: "The Sports Stadium opened before anyone chose a sport, so the first match became a confusing mix of running, yelling, and arguing with cones. {removed1} got tackled by the marching band, while {removed2} chased the mascot cart into the tunnel and missed the rest of the season.",
    singleRemovalStory: "The Sports Stadium opened before anyone chose a sport, so the first match became a confusing mix of running, yelling, and arguing with cones. {removed1} got tackled by the marching band and was ruled out by a referee nobody hired.",
    revivalStory: "The scoreboard flickered, the crowd gasped, and {revived} climbed out from behind the home team bench pretending they had been coaching. Then {removed1} got tackled by the marching band while {removed2} chased the mascot cart into the tunnel.",
    next: "After the game, everyone makes the questionable decision to open a Nightclub."
  },
  {
    district: "Nightclub",
    story: "The Nightclub opened with fog machines, flashing lights, and a dance floor that pulsed like it had a grudge. {removed1} vanished into the VIP section after failing the vibe check, while {removed2} got carried away by a speaker stack during the bass drop.",
    singleRemovalStory: "The Nightclub opened with fog machines, flashing lights, and a dance floor that pulsed like it had a grudge. {removed1} vanished into the VIP section after failing the vibe check and the rope went back up.",
    revivalStory: "The DJ booth opened like a trapdoor and {revived} climbed out wearing headphones and pretending they had always been on the lineup. Then {removed1} failed the vibe check into the VIP section while {removed2} got carried away by the bass drop.",
    next: "The city is ready to expand beyond walking distance, so the Train Station is next."
  },
  {
    district: "Train Station",
    story: "The Train Station opened with twelve platforms and no agreement on where any tracks went. {removed1} boarded the express to an unknown stop, while {removed2} got trapped inside the announcement booth repeating “delayed” forever.",
    singleRemovalStory: "The Train Station opened with twelve platforms and no agreement on where any tracks went. {removed1} boarded the express to an unknown stop and the schedule immediately denied responsibility.",
    revivalStory: "The first arriving train screeched to a halt and {revived} stepped off holding a ticket stamped “eventually.” Then {removed1} boarded the express to an unknown stop while {removed2} got trapped in the announcement booth.",
    next: "The crew decides above-ground confusion is not enough, so the Subway begins."
  },
  {
    district: "Subway",
    story: "The Subway opened beneath Ugly City with tunnels that seemed to rearrange when nobody was looking. {removed1} took the wrong line to Platform Nope, while {removed2} got stuck behind a turnstile that demanded exact change and emotional maturity.",
    singleRemovalStory: "The Subway opened beneath Ugly City with tunnels that seemed to rearrange when nobody was looking. {removed1} took the wrong line to Platform Nope and was removed from the active map.",
    revivalStory: "The Subway doors opened with a tired beep and {revived} stepped out covered in route maps, insisting they had only missed one stop. Then {removed1} rode to Platform Nope while {removed2} got stuck behind a turnstile demanding exact change.",
    next: "With rails already suspicious, the crew somehow aims higher and builds an Airport."
  },
  {
    district: "Airport",
    story: "The Airport opened with one runway, six luggage carts, and departure boards that only displayed question marks. {removed1} boarded the wrong flight to Terminal Mystery, while {removed2} got sent through baggage claim and came out labeled oversized.",
    singleRemovalStory: "The Airport opened with one runway, six luggage carts, and departure boards that only displayed question marks. {removed1} boarded the wrong flight to Terminal Mystery and their gate changed behind them.",
    revivalStory: "Baggage claim coughed up a suitcase, then {revived} climbed out wearing a neck pillow and acting annoyed about delays. The celebration ended when {removed1} boarded the wrong flight and {removed2} came out labeled oversized baggage.",
    next: "The city gets ambitious and opens a University before anyone graduates from anything."
  },
  {
    district: "University",
    story: "The University opened to teach advanced ugliness, unstable engineering, and the history of bad municipal choices. {removed1} enrolled in a class with no syllabus, while {removed2} got lost trying to find the registrar and accidentally declared a major in confusion.",
    singleRemovalStory: "The University opened to teach advanced ugliness, unstable engineering, and the history of bad municipal choices. {removed1} enrolled in a class with no syllabus and was assigned homework forever.",
    revivalStory: "The University’s first lecture was interrupted when {revived} walked in late holding a diploma they printed themselves. Then {removed1} joined a class with no syllabus while {removed2} got lost and declared a major in confusion.",
    next: "The professors demand science, so the Research Lab opens under heavy suspicion."
  },
  {
    district: "Research Lab",
    story: "The Research Lab opened with glowing beakers, locked cabinets, and scientists who kept saying “probably stable.” {removed1} stepped into a testing chamber labeled “personality rinse,” while {removed2} pressed a red button and was reassigned to another dimension of paperwork.",
    singleRemovalStory: "The Research Lab opened with glowing beakers, locked cabinets, and scientists who kept saying “probably stable.” {removed1} stepped into a testing chamber labeled “personality rinse” and came out as a pending report.",
    revivalStory: "A lab freezer beeped three times and revealed {revived} inside, fully awake and somehow holding a clipboard. Then {removed1} entered the personality rinse chamber while {removed2} pressed a red button and was reassigned to another dimension of paperwork.",
    next: "The crew decides the city needs media coverage, so the TV Station goes live."
  },
  {
    district: "TV Station",
    story: "The TV Station went live with breaking news about itself, which felt important because nothing else was prepared. {removed1} got stuck in the weather map pointing at fake storms, while {removed2} walked onto a live set and was hired as background forever.",
    singleRemovalStory: "The TV Station went live with breaking news about itself, which felt important because nothing else was prepared. {removed1} got stuck in the weather map pointing at fake storms and could not return until the forecast improved.",
    revivalStory: "The first broadcast glitched and {revived} appeared on screen from a storage closet, calmly reading the news like nothing happened. Then {removed1} got stuck in the weather map while {removed2} was hired as live background forever.",
    next: "With cameras pointed upward, the Observatory is approved."
  },
  {
    district: "Observatory",
    story: "The Observatory opened on the highest hill in Ugly City, where the telescope immediately focused on something it refused to explain. {removed1} climbed inside to clean the lens, while {removed2} followed a star chart into a broom closet labeled “deep space.”",
    singleRemovalStory: "The Observatory opened on the highest hill in Ugly City, where the telescope immediately focused on something it refused to explain. {removed1} climbed inside to clean the lens and became part of the view.",
    revivalStory: "The telescope rotated by itself and pointed directly at {revived}, who was sitting on the roof eating snacks like a moon goblin. Then {removed1} climbed inside the lens while {removed2} followed a star chart into a broom closet labeled “deep space.”",
    next: "The city begins building upward with Skyscrapers."
  },
  {
    district: "Skyscrapers",
    story: "The first Skyscrapers rose above Ugly City in uneven towers that looked proud, nervous, and possibly inflatable. {removed1} got stuck in a window-washing basket between floors, while {removed2} entered a revolving door and completed too many revolutions to be trusted.",
    singleRemovalStory: "The first Skyscrapers rose above Ugly City in uneven towers that looked proud, nervous, and possibly inflatable. {removed1} got stuck in a window-washing basket between floors and became the skyline’s newest feature.",
    revivalStory: "During the ribbon cutting, an elevator opened from the top floor and {revived} stepped out claiming they had been “waiting for lobby service.” Then {removed1} got stuck in a window-washing basket while {removed2} spun through a revolving door one too many times.",
    next: "The rich Uglies demand luxury, and somehow the Luxury District gets approved."
  },
  {
    district: "Luxury District",
    story: "The Luxury District opened with velvet ropes, gold paint, and fountains that sprayed sparkling tap water with confidence. {removed1} was escorted away for not being ugly-rich enough, while {removed2} got trapped in a rotating closet full of tiny robes.",
    singleRemovalStory: "The Luxury District opened with velvet ropes, gold paint, and fountains that sprayed sparkling tap water with confidence. {removed1} was escorted away for not being ugly-rich enough and placed on the wrong side of the rope.",
    revivalStory: "A private elevator dinged and {revived} walked out in a bathrobe, claiming they had been upgraded by mistake. Then {removed1} was escorted away for not being ugly-rich enough while {removed2} got trapped in a rotating closet of tiny robes.",
    next: "The crew searches the oldest part of the city and finds Old Town."
  },
  {
    district: "Old Town",
    story: "Old Town appeared under a layer of dust, suggesting Ugly City may have been ugly long before anyone officially started building it. {removed1} opened an ancient door that locked politely behind them, while {removed2} followed a cobblestone path that insisted on going backward.",
    singleRemovalStory: "Old Town appeared under a layer of dust, suggesting Ugly City may have been ugly long before anyone officially started building it. {removed1} opened an ancient door that locked politely behind them and refused all appeals.",
    revivalStory: "Old Town’s oldest mailbox creaked open and {revived} climbed out with a postcard stamped from three chapters ago. Then {removed1} got locked behind an ancient door while {removed2} followed a backward cobblestone path.",
    next: "The mystery points toward leadership, so the Mayor’s Office finally opens."
  },
  {
    district: "Mayor’s Office",
    story: "The Mayor’s Office opened with an empty chair, a cold cup of coffee, and a desk full of unsigned disaster approvals. {removed1} sat in the chair and was immediately buried in complaints, while {removed2} got lost behind the filing cabinets looking for the mayor.",
    singleRemovalStory: "The Mayor’s Office opened with an empty chair, a cold cup of coffee, and a desk full of unsigned disaster approvals. {removed1} sat in the chair and was immediately buried in complaints from districts that should not exist yet.",
    revivalStory: "The Mayor’s Office closet rattled open and {revived} stepped out holding the spare keys, which raised more questions than it answered. Then {removed1} got buried in complaints while {removed2} vanished behind filing cabinets looking for the mayor.",
    next: "The crew decides the city deserves a public square, so Founders Plaza begins."
  },
  {
    district: "Founders Plaza",
    story: "Founders Plaza opened with crooked benches, uneven bricks, and plaques honoring everyone who claimed they helped. {removed1} got cemented into the dedication walkway by accident, while {removed2} followed a parade float that was supposed to be parked.",
    singleRemovalStory: "Founders Plaza opened with crooked benches, uneven bricks, and plaques honoring everyone who claimed they helped. {removed1} got cemented into the dedication walkway by accident and was described as “interactive history.”",
    revivalStory: "The dedication curtain dropped to reveal {revived} standing on the platform and waving like they had been invited. Then {removed1} got cemented into the walkway while {removed2} followed a runaway parade float out of the plaza.",
    next: "The city gets sentimental and starts building a City Monument."
  },
  {
    district: "City Monument",
    story: "The City Monument was meant to represent courage, teamwork, and extremely poor planning. As it tilted into place, {removed1} got stuck inside the base while {removed2} climbed the statue to fix its face and was carried upward by the crane.",
    singleRemovalStory: "The City Monument was meant to represent courage, teamwork, and extremely poor planning. As it tilted into place, {removed1} got stuck inside the base and became part of the inspirational message.",
    revivalStory: "When the Monument’s base cracked open, {revived} stepped out covered in dust and applause they absolutely did not earn. Then {removed1} got stuck inside the base while {removed2} was carried upward by the crane.",
    next: "Rumors spread about a hidden Vault beneath the monument."
  },
  {
    district: "The Vault",
    story: "The Vault opened under the City Monument after three wrong keys and one very persuasive kick. {removed1} stepped inside to inspect the treasure and triggered the slowest closing door in city history, while {removed2} got distracted counting bottle caps and missed the exit.",
    singleRemovalStory: "The Vault opened under the City Monument after three wrong keys and one very persuasive kick. {removed1} stepped inside to inspect the treasure and triggered the slowest closing door in city history.",
    revivalStory: "The Vault door groaned open and {revived} was already inside, sitting on a pile of bottle caps like a tiny dragon. The reunion ended when {removed1} triggered the slow closing door and {removed2} got distracted counting treasure.",
    next: "Beneath the Vault, the crew finds signs pointing toward The Underground."
  },
  {
    district: "The Underground",
    story: "The Underground stretched below Ugly City like a second city nobody wanted responsibility for. {removed1} followed a glowing arrow into a service tunnel, while {removed2} got recruited by a mysterious maintenance crew that only worked at weird hours.",
    singleRemovalStory: "The Underground stretched below Ugly City like a second city nobody wanted responsibility for. {removed1} followed a glowing arrow into a service tunnel and became part of the lower-level rumor network.",
    revivalStory: "The Underground’s secret tram arrived and {revived} stepped off wearing a reflective vest and acting like staff. Then {removed1} followed a glowing arrow into a tunnel while {removed2} got recruited by the weird-hours maintenance crew.",
    next: "The city prepares a proper entrance with the Grand Gate."
  },
  {
    district: "Grand Gate",
    story: "The Grand Gate was built to impress visitors before they realized what they had entered. During the opening ceremony, {removed1} got trapped in the giant turnstile while {removed2} was lifted away by the banner because nobody tied it down.",
    singleRemovalStory: "The Grand Gate was built to impress visitors before they realized what they had entered. During the opening ceremony, {removed1} got trapped in the giant turnstile and became the first admission problem.",
    revivalStory: "As the Grand Gate opened, {revived} wandered through holding a ticket from the original Empty Lot and demanded re-entry. Then {removed1} got trapped in the turnstile while {removed2} was lifted away by the ceremonial banner.",
    next: "The crew gets dramatic and begins work on Ugly Castle."
  },
  {
    district: "Ugly Castle",
    story: "Ugly Castle rose with crooked towers, squeaky drawbridges, and a moat that seemed mostly decorative until it moved. {removed1} got assigned to guard duty in a tower with no stairs, while {removed2} crossed the drawbridge at exactly the wrong dramatic moment.",
    singleRemovalStory: "Ugly Castle rose with crooked towers, squeaky drawbridges, and a moat that seemed mostly decorative until it moved. {removed1} got assigned to guard duty in a tower with no stairs and immediately became unreachable.",
    revivalStory: "The drawbridge lowered with a groan and {revived} walked across wearing a cardboard crown they clearly made themselves. Then {removed1} got stuck guarding a stairless tower while {removed2} crossed the drawbridge at the wrong dramatic moment.",
    next: "The city honors everyone who lasted this long with the Hall of Survivors."
  },
  {
    district: "Hall of Survivors",
    story: "The Hall of Survivors opened with portraits, plaques, and at least three names spelled wrong on purpose. {removed1} got stuck posing for a painting that refused to finish, while {removed2} stepped behind a curtain and became part of the memorial exhibit too early.",
    singleRemovalStory: "The Hall of Survivors opened with portraits, plaques, and at least three names spelled wrong on purpose. {removed1} got stuck posing for a painting that refused to finish and was declared historically busy.",
    revivalStory: "One portrait blinked, sneezed, and revealed {revived} had been hiding behind the canvas the whole time. Then {removed1} got trapped posing for an endless painting while {removed2} stepped behind the memorial curtain too early.",
    next: "The final symbol of authority is waiting: The Crown."
  },
  {
    district: "The Crown",
    story: "The Crown was placed on a velvet pillow in the center of Ugly City, glowing with the power of extremely questionable leadership. {removed1} tried it on and sank into the ceremonial chair, while {removed2} became trapped in the applause machine that would not stop celebrating.",
    singleRemovalStory: "The Crown was placed on a velvet pillow in the center of Ugly City, glowing with the power of extremely questionable leadership. {removed1} tried it on and sank into the ceremonial chair, officially becoming too fancy to continue.",
    revivalStory: "The Crown ceremony paused when {revived} emerged from beneath the velvet pillow and asked if the buffet was still open. Then {removed1} sank into the ceremonial chair while {removed2} got trapped in the applause machine.",
    next: "Only one thing remains: the Founder’s Statue."
  },
  {
    district: "Founder’s Statue",
    story: "The Founder’s Statue was carved to honor whoever survived Ugly City’s impossible rise, though nobody agreed what the face should look like. {removed1} got sealed inside the pedestal during final adjustments, while {removed2} climbed the statue to fix the nose and was claimed by the scaffolding.",
    singleRemovalStory: "The Founder’s Statue was carved to honor whoever survived Ugly City’s impossible rise, though nobody agreed what the face should look like. {removed1} got sealed inside the pedestal during final adjustments and was labeled “structural contribution.”",
    revivalStory: "The Founder’s Statue cracked at the base and {revived} stepped out claiming they had been doing “legacy research.” Then {removed1} got sealed into the pedestal while {removed2} climbed the statue and was claimed by the scaffolding.",
    next: "The city keeps growing, because apparently nobody learned anything."
  },
  {
    district: "Courthouse",
    story: "The Courthouse opened to settle disputes, but the first case was about whether the building itself had committed fraud. {removed1} was found guilty of leaning on evidence, while {removed2} got trapped in jury duty with no lunch break and no end date.",
    singleRemovalStory: "The Courthouse opened to settle disputes, but the first case was about whether the building itself had committed fraud. {removed1} was found guilty of leaning on evidence and escorted into legal uncertainty.",
    revivalStory: "The judge slammed the gavel and accidentally released {revived} from a witness booth they had been using as a studio apartment. Then {removed1} was found guilty of leaning on evidence while {removed2} got trapped in endless jury duty.",
    next: "After court, everyone is sent to the Permit Office."
  },
  {
    district: "Permit Office",
    story: "The Permit Office opened with fourteen windows and only one employee, who was somehow a filing cabinet. {removed1} took a number that never came up, while {removed2} submitted themselves as paperwork and got stamped pending.",
    singleRemovalStory: "The Permit Office opened with fourteen windows and only one employee, who was somehow a filing cabinet. {removed1} took a number that never came up and sat down with tragic patience.",
    revivalStory: "A drawer labeled “lost applications” popped open and {revived} crawled out holding a permit approved by nobody. Then {removed1} took a number that never came up while {removed2} got stamped pending.",
    next: "The city tries pretending it cares about cleanup with a Recycling Center."
  },
  {
    district: "Recycling Center",
    story: "The Recycling Center opened to turn old junk into new junk with slightly better labels. {removed1} got sorted into the wrong bin, while {removed2} rode the conveyor into a compactor that only flattened their schedule.",
    singleRemovalStory: "The Recycling Center opened to turn old junk into new junk with slightly better labels. {removed1} got sorted into the wrong bin and nobody could agree if they were paper, plastic, or emotionally reusable.",
    revivalStory: "The glass bin rattled loudly and {revived} popped out wearing a vest made of warning labels. Then {removed1} got sorted into the wrong bin while {removed2} rode the conveyor into schedule-flattening machinery.",
    next: "Public transit expands with a Bus Depot nobody trusts."
  },
  {
    district: "Bus Depot",
    story: "The Bus Depot opened with buses that all said “Out of Service” but kept moving anyway. {removed1} boarded Route 0 and looped forever, while {removed2} tried to inspect the engine and was accepted as luggage.",
    singleRemovalStory: "The Bus Depot opened with buses that all said “Out of Service” but kept moving anyway. {removed1} boarded Route 0 and looped forever past the same confused bench.",
    revivalStory: "Bus 404 pulled in late and dropped off {revived}, who insisted they had only missed their stop by eight districts. Then {removed1} boarded Route 0 forever while {removed2} was accepted as luggage during an engine inspection.",
    next: "The crew builds a Library to store books nobody will return."
  },
  {
    district: "Library",
    story: "The Library opened with crooked shelves, whispering signs, and books that seemed to rearrange themselves by insult level. {removed1} got trapped in the overdue section, while {removed2} opened a pop-up book and stepped directly into it.",
    singleRemovalStory: "The Library opened with crooked shelves, whispering signs, and books that seemed to rearrange themselves by insult level. {removed1} got trapped in the overdue section and the librarian refused to blink.",
    revivalStory: "A book titled “How To Return Dramatically” opened by itself and {revived} climbed out between chapters. Then {removed1} got trapped in the overdue section while {removed2} stepped into a pop-up book.",
    next: "The city smells worse than usual, so the Laundromat finally matters."
  },
  {
    district: "Laundromat",
    story: "The Laundromat opened with washers that shook like they had unfinished business. {removed1} got spun into the permanent press cycle, while {removed2} crawled into a dryer to check for socks and came out as static electricity with opinions.",
    singleRemovalStory: "The Laundromat opened with washers that shook like they had unfinished business. {removed1} got spun into the permanent press cycle and was declared too wrinkled for active duty.",
    revivalStory: "Dryer number six popped open and {revived} tumbled out folded, warm, and deeply confused. Then {removed1} got stuck in permanent press while {removed2} crawled into a dryer and came out as static electricity with opinions.",
    next: "Clean-ish and hungry, the crew opens the Food Court."
  },
  {
    district: "Food Court",
    story: "The Food Court opened with twelve restaurants, one menu, and no ingredients anyone could identify. {removed1} got stuck in the sample line forever, while {removed2} followed the smell of fries into a kitchen that belonged to another mall entirely.",
    singleRemovalStory: "The Food Court opened with twelve restaurants, one menu, and no ingredients anyone could identify. {removed1} got stuck in the sample line forever and kept accepting tiny spoons.",
    revivalStory: "A tray return rattled open and {revived} slid out holding three sauces and no shame. Then {removed1} got trapped in the sample line while {removed2} followed the fry smell into another mall’s kitchen.",
    next: "The city needs fresh air, so City Park gets planted sideways."
  },
  {
    district: "City Park",
    story: "City Park opened with three trees, five benches, and a pond that reflected everyone slightly uglier than reality. {removed1} got tangled in ceremonial ribbon around a sapling, while {removed2} followed a squirrel into a maintenance shed with park authority.",
    singleRemovalStory: "City Park opened with three trees, five benches, and a pond that reflected everyone slightly uglier than reality. {removed1} got tangled in ceremonial ribbon around a sapling and became protected greenery.",
    revivalStory: "The pond bubbled, sneezed, and returned {revived} to shore holding a wet map of the city. Then {removed1} got tangled around a sapling while {removed2} followed a squirrel into park authority.",
    next: "Someone starts selling questionable treasures, so the Pawn Shop opens."
  },
  {
    district: "Pawn Shop",
    story: "The Pawn Shop opened with shelves full of things the crew had lost earlier and prices based purely on confidence. {removed1} got appraised as rare and placed behind glass, while {removed2} traded themselves for a lamp and immediately regretted the paperwork.",
    singleRemovalStory: "The Pawn Shop opened with shelves full of things the crew had lost earlier and prices based purely on confidence. {removed1} got appraised as rare and placed behind glass with a tiny price tag.",
    revivalStory: "The owner opened a locked cabinet and found {revived} sitting between cursed trophies and expired coupons. Then {removed1} got appraised as rare while {removed2} traded themselves for a lamp.",
    next: "The crew heads upward into the Rooftop District."
  },
  {
    district: "Rooftop District",
    story: "The Rooftop District connected the tops of buildings with bridges, ladders, and the bad idea of trusting height. {removed1} got stranded on a chimney after a ladder unionized, while {removed2} followed a rooftop pigeon into restricted airspace.",
    singleRemovalStory: "The Rooftop District connected the tops of buildings with bridges, ladders, and the bad idea of trusting height. {removed1} got stranded on a chimney after a ladder unionized and refused to come back down.",
    revivalStory: "A rooftop hatch swung open and {revived} climbed out with a pigeon escort and a suspiciously official badge. Then {removed1} got stranded on a chimney while {removed2} followed another pigeon into restricted airspace.",
    next: "The city wants louder announcements, so the Radio Tower rises."
  },
  {
    district: "Radio Tower",
    story: "The Radio Tower began broadcasting Ugly City updates, most of which were apologies for earlier updates. {removed1} climbed up to fix the antenna and got stuck on air, while {removed2} was accidentally converted into a traffic report.",
    singleRemovalStory: "The Radio Tower began broadcasting Ugly City updates, most of which were apologies for earlier updates. {removed1} climbed up to fix the antenna and got stuck on air as background static.",
    revivalStory: "The first clear signal was just {revived} yelling from inside the transmitter room for someone to open the door. Then {removed1} got stuck on the antenna while {removed2} was accidentally converted into a traffic report.",
    next: "Forecasts become necessary, so the Weather Station opens."
  },
  {
    district: "Weather Station",
    story: "The Weather Station opened to predict rain, wind, and falling construction materials with disappointing accuracy. {removed1} got carried away by a test wind tunnel, while {removed2} was assigned to measure fog and simply became part of it.",
    singleRemovalStory: "The Weather Station opened to predict rain, wind, and falling construction materials with disappointing accuracy. {removed1} got carried away by a test wind tunnel and became tomorrow’s forecast.",
    revivalStory: "The fog machine cleared for one second and revealed {revived} standing there with a clipboard full of made-up temperatures. Then {removed1} got carried away by the wind tunnel while {removed2} was assigned to measure fog and became part of it.",
    next: "The city starts charging for bad roads at the Toll Booth."
  },
  {
    district: "Toll Booth",
    story: "The Toll Booth opened on a road that was still free yesterday and somehow worse today. {removed1} got trapped arguing over exact change, while {removed2} crawled into the coin return slot and entered municipal finance.",
    singleRemovalStory: "The Toll Booth opened on a road that was still free yesterday and somehow worse today. {removed1} got trapped arguing over exact change and held up traffic that did not exist.",
    revivalStory: "The coin return clanked loudly and {revived} slid out holding three tokens and a grudge. Then {removed1} got trapped arguing over exact change while {removed2} crawled into municipal finance.",
    next: "With vehicles piling up, the Parking Garage becomes unavoidable."
  },
  {
    district: "Parking Garage",
    story: "The Parking Garage opened with seven levels, no exits, and arrows that clearly worked for another building. {removed1} parked themselves in a compact space, while {removed2} followed the spiral ramp upward until they became a distant honk.",
    singleRemovalStory: "The Parking Garage opened with seven levels, no exits, and arrows that clearly worked for another building. {removed1} parked themselves in a compact space and was ticketed for existing poorly.",
    revivalStory: "Level B7 finally lit up and {revived} walked out holding a parking ticket longer than their patience. Then {removed1} parked themselves in a compact space while {removed2} followed the spiral ramp into distant honking.",
    next: "The council creates the Department of Bad Decisions, which explains a lot."
  },
  {
    district: "Department of Bad Decisions",
    story: "The Department of Bad Decisions opened and immediately approved everything that had already gone wrong. {removed1} was promoted to Assistant Mistake Manager, while {removed2} got assigned to a committee responsible for inventing new problems.",
    singleRemovalStory: "The Department of Bad Decisions opened and immediately approved everything that had already gone wrong. {removed1} was promoted to Assistant Mistake Manager and lost access to the outside world.",
    revivalStory: "The department’s suggestion box rattled open and {revived} climbed out holding a proposal titled “Let Me Back In.” Then {removed1} was promoted to Assistant Mistake Manager while {removed2} got assigned to the new-problems committee.",
    next: "The city proves it can get worse by opening the Ugly DMV."
  },
  {
    district: "Ugly DMV",
    story: "The Ugly DMV opened with endless chairs, one blinking number sign, and a form asking applicants to describe their face in three disasters or less. {removed1} got sent to window twelve, which did not exist, while {removed2} failed the photo test for looking too prepared.",
    singleRemovalStory: "The Ugly DMV opened with endless chairs, one blinking number sign, and a form asking applicants to describe their face in three disasters or less. {removed1} got sent to window twelve, which did not exist, and has been waiting there emotionally.",
    revivalStory: "The number sign flashed 000 and {revived} stood up from the waiting area like they had been there the whole season. Then {removed1} got sent to a nonexistent window while {removed2} failed the photo test for looking too prepared.",
    next: "The city needs somewhere for everything unwanted, so the City Dump opens."
  },
  {
    district: "City Dump",
    story: "The City Dump opened beyond the Junkyard for things even the Junkyard called embarrassing. {removed1} followed a rolling tire over the hill, while {removed2} was mistaken for a rejected appliance and hauled into the wrong pile.",
    singleRemovalStory: "The City Dump opened beyond the Junkyard for things even the Junkyard called embarrassing. {removed1} followed a rolling tire over the hill and became part of the scenery nobody wanted to inventory.",
    revivalStory: "A mattress pile shifted and {revived} popped out holding a raccoon passport and a confident smile. Then {removed1} followed a tire over the hill while {removed2} was mistaken for a rejected appliance.",
    next: "The crew digs a Canal because apparently roads were not confusing enough."
  },
  {
    district: "Canal",
    story: "The Canal sliced through Ugly City with water that moved only when embarrassed. {removed1} got carried off in a tiny maintenance boat, while {removed2} tried to operate the lock gates and became trapped between two levels of regret.",
    singleRemovalStory: "The Canal sliced through Ugly City with water that moved only when embarrassed. {removed1} got carried off in a tiny maintenance boat and waved like it was intentional.",
    revivalStory: "A canal boat drifted in carrying {revived}, who had somehow become captain using only a traffic cone and confidence. Then {removed1} floated away in a maintenance boat while {removed2} got trapped between two lock gates.",
    next: "Water travel gets official with the Ferry Terminal."
  },
  {
    district: "Ferry Terminal",
    story: "The Ferry Terminal opened with departures every hour and arrivals whenever the ferry felt emotionally ready. {removed1} boarded with a one-way ticket to Somewhere Damp, while {removed2} got trapped inside the life jacket demonstration.",
    singleRemovalStory: "The Ferry Terminal opened with departures every hour and arrivals whenever the ferry felt emotionally ready. {removed1} boarded with a one-way ticket to Somewhere Damp and the dock applauded too soon.",
    revivalStory: "The ferry returned late and {revived} stepped off carrying a souvenir mug from a place nobody believed existed. Then {removed1} sailed to Somewhere Damp while {removed2} got trapped in the life jacket demonstration.",
    next: "The shoreline turns commercial with the Boardwalk."
  },
  {
    district: "Boardwalk",
    story: "The Boardwalk opened with crooked planks, greasy snacks, and games that absolutely were not fair. {removed1} fell through a loose board into the prize storage, while {removed2} chased a runaway cotton candy cart down the pier.",
    singleRemovalStory: "The Boardwalk opened with crooked planks, greasy snacks, and games that absolutely were not fair. {removed1} fell through a loose board into the prize storage and got counted as inventory.",
    revivalStory: "A prize booth curtain opened and {revived} stepped out holding a giant stuffed thing that looked concerned. Then {removed1} fell into prize storage while {removed2} chased a runaway cotton candy cart down the pier.",
    next: "Tourists need somewhere worse than the Hotel, so the Motel opens."
  },
  {
    district: "Motel",
    story: "The Motel opened with flickering signs, tiny rooms, and keys attached to bricks for security. {removed1} checked into room 13 and found it was actually a closet, while {removed2} followed the ice machine noise into another decade.",
    singleRemovalStory: "The Motel opened with flickering signs, tiny rooms, and keys attached to bricks for security. {removed1} checked into room 13 and found it was actually a closet with a complimentary towel.",
    revivalStory: "The vacancy sign buzzed twice and {revived} walked out of room 0 claiming the continental breakfast was underrated. Then {removed1} got stuck in room 13 while {removed2} followed the ice machine noise into another decade.",
    next: "The city hosts its first disaster professionally at the Convention Center."
  },
  {
    district: "Convention Center",
    story: "The Convention Center opened for expos, rallies, and panels about why nothing in Ugly City worked. {removed1} got trapped behind a booth selling emergency whistles, while {removed2} followed a keynote speaker into a breakout session with no doors.",
    singleRemovalStory: "The Convention Center opened for expos, rallies, and panels about why nothing in Ugly City worked. {removed1} got trapped behind a booth selling emergency whistles and used all of them incorrectly.",
    revivalStory: "The main stage curtain rose and {revived} was standing at the podium giving a presentation called “Where I Was.” Then {removed1} got trapped behind a whistle booth while {removed2} entered a breakout session with no doors.",
    next: "Someone wants dessert, so the Ice Cream Stand becomes municipal infrastructure."
  },
  {
    district: "Ice Cream Stand",
    story: "The Ice Cream Stand opened with thirty flavors and only one that could be explained legally. {removed1} got stuck in the soft-serve machine, while {removed2} chased the freezer truck until it joined traffic on its own.",
    singleRemovalStory: "The Ice Cream Stand opened with thirty flavors and only one that could be explained legally. {removed1} got stuck in the soft-serve machine and was served as a cautionary swirl.",
    revivalStory: "The freezer door opened and {revived} stepped out holding a cone that had clearly been through a lot. Then {removed1} got stuck in the soft-serve machine while {removed2} chased the freezer truck into traffic.",
    next: "The city digs downward again and discovers the Underground Mall."
  },
  {
    district: "Underground Mall",
    story: "The Underground Mall opened beneath the Subway with stores that sold things no surface resident would admit buying. {removed1} got lost between two identical candle shops, while {removed2} rode an escalator down so far the map gave up.",
    singleRemovalStory: "The Underground Mall opened beneath the Subway with stores that sold things no surface resident would admit buying. {removed1} got lost between two identical candle shops and became a directory listing.",
    revivalStory: "A closed kiosk rolled open and {revived} emerged selling sunglasses to nobody. Then {removed1} got lost between identical candle shops while {removed2} rode an escalator below the map.",
    next: "Time becomes a problem, so the Clock Tower is built badly."
  },
  {
    district: "Clock Tower",
    story: "The Clock Tower rose over Ugly City and immediately displayed four different times with total confidence. {removed1} climbed inside to fix the hands and got stuck at quarter past nope, while {removed2} followed the bell rope upward and refused to come down quietly.",
    singleRemovalStory: "The Clock Tower rose over Ugly City and immediately displayed four different times with total confidence. {removed1} climbed inside to fix the hands and got stuck at quarter past nope.",
    revivalStory: "At exactly not-the-right-time, the Clock Tower bell rang and {revived} dropped out holding a tiny alarm clock. Then {removed1} got stuck at quarter past nope while {removed2} followed the bell rope upward.",
    next: "The crew cools off with a Water Park that should never have passed inspection."
  },
  {
    district: "Water Park",
    story: "The Water Park opened with slides, splash zones, and lifeguards who were clearly just signs with sunglasses. {removed1} entered the longest slide and never reached the exit, while {removed2} got trapped in the lazy river because it became aggressively lazy.",
    singleRemovalStory: "The Water Park opened with slides, splash zones, and lifeguards who were clearly just signs with sunglasses. {removed1} entered the longest slide and never reached the exit, though everyone heard occasional squeaking.",
    revivalStory: "The wave pool burped and returned {revived} on an inflatable tube, looking refreshed and suspiciously proud. Then {removed1} vanished into the longest slide while {removed2} got trapped in the aggressively lazy river.",
    next: "The city pretends to care about togetherness with a Community Center."
  },
  {
    district: "Community Center",
    story: "The Community Center opened with folding chairs, activity posters, and a sign-up sheet nobody could read. {removed1} got stuck teaching a class called Advanced Standing Around, while {removed2} entered a support group that immediately locked the circle.",
    singleRemovalStory: "The Community Center opened with folding chairs, activity posters, and a sign-up sheet nobody could read. {removed1} got stuck teaching a class called Advanced Standing Around and the students would not leave.",
    revivalStory: "The lost-and-found bin at the Community Center coughed up {revived}, a whistle, and seven nametags. Then {removed1} got stuck teaching Advanced Standing Around while {removed2} entered a support group that locked the circle.",
    next: "The crew gets expressive at the Tattoo Shop."
  },
  {
    district: "Tattoo Shop",
    story: "The Tattoo Shop opened with flash sheets, buzzing machines, and designs that all looked like municipal warnings. {removed1} sat for a tiny tattoo and got trapped in a full-body waiver, while {removed2} followed a stencil into the back room and came out as “aftercare pending.”",
    singleRemovalStory: "The Tattoo Shop opened with flash sheets, buzzing machines, and designs that all looked like municipal warnings. {removed1} sat for a tiny tattoo and got trapped in a full-body waiver.",
    revivalStory: "A tattoo chair spun around and revealed {revived} halfway through getting “I Was Never Gone” misspelled on purpose. Then {removed1} got trapped in a waiver while {removed2} followed a stencil into aftercare pending.",
    next: "The city needs gossip, so the Newsstand appears overnight."
  },
  {
    district: "Newsstand",
    story: "The Newsstand opened with papers reporting events before they happened and headlines that personally insulted the crew. {removed1} got folded into the Sunday edition, while {removed2} chased a flying newspaper into the opinion section and never recovered socially.",
    singleRemovalStory: "The Newsstand opened with papers reporting events before they happened and headlines that personally insulted the crew. {removed1} got folded into the Sunday edition and sold as a special insert.",
    revivalStory: "The front page suddenly changed to “LOCAL UGLY RETURNS” and {revived} climbed out from behind the crossword. Then {removed1} got folded into the Sunday edition while {removed2} chased a flying paper into the opinion section.",
    next: "After all that drama, the Soup Kitchen opens to feed the chaos."
  },
  {
    district: "Soup Kitchen",
    story: "The Soup Kitchen opened with a giant pot, generous intentions, and a recipe that changed every time someone blinked. {removed1} got assigned to stir forever, while {removed2} leaned too close to smell the soup and was ladled into community service.",
    singleRemovalStory: "The Soup Kitchen opened with a giant pot, generous intentions, and a recipe that changed every time someone blinked. {removed1} got assigned to stir forever and developed ladle authority.",
    revivalStory: "The soup pot bubbled dramatically and {revived} climbed out holding a bowl, insisting the flavor had improved. Then {removed1} got assigned to stir forever while {removed2} was ladled into community service.",
    next: "Security becomes necessary, or at least someone says it does."
  },
  {
    district: "Security Office",
    story: "The Security Office opened with camera monitors showing every district except the one they needed. {removed1} got stuck watching footage from tomorrow, while {removed2} followed a suspicious shadow into the supply closet and became a case file.",
    singleRemovalStory: "The Security Office opened with camera monitors showing every district except the one they needed. {removed1} got stuck watching footage from tomorrow and missed today completely.",
    revivalStory: "Monitor nine flickered and revealed {revived} waving from inside the Security Office before anyone opened the door. Then {removed1} got trapped watching tomorrow’s footage while {removed2} followed a shadow into the case file closet.",
    next: "The city decides one rail system was not enough, so the Monorail launches."
  },
  {
    district: "Monorail",
    story: "The Monorail opened above Ugly City with one sleek train and several deeply unsleek supports. {removed1} boarded for the first loop and got stuck at the scenic overlook, while {removed2} tried to wave from the platform and was mistaken for maintenance equipment.",
    singleRemovalStory: "The Monorail opened above Ugly City with one sleek train and several deeply unsleek supports. {removed1} boarded for the first loop and got stuck at the scenic overlook indefinitely.",
    revivalStory: "The Monorail doors opened mid-ceremony and {revived} stepped out holding a tourist brochure from nowhere. Then {removed1} got stuck at the scenic overlook while {removed2} was mistaken for maintenance equipment.",
    next: "The crew adds plants, because even Ugly City deserves questionable greenery."
  },
  {
    district: "Botanical Garden",
    story: "The Botanical Garden opened with plants labeled by warning level instead of species. {removed1} got hugged by a vine that had boundary issues, while {removed2} followed a glowing flower into the restricted greenhouse.",
    singleRemovalStory: "The Botanical Garden opened with plants labeled by warning level instead of species. {removed1} got hugged by a vine that had boundary issues and was added to the plant family.",
    revivalStory: "A suspiciously large flower bloomed and {revived} stepped out covered in pollen and confidence. Then {removed1} got hugged by a boundary-free vine while {removed2} followed a glowing flower into the restricted greenhouse.",
    next: "The city starts manufacturing monuments at the Statue Factory."
  },
  {
    district: "Statue Factory",
    story: "The Statue Factory opened to produce heroic monuments that all somehow looked confused. {removed1} got cast as a temporary mold, while {removed2} entered the polishing room and came out too shiny for the crew to recognize.",
    singleRemovalStory: "The Statue Factory opened to produce heroic monuments that all somehow looked confused. {removed1} got cast as a temporary mold and the foreman refused to waste good plaster.",
    revivalStory: "A freshly carved statue sneezed, cracked open, and revealed {revived} inside pretending it was performance art. Then {removed1} got cast as a temporary mold while {removed2} became too shiny to recognize.",
    next: "Emergency planning arrives late with the Emergency Bunker."
  },
  {
    district: "Emergency Bunker",
    story: "The Emergency Bunker opened after every emergency had already happened twice. {removed1} got locked inside during a drill nobody announced, while {removed2} followed the evacuation map to a snack closet marked “safe enough.”",
    singleRemovalStory: "The Emergency Bunker opened after every emergency had already happened twice. {removed1} got locked inside during a drill nobody announced and became officially prepared.",
    revivalStory: "The bunker hatch opened and {revived} emerged holding canned beans and a whistle they had definitely overused. Then {removed1} got locked inside during a drill while {removed2} followed the evacuation map into a snack closet.",
    next: "The city tries to organize its history at the Records Office."
  },
  {
    district: "Records Office",
    story: "The Records Office opened to track every permit, complaint, disappearance, and soup incident in Ugly City. {removed1} got misfiled under “miscellaneous structures,” while {removed2} entered the archive stacks and became overdue data.",
    singleRemovalStory: "The Records Office opened to track every permit, complaint, disappearance, and soup incident in Ugly City. {removed1} got misfiled under “miscellaneous structures” and nobody wanted to correct the label.",
    revivalStory: "A cabinet labeled “definitely gone” slid open and {revived} climbed out with a complete personal file and several corrections. Then {removed1} got misfiled under miscellaneous structures while {removed2} disappeared into the archive stacks.",
    next: "The crew follows the oldest map to The Last Alley."
  },
  {
    district: "The Last Alley",
    story: "The Last Alley was so narrow, crooked, and suspicious that even Ugly City seemed embarrassed by it. {removed1} followed a flickering sign to the dead end, while {removed2} got caught in a trash can traffic jam and was slowly pushed out of the crew’s route.",
    singleRemovalStory: "The Last Alley was so narrow, crooked, and suspicious that even Ugly City seemed embarrassed by it. {removed1} followed a flickering sign to the dead end and the bricks quietly rearranged behind them.",
    revivalStory: "A dumpster in The Last Alley lifted its lid and {revived} popped out asking if the meeting had started. Then {removed1} followed a flickering sign to the dead end while {removed2} got caught in a trash can traffic jam.",
    next: "Only one thing blocks the path to City Hall: the Final Permit Desk."
  },
  {
    district: "Final Permit Desk",
    story: "The Final Permit Desk appeared in the middle of the road with a bell, a stack of forms, and the energy of a final boss with office hours. {removed1} was sent back for missing initials nobody mentioned, while {removed2} got trapped waiting for approval from a stamp that had gone to lunch.",
    singleRemovalStory: "The Final Permit Desk appeared in the middle of the road with a bell, a stack of forms, and the energy of a final boss with office hours. {removed1} was sent back for missing initials nobody mentioned and the line moved on without them.",
    revivalStory: "The clerk opened a drawer and {revived} climbed out holding a fully approved return form, which nobody understood but everyone respected. Then {removed1} was sent back for missing initials while {removed2} got trapped waiting for a stamp that had gone to lunch.",
    next: "The path is clear at last: the crew climbs the City Hall Steps."
  },
  {
    district: "City Hall Steps",
    story: "The City Hall Steps stretched upward through banners, dust, and the quiet panic of almost being finished. {removed1} tripped over the ceremonial carpet and rolled into committee review, while {removed2} stopped to wave at the crowd and got redirected into guest seating.",
    singleRemovalStory: "The City Hall Steps stretched upward through banners, dust, and the quiet panic of almost being finished. {removed1} tripped over the ceremonial carpet and rolled into committee review just before the final doors opened.",
    revivalStory: "Halfway up the steps, {revived} emerged from behind a banner and claimed they had been saving seats. The moment ended when {removed1} tripped into committee review and {removed2} got redirected into guest seating.",
    next: "The final door opens into the Founder’s Office."
  },
  {
    district: "Founder’s Office",
    story: "The Founder’s Office waited at the heart of Ugly City with a crooked desk, one cracked nameplate, and a chair that looked far too important. {removed1} sat down too early and was swallowed by administrative responsibility, while {removed2} opened the wrong drawer and got filed under “almost made it.”",
    singleRemovalStory: "The Founder’s Office waited at the heart of Ugly City with a crooked desk, one cracked nameplate, and a chair that looked far too important. {removed1} sat down too early and was swallowed by administrative responsibility, leaving the final claim to someone else.",
    revivalStory: "The Founder’s Office door creaked open and {revived} stepped out from behind the desk like they had been interviewing candidates all along. Then {removed1} sat down too early and {removed2} opened the wrong drawer into the “almost made it” file.",
    next: "If the city still has Uglies standing, it keeps expanding into even worse ideas."
  }
];

const UGLY_CITY_EXPANSION_DISTRICTS = [
  "Junkyard", "Hospital", "Police Station", "Sewer", "Shopping Mall", "Casino",
  "Airport", "Subway", "Zoo", "Theme Park", "Harbor", "Power Plant", "Hotel",
  "Factory", "Old Town", "The Underground", "Ugly DMV",
  "Department of Bad Decisions", "Permit Office", "Food Court", "Parking Garage",
  "Bus Depot", "City Dump", "Rooftop District", "Records Office",
  "Emergency Bunker", "Courthouse", "Recycling Center", "Library", "Laundromat",
  "City Park", "Pawn Shop", "Radio Tower", "Weather Station", "Toll Booth",
  "Boardwalk", "Motel", "Convention Center", "Clock Tower", "Water Park",
  "Community Center", "Security Office", "Monorail", "Botanical Garden",
  "Statue Factory", "Final Permit Desk", "Founder's Office",
];

const UGLY_CITY_EXPANSION_MODIFIERS = [
  "Expansion", "Grand Reopening", "Safety Inspection", "Emergency Renovation",
  "Budget Cut Edition", "Permit Crisis", "Second Location", "Rooftop Addition",
  "Underground Extension", "Public Works Disaster", "Annex", "Rebuild",
  "Lost Department", "Founder-Approved Disaster", "After-Hours Inspection",
];

const UGLY_CITY_EXPANSION_STORY_TEMPLATES = [
  "The crew returned to the {district} for what was supposed to be a simple {modifierLower}, which immediately became the most complicated project in Ugly City history. Before anyone could pretend they knew what they were doing, {removed1} got sealed behind a suspicious new wall while {removed2} was reassigned to a department nobody could find.",
  "Ugly City approved the {district} {modifierLower} with three stamps, two coupon bribes, and one map drawn upside down. The ribbon cutting went sideways when {removed1} was hauled off by a runaway cart and {removed2} got sent to the wrong district by a sign that was also upside down.",
  "The {district} {modifierLower} opened to thunderous applause from people who had not read the safety notes. Within minutes, {removed1} was trapped behind a door labeled Push/Pull/Maybe while {removed2} was claimed by a committee that only meets in elevators.",
];

const UGLY_CITY_EXPANSION_REVIVAL_STORY_TEMPLATES = [
  "The crew returned to the {district} for what was supposed to be a simple {modifierLower}, only to find {revived} already there wearing a fake staff badge and acting like nothing happened. The reunion lasted until {removed1} got sealed behind a suspicious new wall and {removed2} was reassigned to a department nobody could find.",
  "Ugly City approved the {district} {modifierLower} and immediately discovered {revived} living in the supply closet with a clipboard and terrible authority. Everyone cheered for almost four seconds before {removed1} was hauled off by a runaway cart and {removed2} got sent to the wrong district by an upside-down sign.",
  "The {district} {modifierLower} began with a surprise inspection from {revived}, who had apparently been Missing inside the vents and promoted themselves. The celebration ended when {removed1} was trapped behind a door labeled Push/Pull/Maybe and {removed2} was claimed by an elevator committee.",
];

function buildUglyCityCuratedChapters() {
  return UGLY_CITY_CURATED_CHAPTERS.map((chapter, index) => ({
    number: index + 1,
    key: UGLY_CITY_CURATED_CHAPTER_KEYS[index],
    ...chapter,
    imagePrompt:
      UGLY_CITY_CURATED_IMAGE_PROMPTS[index] ||
      "Create a square cinematic cartoon scene of the Squigs building, exploring, and surviving another chaotic district of Ugly City.",
  }));
}

function fillUglyCityExpansionTemplate(template, values) {
  return String(template || "")
    .replace(/{district}/g, values.district || "Ugly City")
    .replace(/{modifierLower}/g, values.modifierLower || "expansion");
}

function generateUglyCityExpansionChapter(chapterNumber, eraDefinition = {}) {
  const districts = eraDefinition.expansionDistricts?.length
    ? eraDefinition.expansionDistricts
    : UGLY_CITY_EXPANSION_DISTRICTS;
  const modifiers = eraDefinition.expansionModifiers?.length
    ? eraDefinition.expansionModifiers
    : UGLY_CITY_EXPANSION_MODIFIERS;
  const storyTemplates = eraDefinition.expansionStoryTemplates?.length
    ? eraDefinition.expansionStoryTemplates
    : UGLY_CITY_EXPANSION_STORY_TEMPLATES;
  const revivalTemplates = eraDefinition.expansionRevivalStoryTemplates?.length
    ? eraDefinition.expansionRevivalStoryTemplates
    : UGLY_CITY_EXPANSION_REVIVAL_STORY_TEMPLATES;
  const baseDistrict = districts[(chapterNumber - 1) % districts.length] || "Ugly City";
  const modifier =
    modifiers[
      Math.floor((chapterNumber - 1) / Math.max(1, districts.length)) %
        Math.max(1, modifiers.length)
    ] || "Expansion";
  const values = {
    district: baseDistrict,
    modifierLower: modifier.toLowerCase(),
  };

  return {
    district: `${baseDistrict} ${modifier}`,
    story: fillUglyCityExpansionTemplate(
      storyTemplates[(chapterNumber - 1) % storyTemplates.length],
      values
    ),
    singleRemovalStory:
      `The ${baseDistrict} ${modifier.toLowerCase()} opened to thunderous applause from people who had not read the safety notes. ` +
      `{removed1} was trapped behind a door labeled Push/Pull/Maybe and became the only item on the incident report.`,
    revivalStory: fillUglyCityExpansionTemplate(
      revivalTemplates[(chapterNumber - 1) % revivalTemplates.length],
      values
    ),
    next: "The city council has already approved another terrible idea.",
    imagePrompt:
      `Show the Squigs working through the ${baseDistrict} ${modifier.toLowerCase()} in Ugly City, ` +
      "with crooked construction, mismatched signs, duct tape repairs, public works chaos, and one funny non-violent removal moment happening in the background. " +
      `Make the district clearly recognizable as ${baseDistrict} and keep the scene in the same clean flat Squigs cartoon style.`,
  };
}

function getUglyCityChapter(eraDefinition, chapterNumber) {
  const curated = eraDefinition?.chapterMilestones || [];
  if (chapterNumber <= curated.length) {
    return curated[chapterNumber - 1];
  }
  return generateUglyCityExpansionChapter(chapterNumber, eraDefinition);
}

function getUglyCityBaseImagePrompt() {
  return UGLY_CITY_BASE_IMAGE_PROMPT;
}

function buildUglyCityImagePrompt(chapter) {
  const scenePrompt =
    chapter?.imagePrompt ||
    "Create a square cinematic cartoon scene of the Squigs building, exploring, and surviving another chaotic district of Ugly City.";
  return `${UGLY_CITY_BASE_IMAGE_PROMPT}\n\nScene prompt:\n${scenePrompt}`;
}

function getUglyCityImagePromptForChapter(eraDefinition, chapterNumber) {
  const safeChapterNumber = Math.max(1, Number(chapterNumber) || 1);
  const chapter = getUglyCityChapter(eraDefinition, safeChapterNumber);
  return {
    district: chapter?.district || `Chapter ${safeChapterNumber}`,
    prompt: buildUglyCityImagePrompt(chapter),
  };
}

const UGLY_CITY_ERA = {
  key: "ugly_city",
  label: "The Rise of Ugly City",
  mode: "chapter_story",
  eliminationsPerMilestone: 2,
  revivalEveryMin: 5,
  revivalEveryMax: 10,
  useEraLockedImagesOnly: true,
  lobby: {
    title: "Squig Survival - Ugly City Build Crew",
    color: 0x9b59b6,
  },
  start: {
    title: "Squig Survival - The Rise of Ugly City",
    color: 0x9b59b6,
  },
  chapterMilestones: buildUglyCityCuratedChapters(),
  expansionDistricts: UGLY_CITY_EXPANSION_DISTRICTS,
  expansionModifiers: UGLY_CITY_EXPANSION_MODIFIERS,
  expansionStoryTemplates: UGLY_CITY_EXPANSION_STORY_TEMPLATES,
  expansionRevivalStoryTemplates: UGLY_CITY_EXPANSION_REVIVAL_STORY_TEMPLATES,
};

const SURVIVAL_ERAS = {
  day_one: DAY_ONE_ERA,
  reloaded: RELOADED_ERA,
  ugly_city: UGLY_CITY_ERA,
  office_squigs: OFFICE_SQUIGS_ERA,
  jobsite_squigs: JOBSITE_SQUIGS_ERA,
  movie_theater: MOVIE_THEATER_ERA,
  airport: AIRPORT_ERA,
  zombie_apocalypse: ZOMBIE_APOCALYPSE_ERA,
  // Placeholder until unique content is added.
  tbd: {
    ...DAY_ONE_ERA,
    key: "tbd",
    label: "TBD",
  },
};

const SURVIVAL_REVIVE_FAIL_LORE = {
  day_one: [
    "🪦 {player} tried to respawn by yelling 'undo' at a vending machine. The machine accepted the drama and rejected the request.",
    "🧦 {player} wrapped themselves in mismatched socks and called it a healing cocoon. Earth disagreed immediately.",
    "📱 {player} searched 'how to come back from the dead fast' and only found a skincare routine.",
    "🛒 {player} attempted a revival lap in a grocery cart, then rolled directly into more embarrassment.",
    "🍕 {player} offered the portal a slice of pineapple pizza and got ghosted by the universe itself.",
    "🧴 {player} applied sunscreen to a resurrection crystal and somehow made it less alive.",
    "🧊 {player} lay dramatically on a bag of ice waiting for destiny. Destiny walked past without making eye contact.",
    "🚦 {player} mistook a crossing signal for a cosmic blessing and posed under it for nothing.",
    "📦 {player} climbed into a cardboard box labeled 'fragile soul' and still failed quality control.",
    "🎧 {player} queued inspirational lo-fi for their comeback and only achieved a sad little vibe.",
    "🚌 {player} boarded the wrong bus hoping it led back to life. It led to public shame instead.",
    "🪙 {player} tossed a coin into a fountain and wished for revival. The fountain requested better material.",
    "🧼 {player} scrubbed themselves with soap like a reset button and remained extremely deceased.",
    "🐸 {player} asked a frog for necromancy tips and got silently judged into the dirt.",
    "🕶️ {player} put on sunglasses and announced a dramatic return. Even the portal refused the bit."
  ],
  office_squigs: [
    "📎 {player} filed a revival request with zero approvals and three passive-aggressive comments.",
    "☕ {player} drank break room coffee hoping to restart their soul. HR logged it as an incident instead.",
    "🖨️ {player} tried printing a new body, but the printer jammed out of self-respect.",
    "📅 {player} scheduled their comeback for 3:00 PM and still got declined by Outlook.",
    "🪑 {player} spun in an office chair for momentum and only generated dizziness and concern.",
    "📊 {player} built a pie chart proving they should be alive. Leadership called it non-actionable.",
    "💼 {player} showed up with a briefcase full of confidence and no actual pulse.",
    "📠 {player} faxed the afterlife a rebuttal. The machine ate it and improved nothing.",
    "🧾 {player} submitted revival as an expense and got reimbursed in humiliation.",
    "⌨️ {player} mashed the keyboard like resurrection was a hotkey. IT has blocked worse ideas.",
    "🔔 {player} treated a Teams ping like a divine summons and still stayed dead on company time.",
    "📂 {player} hid in the archives hoping to be reclassified as active. Compliance said absolutely not.",
    "🪴 {player} stood beside the office plant trying to photosynthesize a comeback. The plant looked embarrassed.",
    "📉 {player} pitched a revival initiative and somehow made morale fall even lower.",
    "🎧 {player} put on productivity music and attempted a strategic return to life. The spreadsheet refused to collaborate."
  ],
  jobsite_squigs: [
    "🦺 {player} slapped on a hi-vis vest and assumed OSHA would handle the resurrection paperwork.",
    "🔨 {player} tapped their own tombstone twice and called it a renovation plan.",
    "🪜 {player} climbed a ladder looking for a higher state of being and found only worse balance.",
    "🚧 {player} ducked under caution tape and learned it does not lead to miracles.",
    "🧱 {player} tried to brick-by-brick rebuild themselves and ran out of both bricks and dignity.",
    "⚙️ {player} asked a power tool to jump-start their comeback. The power tool declined for legal reasons.",
    "🪚 {player} yelled 'send it' at the void and immediately looked less hireable.",
    "🚜 {player} attempted a dramatic return on heavy machinery and got outperformed by the backup alarm.",
    "🛠️ {player} opened a toolbox hoping for resurrection equipment and found zip ties and disappointment.",
    "🪛 {player} tightened one random bolt and declared the soul structurally sound. Inspection failed.",
    "🏗️ {player} posed under the scaffolding like a foreman of destiny and still couldn't pass rebirth code.",
    "🧤 {player} put on work gloves as if professionalism alone could reverse mortality.",
    "📐 {player} measured out the perfect comeback angle and somehow made it more crooked.",
    "🪨 {player} sat on a pile of gravel waiting to be reborn rugged. It just got itchy.",
    "🚚 {player} yelled at a dump truck to back them into the living world. The truck kept reversing into their pride."
  ],
  movie_theater: [
    "🍿 {player} tried to respawn by dramatically emerging from a popcorn tub and only got extra butter on the shame.",
    "🎟️ {player} waved a crumpled ticket stub and claimed it was a second chance pass. Security remained unconvinced.",
    "🥤 {player} attempted a comeback through the cup refill line and got denied by fountain logic.",
    "🎬 {player} whispered 'director's cut' at their own fate and received zero bonus scenes.",
    "🪑 {player} climbed back into the same seat like the theater wouldn't notice the haunting attempt.",
    "🔦 {player} followed an usher flashlight thinking it was destiny. It was just more ejection energy.",
    "📽️ {player} stood near the projector hoping for a reboot and only achieved silhouette-based embarrassment.",
    "🍫 {player} bribed the afterlife with melted chocolate and still got the thumbs-down from row G.",
    "🚪 {player} tried sneaking through the side exit like a prestige plot twist. The theater called it sad.",
    "🎧 {player} put one ear to the trailer audio waiting for a cue to return. The cue never came.",
    "😬 {player} fake-coughed through a resurrection attempt and got outacted by the previews.",
    "🧃 {player} spilled a drink for dramatic effect and still failed to generate a comeback montage.",
    "📱 {player} lit up the aisle with their phone and somehow made death look even tackier.",
    "🍕 {player} offered staff cold pizza in exchange for re-entry. The staff chose dignity.",
    "🎭 {player} committed so hard to the bit that even the seats recoiled from the performance."
  ],
  airport: [
    "🛫 {player} tried to revive by standing near the gate with fake confidence and no valid miracle.",
    "🎫 {player} flashed an expired boarding pass at fate and got sorted into a higher class of embarrassment.",
    "🧳 {player} climbed into a carry-on hoping to be rerouted back to life. Baggage policy rejected the claim.",
    "☕ {player} bought another airport coffee and briefly mistook panic for resurrection.",
    "🔌 {player} plugged into the only outlet like a charging cable could restore a soul. It could not.",
    "🚨 {player} called secondary screening a rebirth ritual and made the whole terminal uncomfortable.",
    "🥨 {player} ate an overpriced pretzel as if salt alone could revive them. The pretzel remained the stronger entity.",
    "🪪 {player} checked every pocket for a return to life and found only lint and worsening optics.",
    "📱 {player} refreshed the airline app for a new status and got 'still dead, now delayed.'",
    "🚶 {player} power-walked the moving walkway like momentum might count as reincarnation.",
    "🛬 {player} pointed at an arriving plane and announced 'that's probably for me.' It absolutely was not.",
    "🧥 {player} put on a neck pillow like ceremonial armor and still couldn't clear spiritual boarding.",
    "🌧️ {player} blamed weather systems for the failed comeback and, for once, had almost no proof.",
    "🗺️ {player} studied the terminal map trying to locate Gate Rebirth. It was between nowhere and delusion.",
    "😴 {player} attempted a revival nap across three seats and only woke up looking more publicly defeated."
  ],
  zombie_apocalypse: [
    "🧟 {player} begged for another antidote dose, but the shelter was out and the fever kept climbing.",
    "💉 {player} jammed an empty syringe into their arm and learned hope is not medicine.",
    "🩹 {player} wrapped the bite until the bandages turned black, but the infection kept moving under the skin.",
    "📻 {player} waited for radio instructions on antidote treatment and got static, screaming, and nothing useful.",
    "🧪 {player} mixed random pills into a fake antidote and only made the dying take longer.",
    "🚪 {player} tried to crawl back into the treatment room, but the safehouse had already written them off.",
    "🧠 {player} swore they could fight the infection alone right up until their hands started shaking.",
    "🥫 {player} traded food for a miracle cure that turned out to be colored water in a cracked vial.",
    "🔦 {player} studied the bite under a flashlight like better lighting would make it less fatal.",
    "🧼 {player} poured sanitizer straight into the wound and discovered pain is not a cure.",
    "🪵 {player} bit down on a piece of wood while someone searched for antidote they did not have.",
    "🧯 {player} tried to cauterize the wound in a panic and only made the room smell worse.",
    "🍕 {player} ate one last cold slice while waiting to see if the antidote was going to fail.",
    "🗺️ {player} stared at the city map searching for another clinic before the fever burned through the plan.",
    "😬 {player} kept saying they were fine while the infection crawled higher and the room stopped believing it."
  ],
reloaded: [
"🧹 {player} begged the broom to sweep them back into the game. It swept them directly into the hidden folder.",
"🌀 {player} jumped into the Reloaded portal, but their token ID was flagged as oversized baggage.",
"🧬 {player} rerolled every trait looking for a second life. The best they got was a slightly rarer corpse.",
"📢 {player} pinged the entire Discord for help. They survived only as a pinned warning.",
"🧪 {player} drank the experimental respawn fluid. The bottle has since been renamed after them.",
"📉 {player} tried sweeping their way back into the game and ended up holding one damp floor tile.",
"🗑️ {player} searched the metadata recycle bin for a spare life. They found three ugly hats and someone else's mouth.",
"👁️ {player} asked their eye trait to find a way back. It saw the odds and immediately looked away.",
"🛜 {player} blamed portal lag. Diagnostics confirmed the connection was fine—they were just extremely eliminated.",
"🪙 {player} paid gas to respawn. The transaction failed, the gas vanished, and the universe marked it as funny.",
"🚪 {player} opened the broom closet expecting a revival chamber. Inside was a chair and a very serious performance review.",
"🎨 {player} changed their background trait to 'Still Alive.' Metadata moderation removed it for misinformation.",
"🧻 {player} wrapped themselves in an ancient Earth scroll and waited for the sacred power of two-ply. Nothing happened, but they were comfortable.",
"🛒 {player} rode the liquidity cart toward resurrection. One wheel jammed and they were returned to the floor.",
"🫡 {player} gave the portal a flawless salute. The portal respected their courage and kept them dead anyway."
],
ugly_city: [
  "{player} filed the wrong permit and their return request was denied.",
  "{player} tried to rejoin the crew, but the Building Inspector said the form was upside down.",
  "{player} almost made it back, but got redirected to the Department of Bad Decisions.",
  "{player} found the right office, then lost their place in line behind a vending machine.",
  "{player} brought three signatures and somehow still failed the clipboard vibe check."
],

};

const SURVIVAL_ALIVE_TAUNTS = [
  "🫵 {player} is still alive somehow, which feels less like skill and more like a clerical error.",
  "📣 {player} yelled 'main character energy' and the universe regrettably let it slide.",
  "🧠 {player} remains in the game despite making choices that should be studied by professionals.",
  "🪞 {player} caught their reflection mid-survival and looked surprised it was still happening.",
  "🎯 {player} is still standing, mostly because disaster keeps missing out of sheer disbelief.",
  "🛟 {player} calls this strategy. Observers are calling it unverified luck.",
  "📦 {player} is one bad decision away from becoming lore, and everyone can feel it.",
  "🧃 {player} survived this long with the posture of someone losing an argument to a folding chair.",
  "🫠 {player} keeps acting confident for someone one sneeze away from a public obituary.",
  "🧍 {player} is alive, but only in the technical sense currently recognized by the portal.",
  "🎪 {player} somehow turned survival into a slapstick side quest.",
  "📉 {player}'s judgment remains low while their luck remains irresponsibly high.",
  "🧤 {player} is still here, proving that consequences are running late again.",
  "🚪 {player} keeps walking past obvious danger like it owes them rent.",
  "🪤 {player} has survived long enough to become a problem for basic narrative structure.",
  "🎟️ {player} is still in the game on what appears to be a counterfeit ticket.",
  "🔦 {player} keeps stumbling through chaos with the confidence of someone who cannot read warnings.",
  "🧽 {player} has been spared again, and frankly the timeline looks weaker for it.",
  "📎 {player} is hanging on by one metaphorical paper clip and several poor assumptions.",
  "🛒 {player} keeps rolling forward like a shopping cart with one screaming wheel.",
  "🧨 {player} has mistaken not dying yet for being good at this.",
  "🧵 {player} is still stitched into the match by loose thread and louder delusion.",
  "📡 {player} continues broadcasting survival without ever earning a stable signal.",
  "🥴 {player} is alive enough to be mocked, which is honestly the worst tier of survival.",
  "🪦 {player} keeps dodging death like it is waiting for a funnier moment."
];

function getSurvivalEraDefinition(eraKey) {
  return SURVIVAL_ERAS[eraKey] || SURVIVAL_ERAS.day_one;
}

function getSurvivalReviveFailLore(eraKey) {
  return SURVIVAL_REVIVE_FAIL_LORE[eraKey] || SURVIVAL_REVIVE_FAIL_LORE.day_one;
}

function getSurvivalAliveTauntLore() {
  return SURVIVAL_ALIVE_TAUNTS;
}

module.exports = {
  SURVIVAL_ERAS,
  getSurvivalEraDefinition,
  getSurvivalReviveFailLore,
  getSurvivalAliveTauntLore,
  getUglyCityChapter,
  getUglyCityBaseImagePrompt,
  buildUglyCityImagePrompt,
  getUglyCityImagePromptForChapter,
};
