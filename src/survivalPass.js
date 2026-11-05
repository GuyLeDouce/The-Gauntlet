"use strict";
const { Store } = require("./db");
const { getDripPaymentConfig } = require("./drip");
const { SurvivalPassStore, PASS_PRICE, PASS_DAYS } = require("./survivalPassStore");
const { createPassPaymentClient } = require("./survivalPassPayment");

function createSurvivalPassService(store, payment) {
  return {
    status: (guildId,userId) => store.status(guildId,userId),
    entrants: (guildId,openedAt) => store.entrants(guildId,openedAt),
    async grant(id,guildId,userId,operatorId,note) {
      if (![id,userId].every(value => /^\d{17,20}$/.test(value)) || !guildId || !operatorId ||
          typeof note !== "string" || note.trim().length < 12 || note.length > 1000) {
        throw new Error("Enter a valid member and verification note (12–1,000 characters)");
      }
      return store.grant(id,guildId,userId,operatorId,note.trim());
    },
    async approve(id,guildId,operatorId,note) {
      if (!/^\d{17,20}$/.test(id) || !guildId || !operatorId || note.trim().length < 12) {
        throw new Error("Enter a valid purchase reference and verification note (at least 12 characters)");
      }
      return store.finish(id,"succeeded",{adminVerified:true},"operator_verified",
        {by:operatorId,note:note.trim(),guildId});
    },
    async buy(id,guildId,userId) {
      const reservation = await store.reserve(id,guildId,userId);
      if (reservation.kind !== "reserved") return reservation;
      let prepared;
      try { prepared = await payment.prepare(userId); }
      catch (error) {
        await store.finish(id,"failed",{},error.code || "payment_unavailable");
        return { kind: "failed", code: error.code || "payment_unavailable", id };
      }
      // A crash after this durable marker must never cause an automatic retransmission.
      await store.submitted(id,prepared);
      let outcome;
      try { outcome = await payment.transfer(prepared); }
      catch { outcome = { status: "unknown", code: "transfer_unconfirmed" }; }
      console.info("[SURVIVAL PASS] Transfer outcome:", JSON.stringify({
        id, status: outcome.status, code: outcome.code || null,
        httpStatus: outcome.receipt?.httpStatus || null,
        echoDifferences: outcome.receipt?.echoDifferences || [],
        transportCode: outcome.receipt?.transportCode || null,
      }));
      // finish is transactional and idempotent, including a lost COMMIT response.
      // Only retry saving the result; NEVER rerun prepare/transfer here.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const purchase = await store.finish(id,outcome.status,outcome.receipt || {},outcome.code);
          return { kind: purchase.status, purchase, id, code: purchase.error_code || outcome.code };
        } catch {
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve,250 * (attempt + 1)));
        }
      }
      console.error("[SURVIVAL PASS] Settlement needs review:", JSON.stringify({
        id, status: outcome.status, receipt: outcome.receipt || {},
      }));
      return { kind: "pending", id };
    },
  };
}
const passStore = new SurvivalPassStore(() => Store.pool);
const survivalPass = createSurvivalPassService(passStore, createPassPaymentClient({
  http: require("axios"), getConfig: getDripPaymentConfig,
  getOverride: id => Store.getDripUserOverride(id),
}));
module.exports = { survivalPass, createSurvivalPassService, PASS_PRICE, PASS_DAYS };
