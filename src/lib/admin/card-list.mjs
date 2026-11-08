/**
 * Pure, bounded admin review-list query + result validation.
 * Server-only credentials and network calls belong in server-card-list.ts.
 */
const STATUSES = new Set(["all", "draft", "review", "published", "rejected"]);
const TYPES = new Set(["all", "word", "sentence"]);
const CARD_STATUSES = new Set(["draft", "review", "published", "rejected"]);
const LANGUAGES = new Set(["de", "en"]);
const PAGE_SIZE = 20;
const MAX_OFFSET = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAdminListQuery(params) {
  const allowed = new Set(["status", "type", "offset"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }
  const status = params.get("status") ?? "review";
  const type = params.get("type") ?? "all";
  const rawOffset = params.get("offset") ?? "0";
  if (!STATUSES.has(status) || !TYPES.has(type) || !/^(0|[1-9][0-9]{0,4})$/.test(rawOffset)) return null;
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(offset) || offset > MAX_OFFSET) return null;
  return { status, type, offset };
}

export function makeAdminCardsUrl(base, query) {
  if (!query || !STATUSES.has(query.status) || !TYPES.has(query.type) ||
      !Number.isSafeInteger(query.offset) || query.offset < 0 || query.offset > MAX_OFFSET)
    throw new Error("Invalid admin list query");
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/")
    throw new Error("Invalid database URL");
  const url = new URL("/rest/v1/cards", origin);
  url.searchParams.set("select", "id,type,source_language,target_language,term,status,content,created_at,updated_at");
  if (query.status !== "all") url.searchParams.set("status", "eq." + query.status);
  if (query.type !== "all") url.searchParams.set("type", "eq." + query.type);
  url.searchParams.set("order", "updated_at.desc,id.desc");
  url.searchParams.set("limit", String(PAGE_SIZE + 1));
  url.searchParams.set("offset", String(query.offset));
  return url;
}

export function validateAdminCardsPage(raw, query) {
  if (!Array.isArray(raw) || raw.length > PAGE_SIZE + 1) throw new Error("Invalid card list");
  const cards = raw.slice(0, PAGE_SIZE).map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        typeof row.id !== "string" || !UUID.test(row.id) ||
        !CARD_STATUSES.has(row.status) || !TYPES.has(row.type) || row.type === "all" ||
        !LANGUAGES.has(row.source_language) || !LANGUAGES.has(row.target_language) ||
        row.source_language === row.target_language ||
        typeof row.term !== "string" || row.term.length > 500 ||
        !row.term.trim() || !row.content || typeof row.content !== "object" ||
        Array.isArray(row.content) || row.content.type !== row.type ||
        row.content.sourceLanguage !== row.source_language ||
        row.content.targetLanguage !== row.target_language ||
        row.content.term !== row.term ||
        typeof row.content.translation !== "string" ||
        typeof row.created_at !== "string" || typeof row.updated_at !== "string")
      throw new Error("Invalid card row");
    if (query.status !== "all" && row.status !== query.status) throw new Error("Unexpected card status");
    if (query.type !== "all" && row.type !== query.type) throw new Error("Unexpected card type");
    return {
      id: row.id,
      type: row.type,
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      term: row.term,
      status: row.status,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
  return { cards, hasMore: raw.length > PAGE_SIZE, offset: query.offset };
}

export const ADMIN_LIST_PAGE_SIZE = PAGE_SIZE;
