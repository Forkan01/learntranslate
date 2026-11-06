import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/lib/cards/schema.ts", import.meta.url), "utf8");
test("English reverse lookup uses the same normalization for query and each sense", () => {
  assert.match(route, /const wanted = normalizeSearchTerm\(term, "en"\)/);
  assert.match(route, /translation\.split\(";"\)\.some\(sense =>\s*normalizeSearchTerm\(sense, "en"\) === wanted/);
  assert.match(schema, /replace\(\/\\s\+\/gu, " "\)/);
});
test("reverse matching remains exact, typed and published-only", () => {
  assert.match(route, /content\.type !== type/);
  assert.match(route, /candidate\.status !== "published"/);
  assert.match(route, /"limit", "500"/);
  assert.doesNotMatch(route, /translation\.includes\(wanted\)/);
});
