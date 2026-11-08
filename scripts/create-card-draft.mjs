#!/usr/bin/env node
/**
 * Generate one editable local Word/Sentence Card JSON draft.
 * No database connection, credentials, publishing, or AI calls.
 *
 * node scripts/create-card-draft.mjs word "die Entscheidung" work-career
 * node scripts/create-card-draft.mjs sentence "Ich hätte gern einen Termin." conversations
 * node scripts/create-card-draft.mjs word "habit" daily-life en
 *
 * Redirect stdout to a JSON file, fill every blank, then validate with
 * scripts/build-vocabulary-import.mjs <file> --check.
 */
const [type, term, category, source = "de"] = process.argv.slice(2);
if (!["word", "sentence"].includes(type) ||
    typeof term !== "string" || !term.trim() || term.length > 500 ||
    typeof category !== "string" || category.length > 64 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) ||
    !["de", "en"].includes(source) || process.argv.length > 6) {
  console.error('Usage: node scripts/create-card-draft.mjs <word|sentence> "<term>" <category-slug> [de|en]');
  process.exit(2);
}
const article = source === "de" ? /^(der|die|das)\s+/u.exec(term.trim())?.[1] : undefined;
const common = {
  schemaVersion: 1,
  type,
  sourceLanguage: source,
  targetLanguage: source === "de" ? "en" : "de",
  term: term.trim(),
  translation: "",
};
const content = type === "word"
  ? {
      ...common,
      grammar: article
        ? { partOfSpeech: "noun", article, plural: "" }
        : { partOfSpeech: "other" },
      examples: Array.from({ length: 5 }, () => ({ source: "", translation: "" })),
    }
  : {
      ...common,
      naturalMeaning: "",
      grammarBreakdown: [],
      wordBreakdown: [],
    };
process.stdout.write(JSON.stringify([{ content, categories: [category] }], null, 2) + "\n");
