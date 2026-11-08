import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
const budget = readFileSync(new URL("../src/lib/cards/generation-budget.ts", import.meta.url), "utf8");

test("private token is checked before actor label is accepted", () => {
  assert.ok(route.indexOf('authorization !== "Bearer " + expected') < route.indexOf('request.headers.get("x-lt-private-actor")'));
  assert.ok(route.indexOf('request.headers.get("x-lt-private-actor")') < route.indexOf("await reserveGenerationAttempt(actorId)"));
});

test("atomic Lua checks global and actor limits before increments", () => {
  assert.ok(budget.includes('const args = ["EVAL", GENERATION_QUOTA_LUA, "4"'));
  assert.ok(budget.includes("if day >= tonumber(ARGV[1]) then return 0 end"));
  assert.ok(budget.includes("if minute >= tonumber(ARGV[2]) then return 0 end"));
  assert.ok(budget.includes("if actorDay >= tonumber(ARGV[4]) then return 0 end"));
  assert.ok(budget.includes("if actorMinute >= tonumber(ARGV[5]) then return 0 end"));
  assert.ok(budget.indexOf("if actorMinute >= tonumber(ARGV[5])") < budget.indexOf("redis.call('INCR', KEYS[1])"));
  assert.ok(budget.includes('"lt:ai:actor:" + actorId + ":day:" + day'));
  assert.ok(budget.includes('"lt:ai:actor:" + actorId + ":minute:" + minute'));
  assert.ok(budget.includes('"10", "2", String(remainingDaySeconds), "3", "1"'));
});

test("untrusted/missing identity and Redis failure fail closed", () => {
  assert.ok(budget.includes('if (!/^[a-zA-Z0-9_-]{8,80}$/.test(actorId)) return "unavailable"'));
  assert.ok(budget.includes('if (!endpoint || !token) return "unavailable"'));
  assert.ok(route.includes('status: 400'));
});
