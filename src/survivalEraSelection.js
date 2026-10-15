"use strict";
const { randomInt } = require("node:crypto");
const { SURVIVAL_ERAS } = require("./survivalEras");
const { normalizeEraKey } = require("./deathRace");

function normalizeEraPool(raw, fallback = "day_one") {
  const keys = Array.isArray(raw) ? raw : [];
  const pool = [...new Set(keys.filter(key => typeof key === "string")
    .map(key => normalizeEraKey(key.trim())).filter(key => Object.hasOwn(SURVIVAL_ERAS, key)))];
  return pool.length ? pool : [Object.hasOwn(SURVIVAL_ERAS, fallback) ? fallback : "day_one"];
}
function describeEraPool(settings) {
  const pool = normalizeEraPool(settings.era_keys, settings.era_key);
  const names = pool.map(key => SURVIVAL_ERAS[key].label);
  return pool.length > 1 ? `Random: ${names.join(" / ")}` : names[0];
}
function chooseLobbyEra(settings, chooseIndex = randomInt) {
  const pool = normalizeEraPool(settings.era_keys, settings.era_key);
  const key = pool.length === 1 ? pool[0] : pool[chooseIndex(pool.length)];
  return { ...settings, era_keys: [...pool], era_key: key, era: SURVIVAL_ERAS[key].label };
}
module.exports = { normalizeEraPool, describeEraPool, chooseLobbyEra };
