import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  splitBulkPairs, parseBulkDraftRequest, makeBulkDraftUrl, confirmBulkDraftInsert,
} from "../src/lib/admin/bulk-drafts.mjs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const route = source("../src/app/api/admin/bulk-drafts/route.ts");
const server = source("../src/lib/admin/server-bulk-drafts.ts");
const ui = source("../src/app/admin/bulk/page.tsx");
const dashboard = source("../src/app/admin/page.tsx");
const input = (pairs, type = "word", sourceLanguage = "de") => ({
  type, sourceLanguage, pairs,
});
const one = "der Bahnhof | train station";
const two = "verpassen | to miss";
const uuid = "11111111-1111-4111-8111-111111111111";

test("mobile-friendly pipe and spreadsheet tab separators both work", () => {
  assert.deepEqual(splitBulkPairs("der Bahnhof | train station\r\nverpassen\tto miss"), [
    { term: "der Bahnhof", translation: "train station" },
    { term: "verpassen", translation: "to miss" },
  ]);
  assert.deepEqual(splitBulkPairs("\n"+one+"\n\n"+two+"\n").map(x=>x.term),
    ["der Bahnhof","verpassen"]);
});

test("two German word pairs become exactly two private drafts", () => {
  const rows = parseBulkDraftRequest(input(one+"\n"+two));
  assert.equal(rows?.length, 2);
  for (const row of rows) {
    assert.equal(row.status,"draft");
    assert.equal(row.type,"word");
    assert.equal(row.source_language,"de");
    assert.equal(row.target_language,"en");
    assert.equal(row.content.schemaVersion,1);
    assert.equal(row.content.grammar.partOfSpeech,"other");
    assert.equal(row.content.examples.length,5);
    assert.ok(row.content.examples.every(x=>x.source===""&&x.translation===""));
  }
  assert.equal(rows[0].term,"der Bahnhof");
  assert.equal(rows[0].search_key,"word:de:en:der bahnhof");
});

test("sentence batches leave natural meaning empty for later review", () => {
  const rows = parseBulkDraftRequest(input("Das kommt darauf an. | It depends.","sentence"));
  assert.equal(rows?.length,1);
  assert.equal(rows[0].content.translation,"It depends.");
  assert.equal(rows[0].content.naturalMeaning,"");
  assert.deepEqual(rows[0].content.grammarBreakdown,[]);
  assert.equal(rows[0].status,"draft");
});

test("English to German direction cannot be confused with German to English", () => {
  const rows = parseBulkDraftRequest(input("miss | verpassen","word","en"));
  assert.equal(rows?.length,1);
  assert.equal(rows[0].source_language,"en");
  assert.equal(rows[0].target_language,"de");
  assert.equal(rows[0].search_key,"word:en:de:miss");
});

test("normalization catches duplicate search keys before database access", () => {
  const result = parseBulkDraftRequest(input(
    "  der  Bahnhof  | train station\nder Bahnhof | station"));
  assert.equal(result,null);
  assert.equal(parseBulkDraftRequest(input("Sogar | even\nsogar | even too")),null);
});

test("bulk parse strictly rejects forged publish, identity and schema fields", () => {
  for (const field of ["status","id","search_key","categoryId","userId",
    "created_at","updated_at","content"]) {
    const value={...input(one),[field]:"published"};
    assert.equal(parseBulkDraftRequest(value),null,field);
  }
  assert.equal(parseBulkDraftRequest({type:"word",pairs:one}),null);
  assert.equal(parseBulkDraftRequest({...input(one),sourceLanguage:"fr"}),null);
  assert.equal(parseBulkDraftRequest({...input(one),type:"paragraph"}),null);
  assert.equal(parseBulkDraftRequest([input(one)]),null);
});

test("reject nonempty batches with missing translations or malformed separators", () => {
  for(const raw of [
    "miss", "miss | ", " | missing", "a | b | c", "a\tb\tc",
    "a | b\nincorrect", " ", "\n", 12,
  ]) assert.equal(parseBulkDraftRequest(input(raw)),null,JSON.stringify(raw));
});

