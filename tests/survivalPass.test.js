"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { PGlite } = require("@electric-sql/pglite");
const { SurvivalPassStore, initSurvivalPassSchema } = require("../src/survivalPassStore");
const { createSurvivalPassService } = require("../src/survivalPass");
const { createPassPaymentClient } = require("../src/survivalPassPayment");
const { passPanel, validConfirmation } = require("../src/survivalPassPanel");

async function database(t) {
  const db = new PGlite();
  let queue = Promise.resolve();
  const query = async (sql, args) => {
    const result = args ? await db.query(sql,args) : (await db.exec(sql)).at(-1);
    return { rows: result.rows || [], rowCount: result.affectedRows ?? result.rows?.length ?? 0 };
  };
  const pool = { query, async connect() {
    const before = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await before;
    return { query, release };
  } };
  t.after(() => db.close());
  const source = require("node:fs").readFileSync(require.resolve("../src/db"),"utf8");
  const lobbySchema = source.match(/CREATE TABLE IF NOT EXISTS gauntlet_survival_lobby \([\s\S]*?\);/)[0];
  await query(lobbySchema);
  await initSurvivalPassSchema(pool);
  await initSurvivalPassSchema(pool);
  return { pool, store: new SurvivalPassStore(() => pool) };
}
const successPayment = () => ({ prepare: async () => ({ amount: 2500 }),
  transfer: async () => ({ status: "succeeded", receipt: { id: "receipt" } }) });

test("database purchase is non-stackable, idempotent, persists and expires after exactly seven days", async t => {
  const { pool,store } = await database(t);
  const payment = successPayment();
  let calls = 0;
  payment.transfer = async () => { calls++; return { status: "succeeded", receipt: { id: "receipt" } }; };
  const service = createSurvivalPassService(store,payment);
  const result = await service.buy("one","guild","user");
  assert.equal(result.kind,"succeeded");
  assert.equal(new Date(result.purchase.expires_at)-new Date(result.purchase.activated_at),7*86400000);
  assert.equal((await service.buy("one","guild","user")).kind,"duplicate");
  assert.equal((await service.buy("two","guild","user")).kind,"active");
  assert.equal(calls,1);
  assert.equal((await new SurvivalPassStore(() => pool).status("guild","user")).active,true);
  // Expired passes still cover a lobby which opened during their validity.
  await pool.query(`UPDATE gauntlet_survival_passes SET activated_at=now()-interval '8 days',
    expires_at=now()-interval '1 day' WHERE user_id='user'`);
  assert.deepEqual(await store.entrants("guild",new Date(Date.now()-2*86400000)),["user"]);
  assert.deepEqual(await store.entrants("guild",new Date()),[]);
  assert.deepEqual(await store.entrants("other",new Date(Date.now()-2*86400000)),[]);
  assert.equal((await service.buy("three","guild","user")).kind,"succeeded");
  assert.equal(calls,2);
  assert.equal((await service.buy("one","guild","user")).kind,"duplicate");
});

test("simultaneous confirmations reserve once, even with different interaction IDs", async t => {
  const { store } = await database(t);
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const payment = { prepare: async () => { await gate; return {}; },
    transfer: async () => { calls++; return { status: "succeeded" }; } };
  const service = createSurvivalPassService(store,payment);
  const first = service.buy("a","guild","user");
  // Wait until the durable reservation exists; no external request has been sent.
  while (!(await store.status("guild","user"))?.pending_purchase_id) {
    await new Promise(resolve => setImmediate(resolve));
  }
  const second = await service.buy("b","guild","user");
  assert.equal(second.kind,"pending");
  release();
  assert.equal((await first).kind,"succeeded");
  assert.equal(calls,1);
});

test("uncertain transfer remains blocked after restart; operator settlement never charges again", async t => {
  const { pool,store } = await database(t);
  let calls = 0;
  const payment = successPayment();
  payment.transfer = async () => { calls++; return { status: "unknown", code: "timeout" }; };
  const service = createSurvivalPassService(store,payment);
  assert.equal((await service.buy("a","guild","user")).kind,"unknown");
  const restarted = createSurvivalPassService(new SurvivalPassStore(() => pool),payment);
  assert.equal((await restarted.buy("b","guild","user")).kind,"pending");
  assert.equal((await store.status("guild","user")).active,null);
  await store.finish("a","succeeded",{ id: "verified" },null,{ by: "admin",note: "DRIP verified receipt" });
  assert.equal((await restarted.status("guild","user")).active,true);
  assert.equal((await store.finish("a","failed")).status,"succeeded");
  assert.equal(calls,1);
});

