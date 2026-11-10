import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCardDisplay } from "../src/lib/cards/card-display.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const categories = read("../src/app/categories/page.tsx");
const cardView = read("../src/app/categories/LearningCard.tsx");
const search = read("../src/app/search/page.tsx");
const publicCategories = read("../src/app/api/categories/route.ts");

test("H40B keeps exactly the Search and Categories navigation destinations", () => {
  assert.match(categories, /href="\/" className/);
  assert.match(categories, /href="\/categories"/);
  assert.doesNotMatch(categories, /href="\/saved"/);
  assert.match(categories, /Saved on this device/);
  assert.match(categories, /openSaved/);
});

test("Categories and Saved collections use the same expanded card presentation", () => {
  assert.match(categories, /import LearningCard from "\.\/LearningCard"/);
  assert.match(categories, /visibleCards\.map/);
  assert.match(categories, /<LearningCard key=\{id\}/);
  assert.match(categories, /expanded=\{expanded === id\}/);
  assert.match(cardView, /aria-expanded=\{expanded\}/);
  assert.match(cardView, /Hide card details/);
  assert.match(cardView, /Explore card/);
});

test("local saved cards retain the exact H40A Search storage contract", () => {
  assert.match(search, /const key = "lt:cards:v1"/);
  assert.match(categories, /const storageKey = "lt:cards:v1"/);
  assert.match(categories, /localStorage\.getItem\(storageKey\)/);
  assert.match(categories, /localStorage\.setItem\(storageKey, JSON\.stringify\(next\)\)/);
  assert.match(categories, /addEventListener\("storage", load\)/);
  assert.match(categories, /sameCard\(value, card\)/);
  assert.match(categories, /onSave=\{showSaved \? undefined : \(\) => save\(content\)\}/);
});

test("saved cards are filtered before rendering and are device-local", () => {
  assert.match(categories, /function isSavedCard\(value: unknown\)/);
  assert.match(categories, /card\.type === "word"/);
  assert.match(categories, /card\.type === "sentence"/);
  assert.match(categories, /value\.filter\(isSavedCard\)\.slice\(-200\)\.reverse\(\)/);
  assert.match(categories, /stored in this browser/);
});

test("category and saved card headlines show the opposite-language translation first", () => {
  assert.match(cardView, /getCardDisplay\(card, card\.sourceLanguage, card\.term\)/);
  assert.match(cardView, /\{display\.headline\}/);
  assert.match(cardView, /\{display\.supporting\}/);
  const deCard = { type: "word", sourceLanguage: "de", targetLanguage: "en",
    term: "Gespräch", translation: "conversation; discussion" };
  const enCard = { ...deCard, sourceLanguage: "en", targetLanguage: "de",
    term: "habit", translation: "Gewohnheit" };
  assert.equal(getCardDisplay(deCard, "de", deCard.term).headline, "conversation");
  assert.equal(getCardDisplay(enCard, "en", enCard.term).headline, "Gewohnheit");
});

test("approved H40A pastel and chevron style is retained in all sections", () => {
  assert.equal((cardView.match(/<details\b/g) || []).length, 4);
  assert.equal((cardView.match(/<summary\b/g) || []).length, 4);
  for (const color of ["#e6f2ec", "#f1f4fb", "#f9edf3", "#fff2d9"]) {
    assert.ok(cardView.includes("bg-[" + color + "]"), color);
  }
  assert.match(cardView, /group-open:rotate-180/);
  const details = [...cardView.matchAll(/<details\b[^>]*>/g)].map(m => m[0]);
  assert.ok(details.every(value => !/\sopen(?:\s|=|>)/.test(value)));
  assert.doesNotMatch(cardView, />⌄<|>Meaning<\/span>/);
});

test("Word Cards get dedicated Synonyms & Antonyms, Sentence Cards do not", () => {
  assert.match(cardView, /card\.type === "word" && <details/);
  assert.match(cardView, /Synonyms &amp; Antonyms/);
  assert.match(cardView, /card\.synonyms\.map/);
  assert.match(cardView, /card\.antonyms\.map/);
  const otherForms = cardView.slice(cardView.indexOf(">Other Forms</span>"));
  assert.doesNotMatch(otherForms, /card\.(?:synonyms|antonyms)/);
  assert.match(cardView, /No direct antonyms have been curated/);
});

test("Grammar, examples, and other forms retain full curated data", () => {
  for (const value of ["partOfSpeech", "article", "plural", "perfect", "preterite",
    "auxiliary", "separable", "reflexive", "notes"]) {
    assert.ok(cardView.includes("card.grammar." + value), value);
  }
  for (const value of ["card.usageNotes", "card.relatedWords",
    "card.commonExpressions", "card.alternatives", "curatedSentenceGrammar",
    "card.wordBreakdown", "card.grammarBreakdown"]) {
    assert.ok(cardView.includes(value), value);
  }
  assert.match(cardView, /Examples \(\{card\.examples\?\.length \?\? 0\}\)/);
  assert.match(cardView, /In context:/);
});

test("bilingual example rows have truthful counts and no language badges", () => {
  const begin = cardView.indexOf("card.examples.map((example,i)");
  const end = cardView.indexOf("{example.note &&", begin);
  assert.ok(begin > 0 && end > begin);
  const examples = cardView.slice(begin, end);
  assert.match(examples, /\{example\.source\}/);
  assert.match(examples, /\{example\.translation\}/);
  assert.doesNotMatch(examples, /card\.(?:sourceLanguage|targetLanguage)/);
});

test("scope is UI-only: public categories remain published-only, without new writes or AI generation", () => {
  assert.match(publicCategories, /status:"eq\.published"/);
  assert.match(categories, /fetch\("\/api\/categories\?slug="/);
  assert.doesNotMatch(categories, /fetch\("\/api\/cards\/generate"/);
  assert.doesNotMatch(cardView, /\/api\/admin\//);
  assert.doesNotMatch(categories, /SUPABASE_SERVICE_ROLE_KEY/);
});
