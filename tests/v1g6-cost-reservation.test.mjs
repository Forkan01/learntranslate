import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/generation-cost-budget.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reserveEstimatedGenerationCost } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
const env = ["CARD_GENERATION_MAX_ESTIMATED_MICRO_USD", "CARD_GENERATION_DAILY_CAP_MICRO_USD", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
const original = Object.fromEntries(env.map(k => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
function setup() {
  process.env.CARD_GENERATION_MAX_ESTIMATED_MICRO_USD = "4000";
  process.env.CARD_GENERATION_DAILY_CAP_MICRO_USD = "10000";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
}
function restore() {
  globalThis.fetch = originalFetch;
  for (const k of env) if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k];
}
test("estimated spending reservation uses one atomic Redis EVAL and caps concurrent calls", async () => {
  setup();
  let reserved = 0;
  globalThis.fetch = async (_, opts) => {
    const args = JSON.parse(opts.body);
    assert.equal(args[0], "EVAL");
    assert.equal(args[2], "1");
    const amount = Number(args[4]), cap = Number(args[5]);
    const result = reserved + amount > cap ? 0 : 1;
    if (result) reserved += amount;
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveEstimatedGenerationCost()));
    assert.equal(results.filter(x => x === "allowed").length, 2);
    assert.equal(results.filter(x => x === "limited").length, 18);
    assert.equal(reserved, 8000);
  } finally { restore(); }
});
test("missing and invalid configuration or network errors fail closed", async () => {
  setup();
  try {
    delete process.env.CARD_GENERATION_DAILY_CAP_MICRO_USD;
    assert.equal(await reserveEstimatedGenerationCost(), "unavailable");
    process.env.CARD_GENERATION_DAILY_CAP_MICRO_USD = "10000";
    process.env.CARD_GENERATION_MAX_ESTIMATED_MICRO_USD = "999999999";
    assert.equal(await reserveEstimatedGenerationCost(), "unavailable");
    process.env.CARD_GENERATION_MAX_ESTIMATED_MICRO_USD = "4000";
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await reserveEstimatedGenerationCost(), "unavailable");
  } finally { restore(); }
});
test("private route reserves spending before provider and public generation remains off", () => {
  assert.ok(route.indexOf("await reserveEstimatedGenerationCost()") < route.indexOf("await generateLearningCard("));
  assert.ok(route.includes('process.env.ENABLE_CARD_GENERATION !== "true"'));
  assert.ok(route.includes('request.headers.has("origin")'));
});
