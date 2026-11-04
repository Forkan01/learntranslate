import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const probe = readFileSync(new URL("../src/app/api/cards/quota-probe/route.ts", import.meta.url), "utf8");
const budget = readFileSync(new URL("../src/lib/cards/generation-budget.ts", import.meta.url), "utf8");
const generate = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
test("quota probe is off by default and requires same-origin browser request", () => {
  assert.ok(probe.includes('process.env.ENABLE_VERIFIED_QUOTA_PROBE !== "true"'));
  assert.ok(probe.includes('request.headers.get("origin")'));
  assert.ok(probe.includes('new URL(origin).origin !== new URL(expected).origin'));
});
test("verified identity is derived from HttpOnly session and hashed server-side", () => {
  assert.ok(probe.includes('request.cookies.get("lt_auth_access")'));
  assert.ok(probe.includes("await verifyGenerationUser(access)"));
  assert.ok(probe.includes('createHash("sha256")'));
  assert.ok(probe.includes('reserveGenerationAttempt(actorId)'));
  assert.ok(!probe.includes("x-lt-private-actor"));
});
test("probe does not invoke AI or change private generation route", () => {
  assert.ok(probe.includes("generated: false"));
  assert.ok(!probe.includes("generateLearningCard"));
  assert.ok(generate.includes('authorization !== "Bearer " + expected'));
  assert.ok(budget.includes('"EVAL", LUA, "4"'));
});
