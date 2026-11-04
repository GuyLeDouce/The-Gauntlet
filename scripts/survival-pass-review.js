"use strict";
// Operator-only recovery. This script NEVER calls DRIP or transfers funds.
require("dotenv").config();
const { parseArgs } = require("node:util");
const { Store } = require("../src/db");
const { SurvivalPassStore } = require("../src/survivalPassStore");

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    id: { type: "string" }, by: { type: "string" }, note: { type: "string" },
    "confirm-transferred": { type: "boolean" },
    "confirm-not-transferred": { type: "boolean" },
  } });
  const action = positionals[0];
  if (!["list","resolve","reset-test"].includes(action)) {
    throw new Error("Usage: node scripts/survival-pass-review.js list | resolve --id ID --by OPERATOR --note EVIDENCE --confirm-transferred|--confirm-not-transferred");
  }
  if (["resolve","reset-test"].includes(action) && (!values.id || !values.by || (values.note || "").length < 12 ||
      Boolean(values["confirm-transferred"]) === Boolean(values["confirm-not-transferred"]))) {
    throw new Error("Resolution requires an ID, operator, evidence note and exactly one confirmed outcome.");
  }
  if (String(process.env.GAUNTLET_RESET).toLowerCase() === "true") {
    throw new Error("Refusing to run with GAUNTLET_RESET enabled.");
  }
  await Store.init();
  try {
    if (action === "list") {
      const rows = await Store.pool.query(`SELECT id,guild_id,user_id,amount,status,
        payment,receipt,error_code,created_at FROM gauntlet_survival_pass_purchases
        WHERE status IN ('reserved','submitted','unknown') ORDER BY created_at`);
      console.log(JSON.stringify(rows.rows,null,2));
      return;
    }
    if (action === "reset-test") {
      if (!values["confirm-transferred"]) throw new Error("Test reset requires confirmed payment");
      const result = await new SurvivalPassStore(() => Store.pool).resetForTest(values.id,
        {by:values.by,note:values.note});
      console.log(JSON.stringify({id:result.id,status:result.status,testReset:true}));
      return;
    }
    const row = (await Store.pool.query(`SELECT *,created_at < now()-interval '5 minutes' AS old_enough
      FROM gauntlet_survival_pass_purchases WHERE id=$1`, [values.id])).rows[0];
    if (!row || !row.old_enough || !["reserved","submitted","unknown"].includes(row.status)) {
      throw new Error("Only unresolved purchases at least five minutes old may be reviewed.");
    }
    const store = new SurvivalPassStore(() => Store.pool);
    const outcome = values["confirm-transferred"] ? "succeeded" : "failed";
    const result = await store.finish(values.id,outcome,row.receipt,"operator_verified",
      { by: values.by, note: values.note });
    console.log(JSON.stringify({ id: result.id, status: result.status, expires_at: result.expires_at }));
  } finally { await Store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
