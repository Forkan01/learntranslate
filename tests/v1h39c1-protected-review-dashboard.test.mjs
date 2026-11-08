import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseAdminListQuery, makeAdminCardsUrl, validateAdminCardsPage, ADMIN_LIST_PAGE_SIZE,
} from "../src/lib/admin/card-list.mjs";

const route = readFileSync(new URL("../src/app/api/admin/cards/route.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("../src/lib/admin/server-card-list.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const query = { status: "review", type: "all", offset: 0 };
const base = "https://example.supabase.co";
const card = (n, status = "review") => ({
  id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
  type: "word", source_language: "de", target_language: "en",
  term: "die Entscheidung " + n, status,
  content: { schemaVersion: 1, type: "word", sourceLanguage: "de",
    targetLanguage: "en", term: "die Entscheidung " + n,
    translation: "decision", grammar: { partOfSpeech: "noun", article: "die", plural: "Entscheidungen" },
    examples: Array.from({ length: 5 }, () => ({source:"", translation:""})) },
  created_at: "2026-11-08T10:00:00Z", updated_at: "2026-11-08T10:00:00Z",
});

test("admin review filter defaults to review; pagination is bounded", () => {
  assert.deepEqual(parseAdminListQuery(new URLSearchParams()), query);
  assert.deepEqual(parseAdminListQuery(new URLSearchParams("status=all&type=sentence&offset=20")),
    {status:"all", type:"sentence", offset:20});
  assert.equal(ADMIN_LIST_PAGE_SIZE, 20);
  for (const input of [
    "status=review&status=published", "status=published%2Cor.id.eq.abc",
    "type=word&type=sentence", "type=unknown",
    "offset=-1", "offset=10001", "offset=1.5", "offset=1e3", "offset=01",
    "query=hello", "limit=999999",
  ]) {
    assert.equal(parseAdminListQuery(new URLSearchParams(input)), null, input);
  }
});

test("admin list URLs contain only allowlisted PostgREST filters and stable sort", () => {
  const url = makeAdminCardsUrl(base, query);
  assert.equal(url.origin, base);
  assert.equal(url.pathname, "/rest/v1/cards");
  assert.equal(url.searchParams.get("status"), "eq.review");
  assert.equal(url.searchParams.get("type"), null);
  assert.equal(url.searchParams.get("limit"), "21");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.get("order"), "updated_at.desc,id.desc");
  const all = makeAdminCardsUrl(base, {status:"all", type:"sentence", offset:20});
  assert.equal(all.searchParams.get("status"), null);
  assert.equal(all.searchParams.get("type"), "eq.sentence");
  assert.equal(all.searchParams.get("offset"), "20");
});

test("admin database URL cannot be downgraded, redirected or credential-injected", () => {
  for (const bad of ["http://example.supabase.co", "https://x@y.supabase.co",
    "https://example.supabase.co/other", "https://example.supabase.co?x=1",
    "https://example.supabase.co#x"]) {
    assert.throws(() => makeAdminCardsUrl(bad, query), /Invalid database URL/);
  }
  assert.throws(() => makeAdminCardsUrl(base, {status:"published;delete=all", type:"word", offset:0}));
  assert.throws(() => makeAdminCardsUrl(base, {status:"review", type:"word", offset:99999}));
});

test("admin cards are validated before returning, with a one-row pagination lookahead", () => {
  const result = validateAdminCardsPage([card(1), card(2)], query);
  assert.equal(result.cards.length, 2);
  assert.equal(result.hasMore, false);
  assert.equal(result.cards[0].term, "die Entscheidung 1");
  assert.equal(result.cards[0].status, "review");
  assert.equal(result.cards[0].sourceLanguage, "de");
  assert.equal(result.cards[0].content.translation, "decision");
  const page = validateAdminCardsPage(Array.from({length:21}, (_, i) => card(i+1)), query);
  assert.equal(page.cards.length, 20);
  assert.equal(page.hasMore, true);
  assert.throws(() => validateAdminCardsPage(Array.from({length:22}, (_, i) => card(i+1)), query));
});

test("unexpected or mismatched card rows are rejected rather than shown", () => {
  for (const mutate of [
    row => {row.status = "published";},
    row => {row.source_language = "en";},
    row => {row.content.term = "different";},
    row => {row.content.translation = null;},
    row => {row.id = "forged";},
    row => {row.type = "sentence";},
  ]) {
    const row = card(1);
    mutate(row);
    assert.throws(() => validateAdminCardsPage([row], query));
  }
  assert.throws(() => validateAdminCardsPage({}, query));
});

test("read-only route verifies administrator BEFORE parsing or database reads", () => {
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  const accessIndex = route.indexOf("await resolveAdminAccess(request)");
  const parseIndex = route.indexOf("parseAdminListQuery(request.nextUrl.searchParams)");
  const readIndex = route.indexOf("await listAdminCards(query)");
  assert.ok(accessIndex > 0 && parseIndex > accessIndex && readIndex > parseIndex);
  assert.match(route, /access === "unauthenticated"/);
  assert.match(route, /access !== "allowed"/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /Vary: "Cookie"/);
});

test("unpublished-card listing has extra server-only opt-in and uses no browser key", () => {
  assert.match(storage, /import "server-only"/);
  assert.match(storage, /ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true"/);
  assert.match(storage, /process.env.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(storage, /cache: "no-store"/);
  assert.match(storage, /AbortSignal.timeout\(8000\)/);
  assert.doesNotMatch(storage, /method: "(POST|PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(ui, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_LEARNTRANSLATE_ADMIN_USER_ID/);
  assert.match(ui, /fetch\("\/api\/admin\/access"/);
  assert.match(ui, /fetch\("\/api\/admin\/cards\?/);
  assert.match(ui, /state !== "authorized"/);
});

test("dashboard retains read-only listing, while transitions use a separate endpoint", () => {
  assert.match(ui, /value={filterStatus}/);
  assert.match(ui, /value={filterType}/);
  assert.match(ui, /setOffset\(offset \+ 20\)/);
  assert.match(ui, /Read-only preview/);
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
});
