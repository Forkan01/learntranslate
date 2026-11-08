import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validDraftId, validDraftVersion, parseDraftChanges, draftReadUrl,
  draftPatchUrl, confirmDraftPatch, nextDraftVersion,
} from "../src/lib/admin/edit-draft.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../src/app/api/admin/drafts/[id]/route.ts");
const storage = read("../src/lib/admin/server-edit-draft.ts");
const ui = read("../src/app/admin/edit/[id]/page.tsx");
const dashboard = read("../src/app/admin/page.tsx");
const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-11-08T19:56:34.480116+00:00";
const stored = (type = "sentence") => ({
  id, status: "draft", type,
  sourceLanguage: "de", targetLanguage: "en",
  term: type === "word" ? "die Absicht" : "Es kommt mir bekannt vor.",
  updatedAt: version,
  content: type === "word" ? {
    schemaVersion: 1, type, sourceLanguage: "de", targetLanguage: "en",
    term: "die Absicht", translation: "intention",
    grammar: { partOfSpeech: "noun", article: "die", plural: "Absichten" },
    examples: Array.from({length: 5}, () => ({source:"", translation:""})),
    pronunciation: "/ˈapzɪçt/",
  } : {
    schemaVersion: 1, type, sourceLanguage: "de", targetLanguage: "en",
    term: "Es kommt mir bekannt vor.", translation: "It seems familiar.",
    naturalMeaning: "Something seems familiar.", grammarBreakdown: [],
    alternatives: [{text:"Das kenne ich.", translation:"I know that."}],
  },
});
const body = type => type === "word" ? ({
  expectedUpdatedAt: version, fields: {
    translation: "intention / purpose",
    grammar: {partOfSpeech:"noun", article:"die", plural:"Absichten"},
    examples: Array.from({length:5}, (_,i) => ({source:"Beispiel "+i,translation:"Example "+i})),
    usageNotes:["Common word"],
  },
}) : ({
  expectedUpdatedAt: version, fields: {
    translation: "That seems familiar to me.",
    naturalMeaning: "Recognizing something from the past.",
    grammarBreakdown:["vorkommen is separable."],
  },
});

test("only well-formed UUID and precise API versions are accepted", () => {
  assert.equal(validDraftId(id), true);
  for (const bad of ["x", "11111111-1111-1111-1111-111111111111", "x,or.status.eq.published"])
    assert.equal(validDraftId(bad), false);
  assert.equal(validDraftVersion(version), true);
  for (const bad of ["now", "2026-11-08", "eq.draft", "", "x".repeat(200)])
    assert.equal(validDraftVersion(bad), false);
});

test("sentence edits update teaching fields but preserve curated extra content", () => {
  const original = stored();
  const edited = parseDraftChanges(body(), original);
  assert.ok(edited);
  assert.equal(edited.expectedUpdatedAt, version);
  assert.equal(edited.content.translation, "That seems familiar to me.");
  assert.deepEqual(edited.content.grammarBreakdown, ["vorkommen is separable."]);
  assert.deepEqual(edited.content.alternatives, original.content.alternatives);
  assert.equal(edited.content.term, original.term);
  assert.equal(edited.content.schemaVersion, 1);
});

test("word edits preserve pronunciation, five examples and clear old notes", () => {
  const original = stored("word");
  original.content.usageNotes = ["Old note"];
  const change = body("word");
  change.fields.usageNotes = [];
  const edited = parseDraftChanges(change, original);
  assert.ok(edited);
  assert.equal(edited.content.pronunciation, "/ˈapzɪçt/");
  assert.deepEqual(edited.content.usageNotes, []);
  assert.equal(edited.content.examples.length, 5);
  assert.equal(edited.content.grammar.article, "die");
});

test("published, review and rejected cards cannot be edited", () => {
  for (const status of ["published", "review", "rejected"])
    assert.equal(parseDraftChanges(body(), {...stored(),status}), null);
});

test("identity, status, search key and other forged fields are rejected", () => {
  for (const key of ["id","status","term","sourceLanguage","type","search_key","targetLanguage","userId","updated_at"]) {
    const change = body();
    change.fields[key] = "forged";
    assert.equal(parseDraftChanges(change, stored()), null, key);
  }
  const badTop = {...body(), status:"published"};
  assert.equal(parseDraftChanges(badTop, stored()), null);
});

