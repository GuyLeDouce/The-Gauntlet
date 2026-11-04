"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { PASS_PRICE, PASS_DAYS } = require("./survivalPassStore");

function passButton() {
  return new ButtonBuilder().setCustomId("survive:pass")
    .setLabel("Survival Pass").setStyle(ButtonStyle.Primary);
}
function validConfirmation(customId,userId,now = Date.now()) {
  const match = /^survive:pass:buy:(\d{17,20}):(\d{17,20})$/.exec(customId);
  if (!match || match[1] !== userId) return null;
  const created = Number((BigInt(match[2]) >> 22n) + 1420070400000n);
  return created <= now + 5000 && now - created <= 15 * 60_000 ? match[2] : null;
}
function passPanel(status, userId, interactionId) {
  const embed = new EmbedBuilder().setTitle("Squig Survival Pass").setColor(0x2ecc71);
  const components = [];
  if (status?.active) {
    const expires = Math.floor(new Date(status.expires_at).getTime()/1000);
    embed.setDescription("Your Survival Pass is active.\nExpires <t:" + expires + ":F> (<t:" +
      expires + ":R>).\nYou automatically enter open public Survival lobbies. " +
      "Another pass can be purchased after this one expires.");
  } else if (status?.pending_purchase_id) {
    embed.setDescription("Your previous purchase is still being checked. You will not be charged again.\n" +
      "Reference: " + status.pending_purchase_id);
  } else {
    embed.setDescription("**" + PASS_PRICE.toLocaleString("en-US") + " $CHARM • " + PASS_DAYS +
      " days**\nAutomatically enter every public Squig Survival lobby while your pass is active.\n\n" +
      "One entry per Discord account. No extra lives, improved odds or bonus rewards. " +
      "Free manual entry remains available.\n\n" +
      "The payment transfers to The Gauntlet's configured payout account. " +
      "No stacking or automatic renewal. Leave skips only that lobby. " +
      "Entries remain valid after pass expiry.");
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("survive:pass:buy:" + userId + ":" + interactionId)
        .setLabel("Confirm — 2,500 $CHARM").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("survive:pass:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    ));
  }
  return { embeds: [embed], components };
}
function purchaseText(result) {
  if (result.kind === "succeeded") {
    const expires = Math.floor(new Date(result.purchase.expires_at).getTime()/1000);
    return "Survival Pass activated! **2,500 $CHARM** transferred.\nExpires <t:" +
      expires + ":F> (<t:" + expires + ":R>).\nAutomatic entry is enabled; Leave still skips a lobby.";
  }
  if (result.kind === "active") return "You already have an active Survival Pass. No payment was taken.";
  if (result.kind === "duplicate") return "This purchase has already been processed or is being checked. " +
    "No second transfer was sent. Open Survival Pass to see your status.";
  if (result.kind === "failed") {
    if (result.code === "insufficient_balance") return "You need at least **2,500 $CHARM** to buy a pass. " +
      "No pass was activated. Free Join is still available.";
    return "The purchase could not be completed. No pass was activated. " +
      "Please check your linked DRIP account or contact the team. Reference: " + result.id;
  }
  return "Your payment needs verification. Do not purchase again; no second transfer will be sent. " +
    "The team can review reference: " + result.id;
}
module.exports = { passButton, passPanel, validConfirmation, purchaseText };
