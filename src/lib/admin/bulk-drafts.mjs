import { parseNewAdminDraft } from "./create-draft.mjs";

/**
 * H.39D.4.1: bounded bulk import of bilingual pairs into unpublished drafts.
 * No category assignment, publish, update, upsert or database calls here.
 */
const TYPES = new Set(["word", "sentence"]);
const LANGUAGES = new Set(["de", "en"]);
const REQUEST_KEYS = new Set(["type", "sourceLanguage", "pairs"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 20;
const MAX_INPUT = 16000;
const record = item => item !== null && typeof item === "object" && !Array.isArray(item);

export function splitBulkPairs(raw) {
  if (typeof raw !== "string" || raw.length > MAX_INPUT) return null;
  const lines = raw.replace(/\r\n?/g, "\n").split("\n")
    .filter(line => line.trim().length > 0);
  if (lines.length === 0 || lines.length > MAX_ITEMS) return null;
  const parsed = [];
  for (const line of lines) {
    const separator = line.includes("\t") ? "\t" : " | ";
    const columns = line.split(separator);
    if (columns.length !== 2) return null;
    const [term, translation] = columns.map(part => part.normalize("NFKC").trim());
    if (!term || !translation || term.length > 500 || translation.length > 500) return null;
    parsed.push({ term, translation });
  }
  return parsed;
}

export function parseBulkDraftRequest(input) {
  if (!record(input) ||
      Object.keys(input).some(key => !REQUEST_KEYS.has(key)) ||
      Object.keys(input).length !== 3 ||
      !TYPES.has(input.type) || !LANGUAGES.has(input.sourceLanguage))
    return null;
  const pairs = splitBulkPairs(input.pairs);
  if (!pairs) return null;
  const rows = [];
  const keys = new Set();
  for (const pair of pairs) {
    const data = input.type === "word"
      ? {
          type: "word", sourceLanguage: input.sourceLanguage,
          term: pair.term, translation: pair.translation,
          grammar: { partOfSpeech: "other", article: "", plural: "" },
          examples: Array.from({ length: 5 }, () => ({ source: "", translation: "" })),
          usageNotes: [],
        }
      : {
          type: "sentence", sourceLanguage: input.sourceLanguage,
          term: pair.term, translation: pair.translation,
          naturalMeaning: "", grammarBreakdown: [],
        };
    const row = parseNewAdminDraft(data);
    if (!row || keys.has(row.search_key)) return null;
    keys.add(row.search_key);
    rows.push(row);
  }
  return rows;
}

export function makeBulkDraftUrl(base) {
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/")
    throw new Error("Invalid database origin");
  const url = new URL("/rest/v1/cards", origin);
  url.searchParams.set("select", "id,type,term,status,search_key,created_at");
  return url;
}

export function confirmBulkDraftInsert(raw, expected) {
  if (!Array.isArray(raw) || !Array.isArray(expected) ||
      raw.length !== expected.length || expected.length < 1 ||
      expected.length > MAX_ITEMS) return null;
  const keys = new Set();
  const ids = new Set();
  const want = new Map(expected.map(item => [item.search_key, item]));
  for (const item of raw) {
    if (!record(item) || typeof item.id !== "string" || !UUID.test(item.id) ||
        ids.has(item.id) || item.status !== "draft" ||
        typeof item.search_key !== "string" || keys.has(item.search_key) ||
        typeof item.created_at !== "string" ||
        !want.has(item.search_key)) return null;
    const target = want.get(item.search_key);
    if (item.type !== target.type || item.term !== target.term) return null;
    ids.add(item.id);
    keys.add(item.search_key);
  }
  return { count: raw.length };
}
