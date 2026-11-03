import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const identity = readFileSync(new URL("../src/lib/cards/verified-generation-user.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
test("identity is fetched from Supabase Auth, not caller-controlled headers", () => {
  assert.ok(identity.includes('new URL("/auth/v1/user", origin)'));
  assert.ok(identity.includes('Authorization: "Bearer " + accessToken'));
  assert.ok(identity.includes("if (!response.ok) return null"));
  assert.ok(!identity.includes("x-user-id"));
});
test("identity verification rejects anonymous, malformed and unavailable identities", () => {
  assert.ok(identity.includes("user.is_anonymous === true"));
  assert.ok(identity.includes('typeof user.id !== "string"'));
  assert.ok(identity.includes("catch { return null; }"));
  assert.ok(identity.includes('cache: "no-store"'));
});
test("public generation remains disabled and private-only", () => {
  assert.ok(route.includes('process.env.ENABLE_CARD_GENERATION !== "true"'));
  assert.ok(route.includes('authorization !== "Bearer " + expected'));
  assert.ok(route.includes('request.headers.has("origin")'));
});
