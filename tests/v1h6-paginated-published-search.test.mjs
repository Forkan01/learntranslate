import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
test("both published fallbacks paginate instead of stopping at first 500 cards", () => {
  assert.match(route, /const PAGE_SIZE = 500/);
  assert.match(route, /const MAX_PAGES = 10/);
  assert.match(route, /"offset", String\(page \* PAGE_SIZE\)/);
  assert.match(route, /if \(rows\.length < PAGE_SIZE\) return undefined/);
  assert.match(route, /match = await findPublishedFallback\(reverseUrl, key, candidate =>/);
  assert.match(route, /match = await findPublishedFallback\(germanUrl, key, candidate =>/);
});
test("exhausted scan budget fails closed, rather than reporting a false miss", () => {
  assert.match(route, /throw new Error\("Fallback scan limit exceeded"\)/);
  assert.match(route, /"status", "eq\.published"/);
  assert.match(route, /"limit", "500"/);
  assert.match(route, /cache: "no-store"/);
});
