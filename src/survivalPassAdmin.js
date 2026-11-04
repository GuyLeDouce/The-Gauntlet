"use strict";
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle} = require("discord.js");
function adminPassButton() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId("survive:pass:admin").setLabel("Admin: verify paid purchase").setStyle(ButtonStyle.Secondary));
}
async function handlePassVerification(i,{isAdmin,service,enroll}) {
  // Check permissions again on submission, including forged/stale component IDs.
  if (!i.inGuild() || !isAdmin(i)) return i.reply({content:"Only server admins can verify payments.",flags:64});
  if (i.isButton() && i.customId === "survive:pass:admin") {
    const modal = new ModalBuilder().setCustomId("survive:pass:admin:approve").setTitle("Confirm paid Survival Pass");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reference")
        .setLabel("Purchase reference").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(17).setMaxLength(20)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("evidence")
        .setLabel("Verified 2,500 CHARM in DRIP: evidence")
        .setPlaceholder("Buyer, recipient, time or transaction reference; submit activates 7 days")
        .setStyle(TextInputStyle.Paragraph).setMinLength(12).setMaxLength(1000).setRequired(true)));
    return i.showModal(modal);
  }
  if (!i.isModalSubmit() || i.customId !== "survive:pass:admin:approve") return;
  await i.deferReply({flags:64});
  let purchase;
  try {
    purchase = await service.approve(i.fields.getTextInputValue("reference").trim(),i.guildId,i.user.id,
      i.fields.getTextInputValue("evidence"));
  } catch (error) {
    const known = /^(Purchase not found|Only submitted|Wait five minutes|Enter a valid)/.test(error.message);
    return i.editReply({content:known ? error.message : "Verification could not be completed. Check the pass status before retrying."});
  }
  let note = "";
  try { await enroll(); } catch { note = " Lobby entry will be checked again before the game starts."; }
  return i.editReply({content:"Payment verified for <@"+purchase.user_id+">. Pass expires <t:"+
    Math.floor(new Date(purchase.expires_at).getTime()/1000)+":F>. No transfer was sent. Repeating approval does not extend the pass."+note,
    allowedMentions:{parse:[]}});
}
module.exports = {adminPassButton,handlePassVerification};