test("preflight rejection releases the reservation, and a submitted crash remains pending", async t => {
  const { store } = await database(t);
  const payment = successPayment();
  payment.prepare = async () => { throw Object.assign(new Error(),{ code: "insufficient_balance" }); };
  payment.transfer = async () => assert.fail("No transfer on insufficient balance");
  const service = createSurvivalPassService(store,payment);
  assert.equal((await service.buy("a","guild","user")).code,"insufficient_balance");
  assert.equal((await store.status("guild","user")).pending_purchase_id,null);
  await store.reserve("b","guild","user");
  await store.submitted("b",{ amount: 2500 });
  assert.equal((await service.buy("c","guild","user")).kind,"pending");
});

test("confirmed transfer followed by DB failure never sends another payment", async t => {
  const { store } = await database(t);
  let calls = 0;
  const payment = successPayment();
  payment.transfer = async () => { calls++; return { status: "succeeded" }; };
  const finish = store.finish.bind(store);
  store.finish = async () => { throw new Error("DB unavailable"); };
  const service = createSurvivalPassService(store,payment);
  assert.equal((await service.buy("a","guild","user")).kind,"pending");
  store.finish = finish;
  assert.equal((await service.buy("b","guild","user")).kind,"pending");
  assert.equal(calls,1);
});

const config = { auth: "Bearer test", realmId: "a".repeat(24), currencyId: "b".repeat(24),
  senderId: "c".repeat(24), baseUrl: "https://api.drip.re/api/v1/realms" };
const buyerId = "d".repeat(24);
function api(overrides = {}) {
  const writes = [], reads = [];
  const http = {
    async get(url,opts) {
      reads.push(opts.params);
      return { data: { data: [{ id: opts.params.type === "discord-id" ? buyerId : config.senderId,
        balances: [{ currencyId: config.currencyId, balance: 5000 }] }] } };
    },
    async patch(url,body,opts) {
      writes.push({ url,body,opts });
      return { status: 200, data: { id: "receipt",senderId: buyerId,
        recipientId: config.senderId,currencyId: config.currencyId,balance: 2500 } };
    },
    ...overrides,
  };
  return { writes,reads,http,client: createPassPaymentClient({
    http,getConfig: () => config,getOverride: async () => null,
  }) };
}

test("DRIP sends one positive 2500 transfer from exact Discord lookup to payout sender", async () => {
  const h = api();
  const payment = await h.client.prepare("123456789012345678");
  const result = await h.client.transfer(payment);
  assert.equal(result.status,"succeeded");
  assert.deepEqual(h.reads,[{type:"discord-id",values:"123456789012345678"},
    {type:"drip-id",values:config.senderId}]);
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].url,config.baseUrl+"/"+config.realmId+"/members/"+buyerId+"/transfer");
  assert.deepEqual(h.writes[0].body,{ amount:2500,recipientId:config.senderId,currencyId:config.currencyId });
  assert.equal(JSON.stringify(payment).includes("Bearer"),false);
});

test("DRIP timeouts, 5xx, rate limits and mismatched receipts never retry or activate", async () => {
  for (const status of [undefined,429,500,502]) {
    let writes = 0;
    const h = api({ async patch() { writes++; throw { response: status ? { status } : undefined }; } });
    assert.equal((await h.client.transfer(await h.client.prepare("user"))).status,"unknown");
    assert.equal(writes,1);
  }
  const bad = api({ async patch() { return { status:200,data:{ id:"x",senderId:"wrong" } }; } });
  assert.equal((await bad.client.transfer(await bad.client.prepare("user"))).status,"unknown");
});

