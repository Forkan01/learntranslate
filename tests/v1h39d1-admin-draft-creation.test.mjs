import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNewAdminDraft, makeAdminDraftUrl, confirmDraftInsert } from
  "../src/lib/admin/create-draft.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../src/app/api/admin/drafts/route.ts");
const storage = read("../src/lib/admin/server-create-draft.ts");
const ui = read("../src/app/admin/new/page.tsx");
const admin = read("../src/app/admin/page.tsx");

const word = () => ({
  type: "word", sourceLanguage: "de", term: "  die  Entscheidung  ", translation: "decision",
  grammar: { partOfSpeech: "noun", article: "die", plural: "Entscheidungen" },
  examples: Array.from({ length: 5 }, (_, i) => ({
    source: "Beispiel " + i, translation: "Example " + i,
  })),
  usageNotes: ["An important word."],
});
const sentence = () => ({
  type: "sentence", sourceLanguage: "en", term: " It depends. ", translation: "Es kommt darauf an.",
  naturalMeaning: "Context matters.", grammarBreakdown: ["Common phrase."],
});

test("German word is normalized and forced into private draft status", () => {
  const parsed = parseNewAdminDraft(word());
  assert.ok(parsed);
  assert.equal(parsed.status, "draft");
  assert.equal(parsed.type, "word");
  assert.equal(parsed.content.type, "word");
  assert.equal(parsed.content.schemaVersion, 1);
  assert.equal(parsed.content.sourceLanguage, "de");
  assert.equal(parsed.content.targetLanguage, "en");
  assert.equal(parsed.search_key, "word:de:en:die entscheidung");
  assert.equal(parsed.content.grammar.article, "die");
  assert.equal(parsed.content.examples.length, 5);
  assert.deepEqual(parsed.content.usageNotes, ["An important word."]);
});

test("word draft may be unfinished, with exactly five safe example slots", () => {
  const raw = word();
  raw.translation = "";
  raw.grammar.plural = "";
  raw.examples = Array.from({ length: 5 }, () => ({ source: "", translation: "" }));
  const parsed = parseNewAdminDraft(raw);
  assert.ok(parsed);
  assert.equal(parsed.content.translation, "");
  assert.equal(parsed.content.examples.length, 5);
  assert.equal(parsed.status, "draft");
});

test("English sentence builds correct language direction and notes", () => {
  const parsed = parseNewAdminDraft(sentence());
  assert.ok(parsed);
  assert.equal(parsed.search_key, "sentence:en:de:it depends.");
  assert.equal(parsed.content.sourceLanguage, "en");
  assert.equal(parsed.content.targetLanguage, "de");
  assert.equal(parsed.content.naturalMeaning, "Context matters.");
  assert.deepEqual(parsed.content.grammarBreakdown, ["Common phrase."]);
  assert.equal(parsed.content.examples, undefined);
});

test("unsafe caller-supplied status, search key, identity and metadata are rejected", () => {
  for (const [key, value] of [
    ["status", "published"], ["search_key", "forged"], ["userId", "test"],
    ["id", "1"], ["created_at", "tomorrow"], ["targetLanguage", "en"],
  ]) assert.equal(parseNewAdminDraft({ ...word(), [key]: value }), null, key);
});

test("unknown types, fields, languages and invalid grammar reject", () => {
  for (const change of [
    w => { w.type = "other"; },
    w => { w.sourceLanguage = "fr"; },
    w => { w.term = ""; },
    w => { w.term = "x".repeat(501); },
    w => { w.translation = 100; },
    w => { w.grammar.partOfSpeech = "super-noun"; },
    w => { w.grammar.article = "den"; },
    w => { w.grammar.partOfSpeech = "verb"; },
    w => { w.examples = []; },
    w => { w.examples[1].source = 10; },
    w => { w.examples[1].admin = true; },
    w => { w.usageNotes = Array.from({length: 9}, () => "note"); },
  ]) {
    const w = word(); change(w);
    assert.equal(parseNewAdminDraft(w), null);
  }
});

test("sentence cannot smuggle word-only fields or oversized notes", () => {
  const a = sentence(); a.examples = [];
  assert.equal(parseNewAdminDraft(a), null);
  const b = sentence(); b.grammarBreakdown = ["x".repeat(601)];
  assert.equal(parseNewAdminDraft(b), null);
});

