/**
 * H.39D.1: deterministic, draft-only card creation. No network, secrets or
 * browser identity in this module. Never trust caller-supplied status/key.
 */
const TYPES = new Set(["word", "sentence"]);
const SOURCES = new Set(["de", "en"]);
const PARTS = new Set(["noun", "verb", "adjective", "adverb", "pronoun",
  "preposition", "conjunction", "interjection", "article", "particle", "other"]);
const ARTICLES = new Set(["", "der", "die", "das"]);
const INPUT_KEYS = new Set(["type", "sourceLanguage", "term", "translation",
  "grammar", "examples", "naturalMeaning", "grammarBreakdown", "usageNotes"]);
const GRAMMAR_KEYS = new Set(["partOfSpeech", "article", "plural"]);
const EXAMPLE_KEYS = new Set(["source", "translation"]);

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function allowedKeys(obj, keys) {
  return Object.keys(obj).every(key => keys.has(key));
}
function clean(value, max, required = false) {
  if (typeof value !== "string" || value.length > max) return null;
  const trimmed = value.normalize("NFKC").trim();
  if (trimmed.length > max || (required && !trimmed)) return null;
  return trimmed;
}
function notes(value) {
  if (!Array.isArray(value) || value.length > 8) return null;
  const items = value.map(note => clean(note, 600));
  if (items.includes(null)) return null;
  return items.filter(Boolean);
}
export function parseNewAdminDraft(value) {
  if (!record(value) || !allowedKeys(value, INPUT_KEYS) ||
      !TYPES.has(value.type) || !SOURCES.has(value.sourceLanguage)) return null;
  const term = clean(value.term, 500, true);
  const translation = clean(value.translation, 500);
  if (term === null || translation === null) return null;
  const targetLanguage = value.sourceLanguage === "de" ? "en" : "de";
  const content = {
    schemaVersion: 1,
    type: value.type,
    sourceLanguage: value.sourceLanguage,
    targetLanguage,
    term,
    translation,
  };
  if (value.type === "word") {
    if (!record(value.grammar) || !allowedKeys(value.grammar, GRAMMAR_KEYS) ||
        !PARTS.has(value.grammar.partOfSpeech)) return null;
    const article = clean(value.grammar.article, 12);
    const plural = clean(value.grammar.plural, 150);
    if (article === null || plural === null || !ARTICLES.has(article) ||
        (article && value.grammar.partOfSpeech !== "noun")) return null;
    const grammar = { partOfSpeech: value.grammar.partOfSpeech };
    if (article) grammar.article = article;
    if (plural) grammar.plural = plural;
    if (!Array.isArray(value.examples) || value.examples.length !== 5) return null;
    const examples = [];
    for (const item of value.examples) {
      if (!record(item) || !allowedKeys(item, EXAMPLE_KEYS)) return null;
      const source = clean(item.source, 600);
      const translationText = clean(item.translation, 600);
      if (source === null || translationText === null) return null;
      // Partial examples are permitted in drafts, not on publication.
      examples.push({ source, translation: translationText });
    }
    const usageNotes = notes(value.usageNotes ?? []);
    if (usageNotes === null) return null;
    content.grammar = grammar;
    content.examples = examples;
    if (usageNotes.length) content.usageNotes = usageNotes;
    if (value.naturalMeaning !== undefined || value.grammarBreakdown !== undefined) return null;
  } else {
    const naturalMeaning = clean(value.naturalMeaning, 1000);
    const grammarBreakdown = notes(value.grammarBreakdown ?? []);
    if (naturalMeaning === null || grammarBreakdown === null ||
        value.grammar !== undefined || value.examples !== undefined ||
        value.usageNotes !== undefined) return null;
    content.naturalMeaning = naturalMeaning;
    content.grammarBreakdown = grammarBreakdown;
  }
  const normal = term.normalize("NFKC").trim().replace(/\s+/gu, " ")
    .toLocaleLowerCase(value.sourceLanguage === "de" ? "de-DE" : "en-US");
  const searchKey = [value.type, value.sourceLanguage, targetLanguage, normal].join(":");
  return {
    type: value.type,
    source_language: value.sourceLanguage,
    target_language: targetLanguage,
    term,
    search_key: searchKey,
    status: "draft",
    content,
  };
}

export function makeAdminDraftUrl(base) {
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/")
    throw new Error("Invalid database URL");
  const url = new URL("/rest/v1/cards", origin);
  url.searchParams.set("select", "id,type,term,status,created_at");
  return url;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function confirmDraftInsert(value, expected) {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const item = value[0];
  if (!record(item) || typeof item.id !== "string" || !UUID.test(item.id) ||
      item.status !== "draft" || item.type !== expected.type ||
      item.term !== expected.term || typeof item.created_at !== "string") return null;
  return { id: item.id, status: "draft", type: item.type, term: item.term };
}
