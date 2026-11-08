import { parseNewAdminDraft } from "./create-draft.mjs";

/**
 * H.39D.2 pure validation + conditional PostgREST URL construction.
 * The browser may edit teaching content but never the card identity/status.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORD_KEYS = new Set(["translation", "grammar", "examples", "usageNotes"]);
const SENTENCE_KEYS = new Set(["translation", "naturalMeaning", "grammarBreakdown"]);
const VERSION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

const record = obj => obj !== null && typeof obj === "object" && !Array.isArray(obj);
export function validDraftId(id) {
  return typeof id === "string" && UUID.test(id);
}
export function validDraftVersion(version) {
  return typeof version === "string" && version.length <= 48 &&
    VERSION.test(version) && Number.isFinite(Date.parse(version));
}
export function parseDraftChanges(body, stored) {
  if (!record(body) || Object.keys(body).length !== 2 ||
      !Object.hasOwn(body, "expectedUpdatedAt") || !Object.hasOwn(body, "fields") ||
      !validDraftVersion(body.expectedUpdatedAt) ||
      !record(stored) || stored.status !== "draft" ||
      !validDraftId(stored.id) || !validDraftVersion(stored.updatedAt) ||
      !["word", "sentence"].includes(stored.type) ||
      !["de", "en"].includes(stored.sourceLanguage) || !record(stored.content) ||
      !record(body.fields)) return null;
  const keys = stored.type === "word" ? WORD_KEYS : SENTENCE_KEYS;
  if (Object.keys(body.fields).some(key => !keys.has(key)) ||
      (stored.type === "word"
        ? !["translation", "grammar", "examples", "usageNotes"].every(key => Object.hasOwn(body.fields, key))
        : !["translation", "naturalMeaning", "grammarBreakdown"].every(key => Object.hasOwn(body.fields, key))))
    return null;
  const normalized = parseNewAdminDraft({
    type: stored.type,
    sourceLanguage: stored.sourceLanguage,
    term: stored.term,
    ...body.fields,
  });
  if (!normalized || normalized.type !== stored.type ||
      normalized.source_language !== stored.sourceLanguage ||
      normalized.target_language !== stored.targetLanguage ||
      normalized.term !== stored.term) return null;
  return {
    expectedUpdatedAt: body.expectedUpdatedAt,
    content: { ...stored.content, ...normalized.content,
      ...(stored.type === "word" ? { usageNotes: normalized.content.usageNotes ?? [] } : {}) },
  };
}

function rootUrl(base) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search ||
      url.hash || url.pathname !== "/") throw new Error("Invalid database URL");
  return url;
}
export function draftReadUrl(base, id) {
  if (!validDraftId(id)) throw new Error("Invalid draft ID");
  const url = new URL("/rest/v1/cards", rootUrl(base));
  url.searchParams.set("select",
    "id,type,source_language,target_language,term,status,content,created_at,updated_at");
  url.searchParams.set("id", "eq." + id);
  url.searchParams.set("status", "eq.draft");
  url.searchParams.set("limit", "1");
  return url;
}
export function draftPatchUrl(base, id, expectedUpdatedAt) {
  if (!validDraftId(id) || !validDraftVersion(expectedUpdatedAt))
    throw new Error("Invalid draft key or version");
  const url = new URL("/rest/v1/cards", rootUrl(base));
  url.searchParams.set("select", "id,type,term,status,updated_at");
  url.searchParams.set("id", "eq." + id);
  url.searchParams.set("status", "eq.draft");
  url.searchParams.set("updated_at", "eq." + expectedUpdatedAt);
  return url;
}
export function confirmDraftPatch(raw, original) {
  if (!Array.isArray(raw) || raw.length !== 1 || !record(raw[0])) return null;
  const value = raw[0];
  if (value.id !== original.id || value.type !== original.type ||
      value.term !== original.term || value.status !== "draft" ||
      !validDraftVersion(value.updated_at) ||
      value.updated_at === original.updatedAt) return null;
  return { id: value.id, status: "draft", updatedAt: value.updated_at };
}
export function nextDraftVersion(previous, now = Date.now()) {
  if (!validDraftVersion(previous) || !Number.isFinite(now)) throw new Error("Invalid timestamp");
  return new Date(Math.max(Math.floor(now), Date.parse(previous) + 1)).toISOString();
}