test("search key normalization matches the offline importer for internal whitespace", () => {
  const raw = word(); raw.term = "die\tEntscheidung\n";
  assert.equal(parseNewAdminDraft(raw).search_key, "word:de:en:die entscheidung");
  const fromUnicode = word(); fromUnicode.term = "ｄｉｅ  Entscheidung";
  assert.equal(parseNewAdminDraft(fromUnicode).search_key, "word:de:en:die entscheidung");
});

test("database draft URL is pinned to HTTPS cards and return projection", () => {
  const url = makeAdminDraftUrl("https://demo.supabase.co");
  assert.equal(url.pathname, "/rest/v1/cards");
  assert.equal(url.searchParams.get("select"), "id,type,term,status,created_at");
  for (const base of ["http://demo.supabase.co", "https://u@demo.supabase.co",
    "https://demo.supabase.co/x", "https://demo.supabase.co?x=1"])
    assert.throws(() => makeAdminDraftUrl(base));
});

test("database response must confirm a single draft matching the created card", () => {
  const row = parseNewAdminDraft(word());
  const actual = { id: "11111111-1111-4111-8111-111111111111", status: "draft",
    type: "word", term: row.term, created_at: "2026-11-08T19:00:00Z" };
  assert.deepEqual(confirmDraftInsert([actual], row),
    {id: actual.id, status: "draft", type: "word", term: row.term});
  for (const invalid of [
    [], [actual, actual], [{...actual, status:"published"}], [{...actual, term:"other"}],
    [{...actual, id:"bad"}], {data: actual},
  ]) assert.equal(confirmDraftInsert(invalid, row), null);
});

test("POST only after server administrator verification and same-origin gate", () => {
  assert.match(route, /export async function POST\(request: NextRequest\)/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  const idxAdmin = route.indexOf("await resolveAdminAccess(request)");
  const idxOrigin = route.indexOf("allowSameOriginWrite(request)");
  const idxFlag = route.indexOf('ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true"');
  const idxRead = route.indexOf("await readBoundedJson(request, 16384)");
  const idxParse = route.indexOf("parseNewAdminDraft(raw)");
  const idxInsert = route.indexOf("await insertAdminDraft(row)");
  assert.ok(idxAdmin >= 0 && idxAdmin < idxOrigin && idxOrigin < idxFlag &&
    idxFlag < idxRead && idxRead < idxParse && idxParse < idxInsert);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /Vary: "Cookie"/);
  assert.match(route, /AdminDraftAlreadyExists/);
});

test("storage is server-only, default-off, and INSERT-only without upsert/publish", () => {
  assert.match(storage, /import "server-only"/);
  assert.match(storage, /process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true"/);
  assert.match(storage, /process.env.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(storage, /method: "POST"/);
  assert.match(storage, /Prefer: "return=representation"/);
  assert.match(storage, /cache: "no-store"/);
  assert.match(storage, /AbortSignal.timeout\(8000\)/);
  assert.doesNotMatch(storage, /method: "(PATCH|PUT|DELETE)"|resolution=merge-duplicates/);
  assert.doesNotMatch(ui, /SUPABASE_SERVICE_ROLE_KEY|ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE/);
});

test("creation UI is separate from unchanged read-only dashboard", () => {
  assert.match(admin, /href="\/admin\/new"/);
  assert.match(ui, /fetch\("\/api\/admin\/access"/);
  assert.match(ui, /fetch\("\/api\/admin\/drafts"/);
  assert.match(ui, /credentials: "same-origin"/);
  assert.match(ui, /Saving…/);
  assert.match(ui, /five bilingual examples/i);
  assert.match(ui, /Save private draft/);
  assert.doesNotMatch(admin, /fetch\([^)]*,\s*\{\s*method:\s*"(POST|PUT|PATCH|DELETE)"/);
});

test("TypeScript contract retains narrow languages and draft-only status", () => {
  const types = read("../src/lib/admin/create-draft.d.mts");
  assert.match(types, /export type AdminDraftRow/);
  assert.match(types, /type: "word" \| "sentence"/);
  assert.match(types, /target_language: "de" \| "en"/);
  assert.match(types, /status: "draft"/);
  assert.match(types, /parseNewAdminDraft\(value: unknown\): AdminDraftRow \| null/);
});
