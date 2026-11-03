import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/lib/cards/schema.ts", import.meta.url), "utf8");

test("lookup is read-only and published-only", () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /searchParams\.set\("status", "eq\.published"\)/);
  assert.match(route, /row\.status !== "published"/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
});

test("input validation and search-key normalization are present", () => {
  assert.match(route, /term\.trim\(\)/);
  assert.match(route, /term\.length > 250/);
  assert.match(route, /source === target/);
  assert.match(route, /makeCardSearchKey\(term,/);
  assert.match(schema, /normalize\("NFKC"\)/);
});

test("database failure cannot be confused with a missing card", () => {
  assert.match(route, /status: 503/);
  assert.match(route, /status: 400/);
  assert.match(route, /found: Boolean\(match\)/);
  assert.match(route, /let match: Record<string, unknown> \| undefined = row/);
  assert.match(route, /AbortSignal\.timeout\(8000\)/);
});

test("database credentials are server-side and requests are not cached", () => {
  assert.match(route, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(route, /origin\.protocol !== "https:"/);
  assert.match(route, /cache: "no-store"/);
});
