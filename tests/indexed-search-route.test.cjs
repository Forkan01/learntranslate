// V1-H.36: regression checks for the opt-in indexed search API.
// Run: node --test tests/indexed-search-route.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const route = fs.readFileSync(path.join(root, "src/app/api/cards/search/route.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "src/lib/cards/schema.ts"), "utf8");
const compiledSchema = ts.transpileModule(schema, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const schemaModule = { exports: {} };
vm.runInNewContext(compiledSchema, { module: schemaModule, exports: schemaModule.exports, require }, { filename: "schema.js" });
const compiledRoute = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const cards = [
  { id: "1", search_key: "word:de:en:antrag", status: "published", content: { type: "word", sourceLanguage: "de", targetLanguage: "en", term: "Antrag", translation: "application; formal request", grammar: { partOfSpeech: "noun", article: "der", plural: "Anträge" } } },
  { id: "2", search_key: "word:de:en:katze", status: "published", content: { type: "word", sourceLanguage: "de", targetLanguage: "en", term: "Katze", translation: "cat", grammar: { partOfSpeech: "noun", article: "die", plural: "Katzen" } } },
];
function loadHandler({ enabled, rpcMode = "normal" }) {
  const calls = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key", CARD_INDEXED_SEARCH_ENABLED: enabled ? "true" : "false" };
  const fakeFetch = async (url, options = {}) => {
    const u = new URL(String(url));
    calls.push(u.pathname);
    if (u.pathname.includes("/rpc/")) {
      if (rpcMode === "error") return { ok: false, status: 500 };
      const body = JSON.parse(options.body);
      let found = [];
      if (body.p_source === "en") found = cards.filter(c => c.content.translation.split(";").some(t => t.trim() === body.p_term));
      else found = cards.filter(c => [c.content.term, c.content.grammar.article + " " + c.content.term, c.content.grammar.plural].includes(body.p_term));
      if (rpcMode === "unpublished") found = [{ ...cards[0], status: "draft" }];
      return { ok: true, json: async () => found };
    }
    const searchKey = u.searchParams.get("search_key");
    const data = searchKey ? cards.filter(c => c.search_key === searchKey.slice(3)) : cards.filter(c => (!u.searchParams.get("type") || c.content.type === u.searchParams.get("type")));
    return { ok: true, json: async () => data };
  };
  const mod = { exports: {} };
  const context = { module: mod, exports: mod.exports, require: name => {
    if (name === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
    if (name === "@/lib/cards/schema") return schemaModule.exports;
    throw Error("Unexpected module " + name);
  }, process: { env }, fetch: fakeFetch, URL, AbortSignal, console };
  vm.runInNewContext(compiledRoute, context, { filename: "route.js" });
  return { GET: mod.exports.GET, calls };
}
async function search(handler, term, source = "de") {
  const url = new URL("https://learntranslate.test/api/cards/search");
  url.searchParams.set("term", term); url.searchParams.set("source", source); url.searchParams.set("target", source === "de" ? "en" : "de"); url.searchParams.set("type", "word");
  return handler.GET({ url: url.toString() });
}
for (const enabled of [false, true]) {
  test("indexed=" + enabled + ": exact, article, plural, reverse and invalid article", async () => {
    const h = loadHandler({ enabled });
    for (const [term, source, expected] of [
      ["Antrag", "de", true], ["der Antrag", "de", true], ["Anträge", "de", true],
      ["application", "en", true], ["formal request", "en", true],
      ["die Antrag", "de", false], ["der Katze", "de", false], ["nonexistent", "en", false],
    ]) {
      const response = await search(h, term, source);
      assert.equal(response.status, 200, term);
      assert.equal(response.body.found, expected, term);
    }
    assert.equal(h.calls.some(p => p.includes("/rpc/")), enabled);
  });
}
test("RPC failure falls back to published scan", async () => {
  const h = loadHandler({ enabled: true, rpcMode: "error" });
  assert.equal((await search(h, "application", "en")).body.found, true);
  assert.ok(h.calls.some(p => p.includes("/rpc/")));
});
test("RPC unpublished result is rejected and fallback still works", async () => {
  const h = loadHandler({ enabled: true, rpcMode: "unpublished" });
  assert.equal((await search(h, "formal request", "en")).body.found, true);
});
