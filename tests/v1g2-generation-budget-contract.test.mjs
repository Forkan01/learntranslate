import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
const budget = readFileSync(new URL("../src/lib/cards/generation-budget.ts", import.meta.url), "utf8");
test("provider runs only after durable admission", () => {
  assert.ok(route.indexOf("await reserveGenerationAttempt()") < route.indexOf("await generateLearningCard("));
  assert.ok(route.includes('admission !== "allowed"'));
  assert.ok(route.includes("status: 429"));
});
test("missing Redis configuration fails closed", () => {
  assert.ok(budget.includes('if (!endpoint || !token) return "unavailable"'));
  assert.ok(budget.includes('response.ok) return "unavailable"'));
  assert.ok(!budget.includes("new Map("));
});
test("atomic Redis script enforces both global ceilings", () => {
  assert.ok(budget.includes('"EVAL", LUA, "2"'));
  assert.ok(budget.includes("if day >= tonumber(ARGV[1]) then return 0 end"));
  assert.ok(budget.includes("if minute >= tonumber(ARGV[2]) then return 0 end"));
  assert.ok(budget.includes('"10", "2"'));
});
test("no Redis token in browser variables", () => {
  assert.ok(!budget.includes("NEXT_PUBLIC_"));
});
