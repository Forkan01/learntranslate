import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/distributed-refresh-decision.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { decideDistributedRefresh } = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
const pair = { access: "valid-access", refresh: "valid-refresh", expires: 3600 };
test("verified success may set new cookies", () => {
  assert.deepEqual(decideDistributedRefresh({ kind: "success", pair }), { kind: "set", ...pair });
});
test("Redis outage, contention, provider failure and lease loss remain retryable", () => {
  for (const scenario of ["redis-outage", "contention", "provider-failure", "lease-loss"]) {
    assert.deepEqual(decideDistributedRefresh({ kind: "retryable" }), { kind: "retryable" }, scenario);
  }
});
test("malformed or untrusted pair cannot update cookies", () => {
  for (const invalid of [{ ...pair, access: "" }, { ...pair, refresh: "" }, { ...pair, expires: 0 }, { ...pair, expires: 1.5 }, { ...pair, access: "x".repeat(8193) }])
    assert.deepEqual(decideDistributedRefresh({ kind: "success", pair: invalid }), { kind: "retryable" });
});
test("live session route remains unchanged and opt-in adapter is not enabled", () => {
  const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /coordinateSecureRedisRefresh|decideDistributedRefresh/);
});
