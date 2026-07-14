const { randomInt } = require("crypto");

const UGLY_FORTUNE_BONUS_PRIZE_KEY = "ugly_fortune";
const UGLY_FORTUNE_BONUS_PRIZE_LABEL = "Ugly Fortune";
const UGLY_FORTUNE_SPIN_TITLE = "Spin of Ugly Fortune";

const UGLY_FORTUNE_PRIZES = Object.freeze([
  {
    key: "charm_1000",
    label: "1000 $CHARM",
    charmAmount: 1000,
    weight: 30,
    imageUrl: "https://i.imgur.com/BiLeDmP.png",
  },
  {
    key: "charm_5000",
    label: "5000 $CHARM",
    charmAmount: 5000,
    weight: 20,
    imageUrl: "https://i.imgur.com/yN9jpx3.png",
  },
  {
    key: "charm_10000",
    label: "10,000 $CHARM",
    charmAmount: 10000,
    weight: 15,
    imageUrl: "https://i.imgur.com/1YUJCkn.png",
  },
  {
    key: "charm_15000",
    label: "15,000 $CHARM",
    charmAmount: 15000,
    weight: 10,
    imageUrl: "https://i.imgur.com/j6qyB4i.png",
  },
  {
    key: "squig_from_guy",
    label: "Squig from Guy",
    charmAmount: 0,
    weight: 5,
    imageUrl: "https://i.imgur.com/hRjJTjX.png",
  },
  {
    key: "squig_from_vince",
    label: "Squig from Vince",
    charmAmount: 0,
    weight: 5,
    imageUrl: "https://i.imgur.com/NMas4w5.png",
  },
  {
    key: "bogo_24hr_max_3",
    label: "24hr BOGO (max 3 uses)",
    charmAmount: 0,
    weight: 11,
    imageUrl: "https://i.imgur.com/BltS2WN.png",
  },
  {
    key: "rugdollz_3d",
    label: "RugDollz 3D",
    charmAmount: 0,
    weight: 1,
    imageUrl: "https://i.imgur.com/ZO0oMH8.png",
  },
  {
    key: "ghostlab",
    label: "GhostLab",
    charmAmount: 0,
    weight: 1,
    imageUrl: "https://i.imgur.com/r6d4ewT.png",
  },
  {
    key: "vision_of_the_void",
    label: "Vision of the Void",
    charmAmount: 0,
    weight: 1,
    imageUrl: "https://i.imgur.com/N5luKfS.png",
  },
  {
    key: "longlost",
    label: "LongLost",
    charmAmount: 0,
    weight: 1,
    imageUrl: "https://i.imgur.com/bxZuZUB.png",
  },
]);

const UGLY_FORTUNE_TOTAL_WEIGHT = UGLY_FORTUNE_PRIZES.reduce(
  (sum, prize) => sum + prize.weight,
  0
);

function normalizeBonusPrizeValue(raw) {
  const value = String(raw || "").trim().slice(0, 300);
  if (!value) return null;

  const normalized = value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized === UGLY_FORTUNE_BONUS_PRIZE_KEY.replace(/_/g, " ") ||
    normalized === "ugly fortune" ||
    normalized === "spin of ugly fortune" ||
    normalized === "a spin of ugly fortune"
  ) {
    return UGLY_FORTUNE_BONUS_PRIZE_KEY;
  }

  return value;
}

function getBonusPrizeValue(valueOrSettings) {
  if (
    valueOrSettings &&
    typeof valueOrSettings === "object" &&
    Object.prototype.hasOwnProperty.call(valueOrSettings, "bonus_prize")
  ) {
    return valueOrSettings.bonus_prize;
  }
  return valueOrSettings;
}

function isUglyFortuneBonusPrize(valueOrSettings) {
  return (
    normalizeBonusPrizeValue(getBonusPrizeValue(valueOrSettings)) ===
    UGLY_FORTUNE_BONUS_PRIZE_KEY
  );
}

function formatBonusPrizeValue(valueOrSettings) {
  const value = getBonusPrizeValue(valueOrSettings);
  if (isUglyFortuneBonusPrize(value)) return UGLY_FORTUNE_BONUS_PRIZE_LABEL;
  return String(value || "").trim() || "None";
}

function pickUglyFortunePrize() {
  let roll = randomInt(UGLY_FORTUNE_TOTAL_WEIGHT);
  for (const prize of UGLY_FORTUNE_PRIZES) {
    if (roll < prize.weight) return prize;
    roll -= prize.weight;
  }
  return UGLY_FORTUNE_PRIZES[UGLY_FORTUNE_PRIZES.length - 1];
}

module.exports = {
  UGLY_FORTUNE_BONUS_PRIZE_KEY,
  UGLY_FORTUNE_BONUS_PRIZE_LABEL,
  UGLY_FORTUNE_SPIN_TITLE,
  UGLY_FORTUNE_PRIZES,
  formatBonusPrizeValue,
  isUglyFortuneBonusPrize,
  normalizeBonusPrizeValue,
  pickUglyFortunePrize,
};
