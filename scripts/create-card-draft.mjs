#!/usr/bin/env node
/**
 * Generate one editable local Word/Sentence Card JSON draft.
 * No database connection, credentials, publishing, or AI calls.
 *
 * node scripts/create-card-draft.mjs word "die Entscheidung" work-career
 * node scripts/create-card-draft.mjs sentence "Ich hätte gern einen Termin." conversations
 * node scripts/create-card-draft.mjs word "habit" daily-life en
 *
 * Optional: --out path/to/file.json (refuses to overwrite an existing file).
 * Fill every blank, then validate with scripts/build-vocabulary-import.mjs <file> --check.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
let outputPath;
if (outIndex !== -1) {
  if (outIndex !== args.length - 2 || !args[outIndex + 1]) {
    console.error("Use --out <file.json> at the end of the command.");
    process.exit(2);
  }
  outputPath = args[outIndex + 1];
  args.splice(outIndex, 2);
}
const [type, term, category, source = "de"] = args;
if (!["word", "sentence"].includes(type) ||
    typeof term !== "string" || !term.trim() || term.length > 500 ||
    typeof category !== "string" || category.length > 64 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) ||
    !["de", "en"].includes(source) || args.length > 4) {
  console.error('Usage: node scripts/create-card-draft.mjs <word|sentence> "<term>" <category-slug> [de|en] [--out file.json]');
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
const output = JSON.stringify([{ content, categories: [category] }], null, 2) + "\n";
if (outputPath) {
  writeFileSync(resolve(outputPath), output, { flag: "wx", encoding: "utf8" });
  process.stdout.write("Draft created: " + outputPath + " (fill blanks before importing).\n");
} else {
  process.stdout.write(output);
}
