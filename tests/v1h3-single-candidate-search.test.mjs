import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
test("search sends original term once per card type", () => {
  assert.match(ui, /for \(const type of \["word", "sentence"\]\)/);
  assert.match(ui, /new URLSearchParams\(\{ term: term\.trim\(\), source, target, type \}\)/);
  assert.doesNotMatch(ui, /for \(const candidate of/);
  assert.match(ui, /if \(payload\.found && payload\.card\) \{ found = payload\.card; break; \}/);
});
test("server retains German noun article and plural matching", () => {
  assert.match(route, /const withoutArticle = wanted\.replace/);
  assert.match(route, /articleMatch/);
  assert.match(route, /wanted === plural/);
  assert.match(route, /"status", "eq\.published"/);
});