test("DRIP insufficient funds and identity/config errors do not submit transfers", async () => {
  const h = api({ async get() { return { data:{data:[{id:buyerId,
    balances:[{currencyId:config.currencyId,balance:2499}]}]} }; } });
  // Distinct recipient response so the balance check is exercised.
  let count = 0;
  h.http.get = async () => ({ data:{data:[{id:count++ ? config.senderId:buyerId,
    balances:[{currencyId:config.currencyId,balance:2499}]}]} });
  await assert.rejects(h.client.prepare("user"),{code:"insufficient_balance"});
  assert.equal(h.writes.length,0);
  const ambiguous = api({ async get() { return {data:{data:[{id:buyerId},{id:config.senderId}]}}; } });
  await assert.rejects(ambiguous.client.prepare("user"),{code:"account_not_found"});
  const unsupported = createPassPaymentClient({ http:h.http,getConfig:()=>config,
    getOverride:async()=>({drip_credential_type:"username",drip_user_id:"name"}) });
  await assert.rejects(unsupported.prepare("user"),{code:"account_mapping_needs_review"});
  const missing = createPassPaymentClient({ http:h.http,getConfig:()=>({...config,currencyId:null}),
    getOverride:async()=>null });
  await assert.rejects(missing.prepare("user"),{code:"payment_not_configured"});
});

test("confirmation is private, bound to the buyer, expires, and active passes cannot purchase", () => {
  const user = "123456789012345678";
  const now = Date.now();
  const id = String(BigInt(now-1420070400000) << 22n);
  const custom = "survive:pass:buy:"+user+":"+id;
  assert.equal(validConfirmation(custom,user,now),id);
  assert.equal(validConfirmation(custom,"223456789012345678",now),null);
  assert.equal(validConfirmation(custom,user,now+16*60000),null);
  const panel = passPanel(null,user,id);
  assert.match(panel.embeds[0].toJSON().description,/2,500/);
  assert.equal(panel.components[0].toJSON().components[0].custom_id,custom);
  assert.equal(passPanel({active:true,expires_at:new Date(now+86400000)},user,id).components.length,0);
  assert.equal(passPanel({pending_purchase_id:id},user,id).components.length,0);
});

test("existing lobby SQL round-trips skip choices and earned entries", async t => {
  const { pool } = await database(t);
  const { Store } = require("../src/db");
  const lobby = { guild_id:"guild",channel_id:"channel",created_at:new Date(),
    joined:new Set(["a","b"]),skipped:new Set(["c"]),settings:{era_key:"squigwreck"} };
  await Store.upsertSurvivalLobby.call({pool},lobby);
  const saved = await Store.getSurvivalLobby.call({pool});
  assert.deepEqual(saved.joined_ids,["a","b"]);
  assert.deepEqual(saved.skipped_ids,["c"]);
  assert.equal(saved.settings.era_key,"squigwreck");
  lobby.joined.delete("b"); lobby.skipped.add("b");
  await Store.upsertSurvivalLobby.call({pool},lobby);
  const updated = await Store.getSurvivalLobby.call({pool});
  assert.deepEqual(updated.joined_ids,["a"]);
  assert.deepEqual(updated.skipped_ids,["c","b"]);
});

test("pass recipient and the real reward helper resolve the same configured payout account", async () => {
  const vm = require("node:vm");
  const source = require("node:fs").readFileSync(require.resolve("../src/drip"),"utf8");
  for (const key of ["DRIP_SENDER_ID","DRIP_TRANSFER_SENDER_ID","DRIP_TIPPER_ID"]) {
    const writes = [];
    const http = {
      async get(url) {
        const search = new URL(url);
        const id = search.searchParams.get("type")==="discord-id" ? buyerId : config.senderId;
        return {data:{data:[{id}]}};
      },
      async patch(url,body) { writes.push({url,body}); return {status:200,data:{}}; },
    };
    const context = { module:{exports:{}}, console:{log(){},warn(){},error(){}},
      process:{env:{DRIP_API_KEY:"test",DRIP_REALM_ID:config.realmId,
        DRIP_REALM_POINT_ID:config.currencyId,[key]:config.senderId}},
      require: name => name==="axios" ? http : {Store:{getDripUserOverride:async()=>null}} };
    vm.runInNewContext(source,context);
    const helpers = context.module.exports;
    const result = await helpers.rewardCharmAmount({
      userId:"123456789012345678",username:"player",amount:50,source:"test",
    });
    assert.equal(result.ok,true);
    assert.equal(helpers.getDripPaymentConfig().senderId,config.senderId);
    assert.ok(writes[0].url.endsWith("/members/"+config.senderId+"/transfer"));
    assert.equal(writes[0].body.recipientId,buyerId);
  }
});

