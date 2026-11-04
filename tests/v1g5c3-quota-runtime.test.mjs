import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the actual production quota module with a deterministic in-memory
// Redis REST protocol simulator. No network, secrets, or Gemini calls.
const source = readFileSync(new URL("../src/lib/cards/generation-budget.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reserveGenerationAttempt } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const originalFetch = globalThis.fetch;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const reply = (status, result) => new Response(JSON.stringify({ result }), { status, headers: { "content-type": "application/json" } });
function simulator() {
  const values = new Map();
  const calls = [];
  // JS synchronous callback models Redis's single-threaded EVAL execution.
  const fetch = async (_url, options) => {
    const args = JSON.parse(options.body);
    calls.push(args);
    assert.equal(args[0], "EVAL");
    assert.equal(args[2], "4");
    const keys = args.slice(3, 7);
    const [globalDay, globalMinute, actorDay, actorMinute] = keys.map(k => values.get(k) || 0);
    const [globalDayLimit, globalMinuteLimit, , actorDayLimit, actorMinuteLimit] = args.slice(7).map(Number);
    if (globalDay >= globalDayLimit || globalMinute >= globalMinuteLimit ||
        actorDay >= actorDayLimit || actorMinute >= actorMinuteLimit) return reply(200, 0);
    for (const key of keys) values.set(key, (values.get(key) || 0) + 1);
    return reply(200, 1);
  };
  return { fetch, calls, values };
}
async function withEnv(run) {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-test-token";
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
}
test("runtime: atomic reservations isolate actor counters and share global counters", async () => withEnv(async () => {
  const mock = simulator();
  globalThis.fetch = mock.fetch;
  const a = "user_alpha_12345", b = "user_bravo_12345";
  assert.equal(await reserveGenerationAttempt(a), "allowed");
  assert.equal(await reserveGenerationAttempt(a), "limited"); // actor minute = 1
  assert.equal(await reserveGenerationAttempt(b), "allowed");
  assert.equal(await reserveGenerationAttempt("user_charlie_12345"), "limited"); // global minute = 2
  assert.equal(mock.calls.length, 4);
  assert.notEqual(mock.calls[0][5], mock.calls[2][5]);
}));
test("runtime: parallel requests cannot exceed a shared minute limit", async () => withEnv(async () => {
  const mock = simulator();
  globalThis.fetch = mock.fetch;
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) =>
    reserveGenerationAttempt("actor_test_" + String(i).padStart(8, "0"))));
  assert.equal(results.filter(x => x === "allowed").length, 2);
  assert.equal(results.filter(x => x === "limited").length, 23);
}));
test("runtime: malformed actor, missing config, network failure and invalid Redis response fail closed", async () => withEnv(async () => {
  globalThis.fetch = async () => { throw new Error("network"); };
  assert.equal(await reserveGenerationAttempt("valid_actor_1234"), "unavailable");
  globalThis.fetch = async () => reply(200, "unexpected");
  assert.equal(await reserveGenerationAttempt("valid_actor_1234"), "unavailable");
  globalThis.fetch = async () => reply(503, 1);
  assert.equal(await reserveGenerationAttempt("valid_actor_1234"), "unavailable");
  assert.equal(await reserveGenerationAttempt("bad!"), "unavailable");
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(await reserveGenerationAttempt("valid_actor_1234"), "unavailable");
}));
