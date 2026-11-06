import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(path, replacements = {}) {
  let code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(replacements)) code = code.replaceAll(from, to);
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const protocol = load("../src/lib/cards/refresh-redis-protocol.ts");
const client = await import(load("../src/lib/cards/refresh-redis-client.ts", { '"./refresh-redis-protocol"': JSON.stringify(protocol) }));
const crypto = await import(load("../src/lib/cards/refresh-handoff-crypto.ts"));
const previous = { fetch: globalThis.fetch, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, identity: process.env.SESSION_REFRESH_IDENTITY_KEY, handoff: process.env.SESSION_REFRESH_HANDOFF_KEY };
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
process.env.SESSION_REFRESH_IDENTITY_KEY = "11".repeat(32);
process.env.SESSION_REFRESH_HANDOFF_KEY = "22".repeat(32);
function redis() {
  const state = new Map(); let now = 0; let down = false;
  function get(key) { const item = state.get(key); if (!item) return null; if (item.until <= now) { state.delete(key); return null; } return item.value; }
  function put(key, value, ttl) { state.set(key, { value, until: now + ttl }); }
  return {
    advance(ms) { now += ms; },
    outage(value) { down = value; },
    async fetch(_url, options) {
      if (down) throw new Error("simulated outage");
      const args = JSON.parse(options.body); let result;
      if (args[0] === "SET") { result = get(args[1]) === null ? (put(args[1], args[2], args[5]), "OK") : null; }
      else if (args[0] === "GET") result = get(args[1]);
      else if (args[0] === "EVAL") {
        const publish = args[2] === 2, owner = publish ? args[5] : args[4];
        if (get(args[3]) !== owner) result = 0;
        else { if (publish) put(args[4], args[6], args[7]); state.delete(args[3]); result = 1; }
      } else throw new Error("unexpected command");
      return { ok: true, json: async () => ({ result }) };
    }
  };
}
test("two independent callers compete for one lease and read encrypted handoff", async () => {
  const db = redis(); globalThis.fetch = db.fetch;
  const id = crypto.refreshIdentity("shared-token");
  const leases = await Promise.all([client.acquireRefreshLease(id), client.acquireRefreshLease(id)]);
  assert.equal(leases.filter(Boolean).length, 1);
  const pair = { access: "access-secret", refresh: "refresh-secret", expires: 3600 };
  const ciphertext = JSON.stringify(crypto.encryptRefreshHandoff(id, pair));
  assert.equal(await client.publishRefreshHandoff(leases.find(Boolean), ciphertext), true);
  const read = await client.readRefreshHandoff(id);
  assert.ok(!read.includes("refresh-secret"));
  assert.deepEqual(crypto.decryptRefreshHandoff(id, JSON.parse(read)), pair);
});
test("expired lease owner cannot publish or release replacement", async () => {
  const db = redis(); globalThis.fetch = db.fetch;
  const id = crypto.refreshIdentity("expiry-token");
  const old = await client.acquireRefreshLease(id);
  db.advance(8001);
  const next = await client.acquireRefreshLease(id);
  assert.ok(next && next.owner !== old.owner);
  assert.equal(await client.publishRefreshHandoff(old, "encrypted"), false);
  assert.equal(await client.releaseRefreshLease(old), false);
  assert.equal(await client.publishRefreshHandoff(next, "encrypted"), true);
  assert.equal(await client.readRefreshHandoff(id), "encrypted");
  db.advance(15001);
  assert.equal(await client.readRefreshHandoff(id), null);
});
test("Redis outage fails closed", async () => {
  const db = redis(); globalThis.fetch = db.fetch; db.outage(true);
  await assert.rejects(client.acquireRefreshLease(crypto.refreshIdentity("outage-token")));
});
test("ciphertext tampering and wrong identity fail", () => {
  const id = crypto.refreshIdentity("token");
  const envelope = crypto.encryptRefreshHandoff(id, { access: "a", refresh: "r", expires: 3600 });
  assert.equal(crypto.decryptRefreshHandoff("a".repeat(64), envelope), null);
  assert.equal(crypto.decryptRefreshHandoff(id, { ...envelope, tag: "a".repeat(22) }), null);
});
test.after(() => {
  globalThis.fetch = previous.fetch;
  for (const [key, value] of [["UPSTASH_REDIS_REST_URL", previous.url], ["UPSTASH_REDIS_REST_TOKEN", previous.token], ["SESSION_REFRESH_IDENTITY_KEY", previous.identity], ["SESSION_REFRESH_HANDOFF_KEY", previous.handoff]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
