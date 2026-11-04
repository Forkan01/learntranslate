import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/verified-probe-burst.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reserveVerifiedProbeBurst } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const env = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
const original = Object.fromEntries(env.map(k => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
const actor = "a".repeat(64);
function setup() { process.env.UPSTASH_REDIS_REST_URL = "https://redis.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "test"; }
function restore() { globalThis.fetch = originalFetch; for (const k of env) if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; }
test("parallel same-account requests reserve at most one slot per bucket", async () => {
  setup(); let used = false;
  globalThis.fetch = async (_, opts) => {
    const args = JSON.parse(opts.body);
    assert.equal(args[0], "EVAL");
    assert.equal(args[2], "1");
    assert.ok(args[3].startsWith("lt:probe:burst:" + actor + ":"));
    const allowed = !used; used = true;
    return new Response(JSON.stringify({ result: allowed ? 1 : 0 }), { status: 200 });
  };
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveVerifiedProbeBurst(actor)));
    assert.equal(results.filter(x => x === "allowed").length, 1);
    assert.equal(results.filter(x => x === "limited").length, 19);
  } finally { restore(); }
});
test("malformed actor, missing Redis and transport failure deny", async () => {
  setup();
  try {
    assert.equal(await reserveVerifiedProbeBurst("spoofed"), "unavailable");
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    assert.equal(await reserveVerifiedProbeBurst(actor), "unavailable");
    setup();
    globalThis.fetch = async () => { throw Error("offline"); };
    assert.equal(await reserveVerifiedProbeBurst(actor), "unavailable");
  } finally { restore(); }
});
test("probe remains opt-in and derives actor from verified user", () => {
  const route = readFileSync(new URL("../src/app/api/cards/quota-probe/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes('process.env.ENABLE_VERIFIED_QUOTA_PROBE !== "true"'));
  assert.ok(route.indexOf("await verifyGenerationUser(access)") < route.indexOf("await reserveVerifiedProbeBurst(actorId)"));
  assert.ok(route.indexOf("await reserveVerifiedProbeBurst(actorId)") < route.indexOf("await reserveGenerationAttempt(actorId)"));
});
