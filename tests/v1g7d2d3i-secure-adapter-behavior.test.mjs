import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function moduleUrl(path, replace = {}) {
  let js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [from, to] of Object.entries(replace)) js = js.replaceAll(from, to);
  return "data:text/javascript;base64," + Buffer.from(js).toString("base64");
}
const cryptoUrl = moduleUrl("../src/lib/cards/refresh-handoff-crypto.ts");
const protocolUrl = moduleUrl("../src/lib/cards/refresh-redis-protocol.ts");
const clientUrl = moduleUrl("../src/lib/cards/refresh-redis-client.ts", { '"./refresh-redis-protocol"': JSON.stringify(protocolUrl) });
const coordinatorUrl = moduleUrl("../src/lib/cards/distributed-refresh-coordinator.ts");
const adapterUrl = moduleUrl("../src/lib/cards/secure-redis-refresh-adapter.ts", {
  '"./distributed-refresh-coordinator"': JSON.stringify(coordinatorUrl),
  '"./refresh-handoff-crypto"': JSON.stringify(cryptoUrl),
  '"./refresh-redis-client"': JSON.stringify(clientUrl),
});
const { coordinateSecureRedisRefresh } = await import(adapterUrl);
const { refreshIdentity } = await import(cryptoUrl);
const previous = { fetch: globalThis.fetch, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, identity: process.env.SESSION_REFRESH_IDENTITY_KEY, handoff: process.env.SESSION_REFRESH_HANDOFF_KEY };
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
process.env.SESSION_REFRESH_IDENTITY_KEY = "11".repeat(32);
process.env.SESSION_REFRESH_HANDOFF_KEY = "22".repeat(32);
function fakeRedis() {
  const store = new Map();
  return async (_url, options) => {
    const args = JSON.parse(options.body); let result;
    if (args[0] === "GET") result = store.get(args[1]) ?? null;
    else if (args[0] === "SET") { result = store.has(args[1]) ? null : "OK"; if (result) store.set(args[1], args[2]); }
    else if (args[0] === "EVAL") {
      const publish = args[2] === 2, owner = publish ? args[5] : args[4];
      if (store.get(args[3]) !== owner) result = 0;
      else {
        if (publish) store.set(args[4], args[6]);
        store.delete(args[3]); result = 1;
      }
    } else throw new Error("Unexpected Redis command");
    return { ok: true, json: async () => ({ result }) };
  };
}
const pair = { access: "access-for-user-A", refresh: "rotated-A", expires: 3600 };
test("same refresh identity adopts verified handoff without second provider rotation", async () => {
  globalThis.fetch = fakeRedis();
  let calls = 0;
  const input = { refreshToken: "original-A", verifyPair: async (p) => p.access === pair.access,
    refreshProvider: async () => { calls++; return pair; } };
  assert.deepEqual(await coordinateSecureRedisRefresh(input), { kind: "success", pair });
  assert.deepEqual(await coordinateSecureRedisRefresh(input), { kind: "success", pair });
  assert.equal(calls, 1);
});
test("different refresh token cannot read another token's handoff", async () => {
  globalThis.fetch = fakeRedis();
  assert.notEqual(refreshIdentity("original-A"), refreshIdentity("original-B"));
  let calls = 0;
  const input = { verifyPair: async () => true, refreshProvider: async () => { calls++; return pair; } };
  await coordinateSecureRedisRefresh({ ...input, refreshToken: "original-A" });
  await coordinateSecureRedisRefresh({ ...input, refreshToken: "original-B" });
  assert.equal(calls, 2);
});
test("provider identity mismatch is rejected without publishing handoff", async () => {
  globalThis.fetch = fakeRedis();
  const input = { refreshToken: "original-C", verifyPair: async () => false, refreshProvider: async () => pair };
  assert.deepEqual(await coordinateSecureRedisRefresh(input), { kind: "retryable" });
});
test("Redis outage is retryable and provider is not called", async () => {
  globalThis.fetch = async () => { throw new Error("offline"); };
  let calls = 0;
  const outcome = await coordinateSecureRedisRefresh({
    refreshToken: "original-D", verifyPair: async () => true,
    refreshProvider: async () => { calls++; return pair; }
  });
  assert.deepEqual(outcome, { kind: "retryable" });
  assert.equal(calls, 0);
});
test.after(() => {
  globalThis.fetch = previous.fetch;
  for (const [key, value] of [["UPSTASH_REDIS_REST_URL", previous.url], ["UPSTASH_REDIS_REST_TOKEN", previous.token], ["SESSION_REFRESH_IDENTITY_KEY", previous.identity], ["SESSION_REFRESH_HANDOFF_KEY", previous.handoff]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
