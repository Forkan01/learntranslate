/**
 * Opt-in LIVE Upstash Redis integration test for the exact production Lua.
 * Run ONLY against a disposable/scratch database, never production.
 * Requires LT_REDIS_INTEGRATION=1 and isolated LT_TEST_REDIS_URL/TOKEN.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ts from "typescript";

const enabled = process.env.LT_REDIS_INTEGRATION === "1";
const url = process.env.LT_TEST_REDIS_URL;
const token = process.env.LT_TEST_REDIS_TOKEN;
const src = readFileSync(new URL("../src/lib/cards/generation-budget.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { GENERATION_QUOTA_LUA: lua } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

async function command(...args) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200, "Redis command failed");
  const payload = await response.json();
  if (payload.error) throw new Error("Redis returned an error");
  return payload.result;
}

test("LIVE scratch Redis: production Lua atomically limits users, globals and concurrent calls", { skip: !enabled }, async () => {
  assert.ok(url && token, "Set LT_TEST_REDIS_URL and LT_TEST_REDIS_TOKEN for a disposable Redis database");
  const endpoint = new URL(url);
  assert.equal(endpoint.protocol, "https:");
  assert.equal(endpoint.username, "");
  assert.equal(endpoint.password, "");
  assert.equal(endpoint.search, "");
  assert.equal(endpoint.hash, "");
  assert.equal(process.env.LT_TEST_REDIS_ISOLATED, "YES", "Explicitly acknowledge this is an isolated scratch database");
  const prefix = "lt:integration:" + randomUUID() + ":";
  const keys = [prefix + "global:day", prefix + "global:minute", prefix + "actor:day", prefix + "actor:minute"];
  const otherActor = [keys[0], keys[1], prefix + "other:day", prefix + "other:minute"];
  const allKeys = [...new Set([...keys, ...otherActor])];
  const reserve = (ks, globalDay=10, globalMinute=2, actorDay=3, actorMinute=1) =>
    command("EVAL", lua, "4", ...ks, String(globalDay), String(globalMinute), "120", String(actorDay), String(actorMinute));
  try {
    assert.equal(await reserve(keys), 1);
    assert.equal(await reserve(keys), 0, "Same actor must be limited to one per minute");
    assert.equal(await reserve(otherActor), 1, "Another actor should be admitted");
    assert.equal(await reserve([keys[0], keys[1], prefix+"third:day", prefix+"third:minute"]), 0, "Global minute limit must apply");
    assert.equal(Number(await command("GET", keys[0])), 2);
    assert.ok(Number(await command("TTL", keys[0])) > 0);
    assert.ok(Number(await command("TTL", keys[2])) > 0);
    // Reset only the uniquely prefixed test keys for a fresh concurrency burst.
    await command("DEL", ...allKeys);
    const burst = await Promise.all(Array.from({ length: 25 }, (_, i) =>
      reserve([keys[0], keys[1], prefix+"burst:"+i+":day", prefix+"burst:"+i+":minute"])));
    assert.equal(burst.filter(x => x === 1).length, 2, "Only two simultaneous requests may be admitted");
    assert.equal(burst.filter(x => x === 0).length, 23);
    assert.equal(Number(await command("GET", keys[0])), 2);
  } finally {
    // Never delete production keys; this test only touches a UUID-prefixed namespace.
    // Burst actor keys expire automatically after 120 seconds.
    await command("DEL", ...allKeys);
  }
});
