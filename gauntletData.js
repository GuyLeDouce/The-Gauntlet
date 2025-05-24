// === Imports & Shared Game State ===
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// === Global Game State ===
let gauntletEntrants = [];
let gauntletActive = false;
let joinTimeout = null;
let gauntletChannel = null;
let gauntletMessage = null;
let currentDelay = 0;
let remaining = [];
let eliminatedPlayers = [];
let activeBoons = {};
let activeCurses = {};
let roundImmunity = {};
let mutationDefenseClicks = new Set();
let fateRolls = {};
let tauntTargets = {};
let dodgeAttempts = {};
let hideAttempts = {};
let rematchClicks = 0;
let lastGameEntrantCount = 0;
let rematchesThisHour = 0;
let rematchLimitResetTime = Date.now();
let completedGames = 0;
let isTrialMode = false;
let previousRemaining = 0;
let lastVoteRound = -2;
let totemTriggered = false;
let massReviveTriggered = false;
let nonProgressRounds = 0;
let noEliminationRounds = 0;
// === Trials and Elimination Events ===
const trialNames = [
  "Trial of the Screaming Mire", "The Eldritch Scramble", "Trial of the Shattered Bones",
  "The Maw's Hunger", "Dance of the Ugly Reflection", "Trial of the Crooked Path",
  "Storm of the Severed Sky", "Gauntlet of Broken Dreams", "The Echoing Crawl", "The Wretched Spiral"
];

const eliminationEvents = [
  "was dragged into the swamp by unseen claws.",
  "tried to pet a malformed dog. It bit back... with ten mouths.",
  "got yeeted off the platform by a sentient fart cloud.",
  "exploded after lighting a fart too close to a rune circle.",
  "was judged too handsome and instantly vaporized.",
  "spoke in rhymes one too many times.",
  "was too ugly. Even for the Malformed.",
  "turned into a rubber duck and floated away.",
  "got tangled in the Lore Scrolls and suffocated.",
  "joined the wrong Discord and disappeared forever.",
  "ate the wrong mushroom and became sentient wallpaper.",
  "laughed at the wrong joke and got obliterated by cringe.",
  "tripped over an imaginary rock and fell into the void.",
  "summoned their own shadow. It won the duel.",
  "took a selfie during the ritual. The flash was fatal.",
  "got banned by the council of malformed ethics.",
  "forgot the safe word during a summoning.",
  "got memed into another dimension.",
  "mislabeled an artifact as ‘mid’. The artifact retaliated.",
  "tried to floss dance during a summoning and evaporated from shame.",
  "failed a captcha from the underworld and got IP banned.",
  "attempted to roast the Malformed… and got cooked instead.",
  "challenged the void to a staring contest. Lost instantly.",
  "mistook a cursed artifact for a burrito. Their last bite.",
  "said “trust me bro” before casting a spell. Big mistake.",
  "unplugged the simulation to save energy. Got deleted.",
  "touched grass... and it bit back.",
  "tried to pet the Lore Keeper. Now part of the lore.",
  "left a one-star Yelp review of the Gauntlet. Was promptly removed.",
  "activated voice chat mid-ritual. Was drowned out by screams.",
  "wore Crocs to the final trial. It was too disrespectful.",
  "sneezed during a stealth mission and got obliterated.",
  "typed “/dance” at the wrong moment. Was breakdanced out of existence.",
  "cast Summon Uber and got taken away. Permanently.",
  "tried to hotwire a cursed wagon. It exploded.",
  "failed a vibe check from the Gauntlet Spirits.",
  "opened an ancient book backwards. Instant regret.",
  "spilled Monster energy drink on the summoning circle. RIP.",
  "used “literally me” too many times. Became nobody.",
  "mistook a lava pit for a jacuzzi.",
  "flexed their NFTs. The gods rugged them.",
  "brought AI to the ritual. The timeline folded.",
  "minted a cursed token and vanished during gas fees.",
  "yelled “YOLO” during the Rite of Shadows. They did not.",
  "asked for WiFi mid-quest. Got throttled into the afterlife.",
  "was caught multitasking. The Gauntlet demands full attention.",
  "opened a lootbox labeled “DO NOT OPEN.”",
  "hit reply-all in the underworld newsletter. Got banned."
];
// === Special Elimination Lines ===
const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "rolled a 1 and summoned their ex instead.",
  "flexed too hard and imploded with style.",
  "said ‘GM’ too late and was banished to Shadow Realm.",
  "was cursed by a malformed meme and vaporized in shame.",
  "drew a red card. From a black deck. Gone.",
  "used Comic Sans in a summoning circle.",
  "forgot to use dark mode and burned alive.",
  "glitched into another chain. Nobody followed.",
  "was outed as an undercover Handsome and disqualified.",
  "summoned an influencer. Was vlogged into the void.",
  "forgot to charge their soul. Battery critical.",
  "wore flip-flops to the apocalypse. Slipped into oblivion.",
  "tried to cast “Fireball” with autocorrect on. “Furball” was less effective.",
  "got ghosted… by an actual ghost.",
  "called the Gauntlet “mid.” The Gauntlet responded.",
  "took a bathroom break and came back erased.",
  "equipped the Cloak of Invisibility. It worked a little *too* well.",
  "tweeted something cringe. The spirits canceled them.",
  "rolled a d20 and summoned their inner child. It panicked and ran."
];

// === Revival Lines ===
const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "refused to die and bribed fate with $CHARM.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "glitched through the floor, then glitched back.",
  "slapped a demon and respawned out of spite.",
  "screamed so loud the timeline flinched.",
  "burned their death certificate in a candle made of shame.",
  "found a continue screen hidden in the clouds.",
  "got revived by a lonely necromancer for company.",
  "played a revival song on a bone flute they found in their ribcage.",
  "bartered with the void using expired coupons. Somehow worked.",
  "ragequit so hard it reversed their death.",
  "got DM’ed by fate with a “you up?” and said yes.",
  "climbed out of the grave just to finish a bit.",
  "glitched while dying and reloaded checkpoint.",
  "fake cried until the spirits gave in.",
  "convinced the Reaper it was a prank.",
  "used the wrong pronoun in a curse, causing a reset.",
  "was resurrected as a meme, and that counts."
];

// === Revival Fail Lines ===
const reviveFailLines = [
  "🦶 You wiggle in the dirt… but you're still dead.",
  "👁️ The malformed forces laugh and turn away.",
  "☠️ You reached out… and got ghosted.",
  "🧠 You whispered your name backward. Nothing happened.",
  "📉 Your odds dropped further just for trying.",
  "🙈 You faked your death. The Gauntlet unfaked it.",
  "🙃 Your resurrection email bounced.",
  "📵 The ritual hotline is currently down. Try never.",
  "💅 You died fashionably. Unfortunately, still dead.",
  "🥴 You whispered “please?” into the void. It cringed.",
  "📦 The afterlife returned your soul… damaged.",
  "🦴 Your bones attempted to reassemble. They unionized instead.",
  "🐌 Your request was too slow. Death already moved on.",
  "🤡 Your revival was reviewed… and laughed at.",
  "🪤 You triggered a trap trying to live. Good effort though."
];
module.exports = {
  trialNames,
  eliminationEvents,
  specialEliminations,
  revivalEvents,
  reviveFailLines
};