test("wrong type, bad examples and missing required fields fail closed", () => {
  const wrong = body("word");
  assert.equal(parseDraftChanges(wrong, stored()), null);
  const bad = body("word");
  bad.fields.examples[0].source = 7;
  assert.equal(parseDraftChanges(bad, stored("word")), null);
  const missing = body();
  delete missing.fields.naturalMeaning;
  assert.equal(parseDraftChanges(missing, stored()), null);
});

test("read and patch URLs stay pinned to a single draft and expected version", () => {
  const readUrl = draftReadUrl("https://demo.supabase.co", id);
  assert.equal(readUrl.pathname, "/rest/v1/cards");
  assert.equal(readUrl.searchParams.get("id"), "eq." + id);
  assert.equal(readUrl.searchParams.get("status"), "eq.draft");
  assert.equal(readUrl.searchParams.get("limit"), "1");
  const patch = draftPatchUrl("https://demo.supabase.co", id, version);
  assert.equal(patch.searchParams.get("id"), "eq." + id);
  assert.equal(patch.searchParams.get("status"), "eq.draft");
  assert.equal(patch.searchParams.get("updated_at"), "eq." + version);
  assert.equal(patch.searchParams.get("select"), "id,type,term,status,updated_at");
  assert.throws(() => draftPatchUrl("http://demo.supabase.co",id,version));
  assert.throws(() => draftReadUrl("https://demo.supabase.co", "bad"));
});

test("update confirmation rejects a conflict, other identity and unchanged version", () => {
  const original = stored();
  const newVersion = "2026-11-08T20:01:00.000Z";
  const valid = [{id,type:"sentence",term:original.term,status:"draft",updated_at:newVersion}];
  assert.deepEqual(confirmDraftPatch(valid,original),
    {id,status:"draft",updatedAt:newVersion});
  assert.equal(confirmDraftPatch([],original), null);
  assert.equal(confirmDraftPatch([{...valid[0],status:"published"}],original),null);
  assert.equal(confirmDraftPatch([{...valid[0],term:"different"}],original),null);
  assert.equal(confirmDraftPatch([{...valid[0],updated_at:version}],original),null);
});

test("next timestamp advances even if system clock is behind the stored row", () => {
  const newer = nextDraftVersion(version, 100);
  assert.ok(Date.parse(newer) > Date.parse(version));
  assert.notEqual(newer, version);
});

test("GET and PATCH verify server-side admin identity before any storage work", () => {
  assert.match(route,/export async function GET\(request: NextRequest, context: Context\)/);
  assert.match(route,/export async function PATCH\(request: NextRequest, context: Context\)/);
  assert.doesNotMatch(route,/export async function (POST|PUT|DELETE)/);
  assert.match(route,/accessFailure\(await authorized\(request\)\)/);
  assert.match(route,/allowSameOriginWrite\(request\)/);
  assert.match(route,/readBoundedJson\(request, 16384\)/);
  assert.match(route,/validDraftId\(id\)/);
  assert.match(route,/DraftEditConflict/);
});

test("server only loads draft and conditionally patches content/timestamp", () => {
  assert.match(storage,/import "server-only"/);
  assert.match(storage,/ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true"/);
  assert.match(storage,/ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT !== "true"/);
  assert.match(storage,/process.env.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(storage,/method: "PATCH"/);
  assert.match(storage,/JSON.stringify\(\{ content: changes.content, updated_at \}\)/);
  assert.match(storage,/updated_at/);
  assert.match(storage,/cache: "no-store"/);
  assert.doesNotMatch(storage,/method: "(POST|PUT|DELETE)"/);
});

test("dashboard links to editor only for drafts and editor is preview-only until saved", () => {
  assert.match(dashboard,/selected.status === "draft"/);
  assert.match(dashboard,/\/admin\/edit\//);
  assert.match(ui,/fetch\("\/api\/admin\/drafts\/"/);
  assert.match(ui,/method: "PATCH"/);
  assert.match(ui,/Save draft changes/);
  assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_ADMIN_ROLE/);
});

test("runtime route parameters are isolated inside Suspense for Next.js prerendering", () => {
  assert.match(ui, /import \{ Suspense, useEffect, useRef, useState, type FormEvent \} from "react"/);
  assert.match(ui, /function EditAdminDraftContent\(\)/);
  assert.match(ui, /const params = useParams<\{ id: string \}>\(\)/);
  assert.match(ui, /export default function EditAdminDraftPage\(\)/);
  assert.match(ui, /<Suspense fallback=/);
  assert.match(ui, /<EditAdminDraftContent \/>/);
  assert.match(dashboard, /Read-only preview/);
});
