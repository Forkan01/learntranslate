import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/redis-connectivity.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { checkRedisConnectivity } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const oldFetch = globalThis.fetch;
const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
test("missing credentials fail closed", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(await checkRedisConnectivity(), false);
});
test("valid credentials send only PING and accept PONG", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://sample.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-test-token";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://sample.upstash.io/");
    assert.equal(init.body, '["PING"]');
    assert.equal(init.headers.Authorization, "Bearer fake-test-token");
    return { ok: true, json: async () => ({ result: "PONG" }) };
  };
  assert.equal(await checkRedisConnectivity(), true);
});
test("invalid URL, provider errors and malformed responses fail closed", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "http://sample.upstash.io";
  assert.equal(await checkRedisConnectivity(), false);
  process.env.UPSTASH_REDIS_REST_URL = "https://sample.upstash.io";
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await checkRedisConnectivity(), false);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: "WRONG" }) });
  assert.equal(await checkRedisConnectivity(), false);
});
test("diagnostic requires explicit enablement and private authorization", () => {
  const route = readFileSync(new URL("../src/app/api/private/redis-check/route.ts", import.meta.url), "utf8");
  assert.match(route, /ENABLE_PRIVATE_REDIS_DIAGNOSTIC/);
  assert.match(route, /CARD_GENERATION_ADMIN_TOKEN/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /request\.headers\.has\("origin"\)/);
});
test.after(() => {
  globalThis.fetch = oldFetch;
  if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
  if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
});