test("completed DRIP response activates without optional echoes, including wrapped receipts", async () => {
  for (const data of [{}, {id:"receipt"}, {data:{id:"receipt",senderId:buyerId}}, null]) {
    const h = api({async patch() { return {status:200,data}; }});
    const result = await h.client.transfer(await h.client.prepare("user"));
    assert.equal(result.status,"succeeded");
    assert.equal(result.receipt.httpStatus,200);
  }
  for (const response of [{status:202,data:{}},{status:200,data:{error:"rejected"}},
    {status:200,data:{data:{success:false}}}]) {
    const h = api({async patch() {return response;}});
    assert.equal((await h.client.transfer(await h.client.prepare("user"))).status,"unknown");
  }
});

test("paid test reset unlocks only the selected purchase and preserves its audit history", async t => {
  const {pool,store} = await database(t);
  await store.reserve("test","guild","user");
  await store.submitted("test",{amount:2500});
  await store.finish("test","unknown",{},"unconfirmed_response");
  const review = {by:"operator",note:"Buyer confirmed DRIP charged this test"};
  await assert.rejects(store.resetForTest("test",review),/five minutes/);
  await pool.query(`UPDATE gauntlet_survival_pass_purchases SET created_at=now()-interval '10 minutes' WHERE id='test'`);
  const result = await store.resetForTest("test",review);
  assert.equal(result.status,"succeeded");
  assert.equal(result.receipt.testReset,true);
  assert.equal((await store.status("guild","user")).active,false);
  assert.equal((await store.reserve("new","guild","user")).kind,"reserved");
  await store.resetForTest("test",review);
  assert.equal((await store.status("guild","user")).pending_purchase_id,"new");
  await assert.rejects(store.resetForTest("missing",review),/not found/);
});

test("admin verification is guild scoped, audited, idempotent and does not transfer", async t => {
  const {pool,store} = await database(t);
  const id = "1567352386391904477";
  const service = createSurvivalPassService(store,{prepare:()=>assert.fail(),transfer:()=>assert.fail()});
  await store.reserve(id,"guild","buyer");
  await store.submitted(id,{amount:2500});
  await store.finish(id,"unknown",{httpStatus:200},"receipt_mismatch");
  await assert.rejects(service.approve(id,"other","admin","DRIP transfer verified"),/this server/);
  await assert.rejects(service.approve(id,"guild","admin","DRIP transfer verified"),/five minutes/);
  await pool.query(`UPDATE gauntlet_survival_pass_purchases SET created_at=now()-interval '10 minutes' WHERE id=$1`,[id]);
  const result = await service.approve(id,"guild","admin","DRIP transfer verified");
  assert.equal(result.status,"succeeded");
  assert.equal(result.reviewed_by,"admin");
  assert.equal(result.receipt.httpStatus,200);
  assert.equal((await store.status("guild","buyer")).active,true);
  const duplicate = await service.approve(id,"guild","admin2","DRIP transfer verified again");
  assert.equal(+new Date(duplicate.expires_at),+new Date(result.expires_at));
  assert.equal(duplicate.reviewed_by,"admin");
});

test("Discord verification rechecks admin permissions on both button and modal", async () => {
  const {handlePassVerification} = require("../src/survivalPassAdmin");
  for (const button of [true,false]) {
    let reply;
    await handlePassVerification({inGuild:()=>true,isButton:()=>button,isModalSubmit:()=>!button,
      reply:async value=>{reply=value;}},{isAdmin:()=>false,service:{approve:()=>assert.fail()}});
    assert.match(reply.content,/Only server admins/);
    assert.equal(reply.flags,64);
  }
  let modal;
  await handlePassVerification({inGuild:()=>true,isButton:()=>true,customId:"survive:pass:admin",
    showModal:async value=>{modal=value.toJSON();}},{isAdmin:()=>true});
  assert.equal(modal.custom_id,"survive:pass:admin:approve");
  let response, enrolled=false;
  await handlePassVerification({inGuild:()=>true,isButton:()=>false,isModalSubmit:()=>true,
    customId:modal.custom_id,guildId:"guild",user:{id:"admin"},
    fields:{getTextInputValue:key=>key==="reference"?"1567352386391904477":"Verified transfer"},
    deferReply:async opts=>assert.equal(opts.flags,64),editReply:async value=>{response=value;}},
    {isAdmin:()=>true,service:{approve:async (...args)=>{assert.deepEqual(args,["1567352386391904477","guild","admin","Verified transfer"]);
      return {user_id:"buyer",expires_at:new Date()};}},enroll:async()=>{enrolled=true;}});
  assert.equal(enrolled,true);
  assert.match(response.content,/No transfer was sent/);
});
