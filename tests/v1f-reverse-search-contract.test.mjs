import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route = readFileSync(new URL("../src/app/api/cards/search/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
test("reverse lookup is restricted to English queries and published German source cards", () => {
  assert.match(route, /source === "en" && target === "de"/);
  assert.match(route, /"source_language", "eq.de"/);
  assert.match(route, /"status", "eq.published"/);
  assert.match(route, /"type", "eq." \+ type/);
});
test("reverse lookup accepts exact senses, not partial substring matches", () => {
  assert.match(route, /translation\.split\(";"\)\.some/);
  assert.match(route, /=== wanted/);
  assert.doesNotMatch(route, /translation\.includes\(wanted\)/);
});
test("reverse lookup is read-only and bounded", () => {
  assert.match(route, /"limit", "500"/);
  // POST is used only for an opt-in, read-only RPC; card reads stay GET.\n  assert.match(route, /method: "POST"/);\n  assert.match(route, /lookup_published_card_indexed/);\n  assert.match(route, /CARD_INDEXED_SEARCH_ENABLED !== "true"/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});
test("pronunciation follows card language, not input language", () => {
  assert.match(ui, /result\?\.content\.sourceLanguage === "de"/);
});
