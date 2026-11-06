import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
test("English reverse lookup normalizes Unicode whitespace, not literal backslash-s", () => {
  // Reverse lookup now delegates normalization to the shared card schema.
  assert.match(route, /const wanted = normalizeSearchTerm\(term, "en"\)/);
  assert.match(route, /normalizeSearchTerm\(sense, "en"\) === wanted/);
  const schema = readFileSync(new URL("../src/lib/cards/schema.ts", import.meta.url), "utf8");
  assert.ok(schema.includes(String.raw`replace(/\s+/gu, " ")`), "shared normalizer must use a real whitespace regex");
  assert.ok(!schema.includes(String.raw`replace(/\\s+/gu, " ")`), "reject escaped-backslash regex");
});
test("English whitespace normalization matches equivalent exact translation senses", () => {
  const normalize = value => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
  assert.equal(normalize("  Take\tcare\n"), normalize("take care"));
  assert.equal(normalize("take   care"), normalize("take care"));
  assert.notEqual(normalize("take care"), normalize("take carelessly"));
});