test("reject more than 20 cards and outsize input", () => {
  const max = Array.from({length:20},(_,i)=>"wort"+i+" | translation"+i).join("\n");
  assert.equal(parseBulkDraftRequest(input(max))?.length,20);
  assert.equal(parseBulkDraftRequest(input(max+"\nextra | extra")),null);
  assert.equal(parseBulkDraftRequest(input("a | "+ "x".repeat(501))),null);
  assert.equal(parseBulkDraftRequest(input("x".repeat(16001))),null);
});

test("bulk URL cannot downgrade HTTPS or change the table", () => {
  const u=makeBulkDraftUrl("https://project.supabase.co");
  assert.equal(u.pathname,"/rest/v1/cards");
  assert.equal(u.searchParams.get("select"),"id,type,term,status,search_key,created_at");
  for (const base of [
    "http://project.supabase.co", "https://name:pass@project.supabase.co",
    "https://project.supabase.co/not-root",
    "https://project.supabase.co/?token=unsafe",
  ]) assert.throws(()=>makeBulkDraftUrl(base));
});

test("batch acknowledgement requires all and only the original new draft keys", () => {
  const expected=parseBulkDraftRequest(input(one+"\n"+two));
  const rows=expected.map((e,i)=>({
    id: i === 0 ? uuid : "22222222-2222-4222-8222-222222222222",
    type:e.type,term:e.term,status:"draft",search_key:e.search_key,
    created_at:"2026-11-10T00:00:00Z",
  }));
  assert.deepEqual(confirmBulkDraftInsert([...rows].reverse(),expected),{count:2});
  assert.equal(confirmBulkDraftInsert(rows.slice(0,1),expected),null);
  assert.equal(confirmBulkDraftInsert([...rows,rows[0]],expected),null);
  assert.equal(confirmBulkDraftInsert([{...rows[0],status:"published"},rows[1]],expected),null);
  assert.equal(confirmBulkDraftInsert([{...rows[0],search_key:"forged"},rows[1]],expected),null);
  assert.equal(confirmBulkDraftInsert([{...rows[0],id:rows[1].id},rows[1]],expected),null);
});

test("private endpoint verifies admin and origin before bounded JSON", () => {
  assert.match(route,/await resolveAdminAccess\(request\)/);
  assert.match(route,/allowSameOriginWrite\(request\)/);
  assert.match(route,/readBoundedJson\(request, 20000\)/);
  assert.match(route,/parseBulkDraftRequest\(body\)/);
  assert.match(route,/insertBulkAdminDrafts\(rows\)/);
  assert.match(route,/ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE !== "true"/);
  assert.doesNotMatch(route,/export async function (PUT|PATCH|DELETE|GET)/);
  const auth=route.indexOf("await resolveAdminAccess(request)");
  const origin=route.indexOf("allowSameOriginWrite(request)");
  const flag=route.indexOf('ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE !== "true"');
  const json=route.indexOf("readBoundedJson(request, 20000)");
  const sql=route.indexOf("insertBulkAdminDrafts(rows)");
  assert.ok(auth<origin && origin<flag && flag<json && json<sql);
});

test("server inserts a whole array only with two default-off flags", () => {
  assert.match(server,/import "server-only"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE !== "true"/);
  assert.match(server,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(server,/JSON.stringify\(rows\)/);
  assert.match(server,/method: "POST"/);
  assert.match(server,/Prefer: "return=representation"/);
  assert.doesNotMatch(server,/method: "(PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(server,/upsert|on_conflict|resolution=merge-duplicates/i);
});

test("UI previews cards, allows mobile input, and links from admin", () => {
  assert.match(dashboard,/href="\/admin\/bulk"/);
  assert.match(ui,/parseBulkDraftRequest/);
  assert.match(ui,/Create.*private drafts/);
  assert.match(ui,/one per line/);
  assert.match(ui,/fetch\("\/api\/admin\/bulk-drafts"/);
  assert.match(ui,/\/api\/admin\/access/);
  assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY/);
});

test("TypeScript declaration includes strict parser output", () => {
  const types=source("../src/lib/admin/bulk-drafts.d.mts");
  assert.match(types,/AdminDraftRow\[\] \| null/);
  assert.match(types,/parseBulkDraftRequest\(input: unknown\)/);
});
