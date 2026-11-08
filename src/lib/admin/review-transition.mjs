import { validDraftId, validDraftVersion, nextDraftVersion } from "./edit-draft.mjs";

const TRANSITIONS = Object.freeze({
  draft: new Set(["review"]),
  review: new Set(["published", "rejected"]),
  rejected: new Set(["draft"]),
});
const ACTIONS = Object.freeze({
  submit: { from: "draft", to: "review" },
  publish: { from: "review", to: "published" },
  reject: { from: "review", to: "rejected" },
  revise: { from: "rejected", to: "draft" },
});
const PARTS = new Set(["noun","verb","adjective","adverb","pronoun",
  "preposition","conjunction","interjection","article","particle","other"]);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 500) => typeof value === "string" &&
  value.length <= max && value.trim().length > 0;
const noteList = (value, max = 8) => Array.isArray(value) && value.length <= max &&
  value.every(entry => text(entry, 600));

/** Structural gate only. Human review is still mandatory before publishing. */
export function validatePublishableContent(card) {
  const failures = [];
  if (!record(card) || !record(card.content) ||
      !["word","sentence"].includes(card.type) ||
      !["de","en"].includes(card.sourceLanguage) ||
      !["de","en"].includes(card.targetLanguage) ||
      card.sourceLanguage === card.targetLanguage) return ["Invalid card structure"];
  const c = card.content;
  if (c.schemaVersion !== 1 || c.type !== card.type ||
      c.sourceLanguage !== card.sourceLanguage ||
      c.targetLanguage !== card.targetLanguage || c.term !== card.term ||
      !text(card.term)) failures.push("Card identity is inconsistent");
  if (!text(c.translation)) failures.push("Translation is required");
  if (card.type === "sentence") {
    if (!text(c.naturalMeaning, 1000)) failures.push("Natural meaning is required");
    if (c.grammarBreakdown !== undefined && !noteList(c.grammarBreakdown))
      failures.push("Invalid grammar notes");
  } else {
    if (!record(c.grammar) || !PARTS.has(c.grammar.partOfSpeech))
      failures.push("Part of speech is required");
    if (c.grammar?.article !== undefined &&
        (!["der","die","das"].includes(c.grammar.article) ||
         c.grammar.partOfSpeech !== "noun")) failures.push("Invalid noun article");
    if (card.sourceLanguage === "de" && c.grammar?.partOfSpeech === "noun" &&
        (!["der","die","das"].includes(c.grammar.article) ||
         !text(c.grammar.plural, 150))) failures.push("German nouns need article and plural");
    if (!Array.isArray(c.examples) || c.examples.length !== 5 ||
        !c.examples.every(ex => record(ex) &&
          text(ex.source, 600) && text(ex.translation, 600)))
      failures.push("Five complete bilingual examples are required");
    if (c.usageNotes !== undefined && !noteList(c.usageNotes))
      failures.push("Invalid usage notes");
  }
  return failures;
}

export function parseReviewTransition(body, card) {
  if (!record(body) || Object.keys(body).some(k =>
      !["action","expectedUpdatedAt","confirmed"].includes(k)) ||
      Object.keys(body).length !== 3 ||
      !Object.hasOwn(body,"action") || !Object.hasOwn(body,"expectedUpdatedAt") ||
      !Object.hasOwn(body,"confirmed") ||
      !validDraftVersion(body.expectedUpdatedAt) ||
      !record(card) || !validDraftId(card.id) ||
      !validDraftVersion(card.updatedAt) || typeof card.status !== "string")
    return null;
  const transition = ACTIONS[body.action];
  if (!transition || transition.from !== card.status ||
      !TRANSITIONS[card.status]?.has(transition.to) ||
      body.confirmed !== (body.action === "publish")) return null;
  return {
    from: transition.from,
    to: transition.to,
    expectedUpdatedAt: body.expectedUpdatedAt,
    action: body.action,
  };
}

function secureOrigin(base) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/")
    throw new Error("Invalid Supabase origin");
  return url;
}

export function reviewCardUrl(base, id) {
  if (!validDraftId(id)) throw new Error("Invalid card ID");
  const url = new URL("/rest/v1/cards", secureOrigin(base));
  url.searchParams.set("select","id,type,source_language,target_language,term,status,content,created_at,updated_at");
  url.searchParams.set("id","eq."+id);
  url.searchParams.set("limit","1");
  return url;
}
export function reviewPatchUrl(base, id, from, updatedAt) {
  if (!validDraftId(id) || !validDraftVersion(updatedAt) ||
      !Object.hasOwn(TRANSITIONS, from)) throw new Error("Invalid review filter");
  const url = new URL("/rest/v1/cards", secureOrigin(base));
  url.searchParams.set("select","id,type,term,status,updated_at");
  url.searchParams.set("id","eq."+id);
  url.searchParams.set("status","eq."+from);
  url.searchParams.set("updated_at","eq."+updatedAt);
  return url;
}

export function confirmReviewPatch(rows, card, to) {
  if (!Array.isArray(rows) || rows.length !== 1 || !record(rows[0]))
    return null;
  const r = rows[0];
  if (r.id !== card.id || r.type !== card.type || r.term !== card.term ||
      r.status !== to || !validDraftVersion(r.updated_at) ||
      r.updated_at === card.updatedAt) return null;
  return { id: r.id, status: to, updatedAt: r.updated_at };
}
export { nextDraftVersion };
