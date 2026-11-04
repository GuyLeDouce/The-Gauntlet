"use strict";
const { Store } = require("./db");
const { getDripPaymentConfig } = require("./drip");
const { SurvivalPassStore, PASS_PRICE, PASS_DAYS } = require("./survivalPassStore");
const { createPassPaymentClient } = require("./survivalPassPayment");

function createSurvivalPassService(store, payment) {
  return {
    status: (guildId,userId) => store.status(guildId,userId),
    entrants: (guildId,openedAt) => store.entrants(guildId,openedAt),
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
      try {
        const purchase = await store.finish(id,outcome.status,outcome.receipt || {},outcome.code);
        return { kind: outcome.status, purchase, id, code: outcome.code };
      } catch {
        // Preserve submitted + pending. Recovery requires evidence, never a second charge.
        console.error("[SURVIVAL PASS] Settlement needs review:", JSON.stringify({
          id, status: outcome.status, receipt: outcome.receipt || {},
        }));
        return { kind: "pending", id };
      }
    },
  };
}
const passStore = new SurvivalPassStore(() => Store.pool);
const survivalPass = createSurvivalPassService(passStore, createPassPaymentClient({
  http: require("axios"), getConfig: getDripPaymentConfig,
  getOverride: id => Store.getDripUserOverride(id),
}));
module.exports = { survivalPass, createSurvivalPassService, PASS_PRICE, PASS_DAYS };
