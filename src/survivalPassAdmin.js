"use strict";
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,UserSelectMenuBuilder} = require("discord.js");
function adminPassButton() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId("survive:pass:admin").setLabel("Admin: verify paid purchase").setStyle(ButtonStyle.Secondary));
}
async function handlePassVerification(i,{isAdmin,service,enroll}) {
  // Check permissions again on submission, including forged/stale component IDs.
  if (!i.inGuild() || !isAdmin(i)) return i.reply({content:"Only server admins can verify payments.",flags:64});
  if (i.isButton() && i.customId === "survive:pass:admin") {
    return i.reply({flags:64,content:"Verify using a purchase reference, or choose a member for a manual seven-day pass. " +
      "Only grant after checking payment in DRIP. An active pass cannot be extended.",components:[
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("survive:pass:admin:reference")
        .setLabel("Verify by purchase reference").setStyle(ButtonStyle.Secondary)),
      new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("survive:pass:admin:member")
        .setPlaceholder("Choose a member to grant a Survival Pass").setMinValues(1).setMaxValues(1)),
    ]});
  }
  if (i.isUserSelectMenu?.() && i.customId === "survive:pass:admin:member") {
    const userId = i.values[0];
    if (!/^\d{17,20}$/.test(userId)) return;
    let member;
    try { member = await i.guild.members.fetch(userId); } catch {}
    if (!member || member.user.bot) return i.reply({flags:64,content:"Choose a human member of this server."});
    const modal = new ModalBuilder().setCustomId("survive:pass:admin:grant:"+userId).setTitle("Grant seven-day Survival Pass");
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("evidence")
      .setLabel("Payment verification / manual grant reason")
      .setPlaceholder("Submit grants 7 days to the selected member; no charge is made")
      .setStyle(TextInputStyle.Paragraph).setMinLength(12).setMaxLength(1000).setRequired(true)));
    return i.showModal(modal);
  }
  if (i.isButton() && i.customId === "survive:pass:admin:reference") {
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
  const grant = /^survive:pass:admin:grant:(\d{17,20})$/.exec(i.customId);
  if (!i.isModalSubmit() || (i.customId !== "survive:pass:admin:approve" && !grant)) return;
  await i.deferReply({flags:64});
  let purchase;
  try {
    if (grant) {
      let member;
      try { member = await i.guild.members.fetch(grant[1]); } catch {}
      if (!member || member.user.bot) return i.editReply({content:"Choose a human member of this server."});
      purchase = await service.grant(i.id,i.guildId,grant[1],i.user.id,i.fields.getTextInputValue("evidence"));
    } else purchase = await service.approve(i.fields.getTextInputValue("reference").trim(),i.guildId,i.user.id,
      i.fields.getTextInputValue("evidence"));
  } catch (error) {
    const known = /^(Purchase not found|Only submitted|Wait five minutes|Enter a valid|This member already|Grant reference)/.test(error.message);
    return i.editReply({content:known ? error.message : "Verification could not be completed. Check the pass status before retrying."});
  }
  let note = "";
  try { await enroll(); } catch { note = " Lobby entry will be checked again before the game starts."; }
  return i.editReply({content:"Payment verified for <@"+purchase.user_id+">. Pass expires <t:"+
    Math.floor(new Date(purchase.expires_at).getTime()/1000)+":F>. No transfer was sent. Repeating approval does not extend the pass."+note,
    allowedMentions:{parse:[]}});
}
module.exports = {adminPassButton,handlePassVerification};
