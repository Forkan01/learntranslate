#!/usr/bin/env node
/**
 * Offline, review-first vocabulary bulk importer.
 * Usage: node scripts/build-vocabulary-import.mjs data/vocabulary/starter.json > /tmp/learntranslate-import.sql
 * Inspect SQL before executing in Supabase SQL editor. Never run generated SQL automatically.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/build-vocabulary-import.mjs <cards.json>"); process.exit(2); }
const raw = JSON.parse(readFileSync(resolve(path), "utf8"));
if (!Array.isArray(raw) || raw.length === 0 || raw.length > 1000) throw Error("Expected 1–1000 cards");
const languages = ["de", "en"];
const allowedTypes = ["word", "sentence"];
const allowedParts = ["noun","verb","adjective","adverb","pronoun","preposition","conjunction","interjection","article","particle","other"];
const esc = s => "'" + s.replaceAll("'", "''") + "'";
const norm = (s, lang) => s.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(lang === "de" ? "de-DE" : "en-US");
const fail = (i, m) => { throw Error("Card " + (i + 1) + ": " + m); };
const seen = new Set();
const statements = ["BEGIN;"];
for (const [i, entry] of raw.entries()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(i, "not an object");
  const { content, categories } = entry;
  if (!content || typeof content !== "object" || Array.isArray(content)) fail(i, "missing content");
  if (content.schemaVersion !== 1 || !allowedTypes.includes(content.type)) fail(i, "invalid schema/type");
  if (!languages.includes(content.sourceLanguage) || !languages.includes(content.targetLanguage) || content.sourceLanguage === content.targetLanguage) fail(i, "invalid language pair");
  for (const field of ["term","translation"]) if (typeof content[field] !== "string" || !content[field].trim() || content[field].length > 500) fail(i, "invalid " + field);
  if (content.type === "word") {
    if (!content.grammar || !allowedParts.includes(content.grammar.partOfSpeech)) fail(i, "invalid grammar");
    if (!Array.isArray(content.examples) || content.examples.length !== 5) fail(i, "word cards require exactly five examples");
    if (content.grammar.article && (content.grammar.partOfSpeech !== "noun" || !["der","die","das"].includes(content.grammar.article))) fail(i, "invalid noun article");
  } else if (typeof content.naturalMeaning !== "string" || !content.naturalMeaning.trim()) fail(i, "missing naturalMeaning");
  if (content.examples) {
    if (!Array.isArray(content.examples) || content.examples.length > 10) fail(i, "invalid examples");
    for (const ex of content.examples) if (!ex || typeof ex.source !== "string" || !ex.source.trim() || typeof ex.translation !== "string" || !ex.translation.trim()) fail(i, "invalid example");
  }
  if (!Array.isArray(categories) || categories.length === 0 || categories.some(s => typeof s !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))) fail(i, "invalid category slugs");
  const key = [content.type, content.sourceLanguage, content.targetLanguage, norm(content.term, content.sourceLanguage)].join(":");
  if (seen.has(key)) fail(i, "duplicate search key " + key);
  seen.add(key);
  const json = JSON.stringify(content);
  // Insert as review only. Never publish automatically. Do not overwrite approved cards.
  statements.push(`INSERT INTO public.cards (type,source_language,target_language,term,search_key,status,content) VALUES (${esc(content.type)},${esc(content.sourceLanguage)},${esc(content.targetLanguage)},${esc(content.term)},${esc(key)},'review',${esc(json)}::jsonb) ON CONFLICT (search_key) DO NOTHING;`);
  for (const slug of new Set(categories)) {
    statements.push(`INSERT INTO public.card_categories(card_id,category_id) SELECT c.id, cat.id FROM public.cards c JOIN public.categories cat ON cat.slug=${esc(slug)} WHERE c.search_key=${esc(key)} ON CONFLICT DO NOTHING;`);
  }
}
statements.push("COMMIT;");
process.stdout.write("-- Review-first LearnTranslate import: " + raw.length + " cards; no automatic publishing.\n" + statements.join("\n") + "\n");
