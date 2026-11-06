import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
test("English reverse lookup normalizes Unicode whitespace, not literal backslash-s", () => {
  const line = route.split("\n").find(line => line.includes("const wanted = term.normalize"));
  assert.ok(line, "reverse lookup normalization must exist");
  assert.ok(line.includes(String.raw`replace(/\s+/gu, " ")`), "use a real whitespace regex");
  assert.ok(!line.includes(String.raw`replace(/\\s+/gu, " ")`), "reject escaped-backslash regex");
});
test("English whitespace normalization matches equivalent exact translation senses", () => {
  const normalize = value => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
  assert.equal(normalize("  Take\tcare\n"), normalize("take care"));
  assert.equal(normalize("take   care"), normalize("take care"));
  assert.notEqual(normalize("take care"), normalize("take carelessly"));
});
