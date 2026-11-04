"use strict";
const { PASS_PRICE } = require("./survivalPassStore");
const objectId = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

function paymentError(code) { return Object.assign(new Error(code), { code }); }

function createPassPaymentClient({ http, getConfig, getOverride }) {
  async function prepare(userId) {
    const config = getConfig();
    if (!config.auth || !objectId(config.realmId) || !objectId(config.currencyId) ||
        !objectId(config.senderId)) throw paymentError("payment_not_configured");
    const base = config.baseUrl + "/" + config.realmId;
    async function search(type, value) {
      const response = await http.get(base + "/members/search", {
        params: { type, values: value },
        headers: { Authorization: config.auth }, timeout: 15000,
      });
      const members = response?.data?.data;
      if (!Array.isArray(members) || members.length !== 1 || !objectId(members[0].id)) {
        throw paymentError("account_not_found");
      }
      return members[0];
    }
    const override = await getOverride(userId);
    let buyer;
    if (override) {
      const type = override.drip_credential_type || "drip-id";
      if (!["drip-id","id","member-id","user-id","discord-id"].includes(type)) {
        throw paymentError("account_mapping_needs_review");
      }
      buyer = await search(type === "discord-id" ? type : "drip-id", override.drip_user_id);
    } else {
      buyer = await search("discord-id", userId);
    }
    const recipient = await search("drip-id", config.senderId);
    if (buyer.id === recipient.id) throw paymentError("same_account");
    const balances = buyer.balances;
    if (!Array.isArray(balances)) throw paymentError("balance_unavailable");
    const balance = balances.find(b => b.currencyId === config.currencyId);
    if (!balance || !Number.isSafeInteger(balance.balance) || balance.balance < PASS_PRICE) {
      throw paymentError("insufficient_balance");
    }
    // Snapshot exactly what will be submitted. Never store credentials in the ledger.
    return { baseUrl: base, senderId: buyer.id, recipientId: recipient.id,
      currencyId: config.currencyId, amount: PASS_PRICE };
  }
  async function transfer(payment) {
    const config = getConfig();
    if (payment.amount !== PASS_PRICE || !objectId(payment.senderId) ||
        !objectId(payment.recipientId) || !objectId(payment.currencyId)) {
      throw paymentError("invalid_payment");
    }
    try {
      // Exactly one write request. No legacy fallback, payload guessing or retry.
      const response = await http.patch(
        payment.baseUrl + "/members/" + payment.senderId + "/transfer",
        { amount: PASS_PRICE, recipientId: payment.recipientId, currencyId: payment.currencyId },
        { headers: { Authorization: config.auth }, timeout: 15000, maxRedirects: 0 }
      );
      // HTTP 200 is DRIP's completed-transfer response. Receipt fields are
      // optional in its schema; their absence must not strand a paid customer.
      const body = response?.data;
      const receipt = body?.data && typeof body.data === "object" ? body.data : body;
      const evidence = { httpStatus: response?.status };
      for (const key of ["id", "senderId", "recipientId", "currencyId", "balance"]) {
        if (["string", "number"].includes(typeof receipt?.[key])) evidence[key] = receipt[key];
      }
      if (response?.status !== 200 || body?.error || receipt?.error ||
          body?.success === false || receipt?.success === false) {
        return { status: "unknown", code: "unconfirmed_response", receipt: evidence };
      }
      // Keep explicit contradictions blocked, but do not require optional echoes.
      for (const key of ["senderId", "recipientId", "currencyId"]) {
        if (receipt?.[key] != null && receipt[key] !== payment[key]) {
          return { status: "unknown", code: "receipt_mismatch", receipt: evidence };
        }
      }
      return { status: "succeeded", receipt: evidence };
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.error;
      // Only a definite rejection releases the purchase lock.
      if ([400,401,403,404,422].includes(status)) {
        return { status: "failed", code: code === "InsufficientBalance" ?
          "insufficient_balance" : "transfer_rejected", receipt: { httpStatus: status } };
      }
      return { status: "unknown", code: "transfer_unconfirmed" };
    }
  }
  return { prepare, transfer };
}
module.exports = { createPassPaymentClient };
