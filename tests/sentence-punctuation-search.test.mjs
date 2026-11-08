import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/lib/cards/sentence-lookup.ts", import.meta.url), "utf8");
test("sentence lookup preserves internal text and strips only terminal punctuation", () => {
  assert.match(source, /normalizeSearchTerm/);
  assert.ok(source.includes("replace(/[.!?。！？]+$/u"));
  assert.match(source, /wanted\.length > 0/);
});
test("sentence fallback is limited to published sentence cards", () => {
  const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!match && type === "sentence"\)/);
  assert.match(route, /sentenceLookupMatches\(term, content\.term/);
  assert.match(route, /candidate\.status !== "published"/);
});
