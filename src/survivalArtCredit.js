"use strict";

// A tiny, non-interactive creator acknowledgement inside the milestone embed.
// The original reward ledger and end-of-game payout are unchanged.
function buildSurvivalArtCreditField(reward) {
  if (!reward) return null;
  const userId = String(reward.userId || "");
  const amount = Number(reward.amount);
  // Only emit trusted Discord snowflake mentions; never interpolate arbitrary
  // untrusted names or messages into an embed field.
  if (!/^\d{17,20}$/.test(userId) ||
      !Number.isFinite(amount) || amount <= 0) return null;

  return {
    name: "🎨 Artwork",
    value: `<@${userId}> · +${amount} $CHARM toward creator total`,
    inline: false,
  };
}

function addSurvivalArtCredit(embed, reward) {
  const field = buildSurvivalArtCreditField(reward);
  if (field) embed.addFields(field);
  return embed;
}

module.exports = { buildSurvivalArtCreditField, addSurvivalArtCredit };
