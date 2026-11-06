import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
test("German noun fallback requires matching curated article", () => {
  assert.match(route, /const suppliedArticle = \/\^\(der\|die\|das\)\\s\+\/u\.exec\(wanted\)/);
  assert.match(route, /const bareSingularMatch = !suppliedArticle && wanted === singularBare/);
  assert.match(route, /wanted === article \+ " " \+ singularBare/);
  assert.doesNotMatch(route, /withoutArticle === singularBare \|\|/);
});
test("plural and published-only safeguards remain", () => {
  assert.match(route, /const pluralMatch = plural !== ""/);
  assert.match(route, /!suppliedArticle && withoutArticle === plural/);
  assert.match(route, /"status", "eq.published"/);
  assert.match(route, /"limit", "500"/);
});
