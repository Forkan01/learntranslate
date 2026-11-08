import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");

test("German form fallback only uses published word cards", () => {
  assert.match(source, /source === "de" && target === "en" && type === "word"/);
  assert.match(source, /germanUrl.searchParams.set\("status", "eq.published"\)/);
  assert.match(source, /germanUrl.searchParams.set\("limit", "500"\)/);
});

test("article and plural matching use explicit grammar data", () => {
  assert.match(source, /const article = noun\?\.article;/);
  assert.match(source, /const suppliedArticle = /);
  assert.match(source, /const bareSingularMatch = !suppliedArticle && wanted === singularBare;/);
  assert.match(source, /const plural = noun\?\.partOfSpeech === "noun" && typeof noun\.plural === "string"/);
  assert.match(source, /normalizeSearchTerm\(noun\.plural, "de"\)/);
  assert.match(source, /const pluralMatch = plural !== ""/);
  assert.match(source, /withoutArticle === plural/);
});
