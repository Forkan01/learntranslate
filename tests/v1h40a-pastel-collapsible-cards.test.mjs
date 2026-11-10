import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCardDisplay } from "../src/lib/cards/card-display.mjs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const ui = read("../src/app/search/page.tsx");
const schema = read("../src/lib/cards/schema.ts");

test("the translation-first card keeps the primary meaning visible outside accordions", () => {
  assert.match(ui, /getCardDisplay\(card, result\.searchedSource, result\.searchedTerm\)/);
  assert.match(ui, /<h2[^>]*>\{display\.headline\}<\/h2>/);
  assert.match(ui, /\{display\.otherMeanings\.join\(" · "\)\}/);
  assert.match(ui, /\{display\.supporting\}/);
  assert.match(ui, /pronounce\(card\.term\)/);
});

test("the four approved learning sections exist and start collapsed", () => {
  const sections = ["Meaning", "Grammar", "Examples", "Other Forms"];
  for (const section of sections) {
    assert.match(ui, new RegExp("<summary[^>]*>[\\\\s\\\\S]*?" + section));
  }
  const details = [...ui.matchAll(/<details\b[^>]*>/g)].map(m => m[0]);
  assert.equal(details.length, 4);
  for (const section of details) {
    assert.match(section, /className="group/);
    assert.doesNotMatch(section, /(?:\s|^)open(?:\s|=|>)/);
  }
});

test("all four containers use distinct calm pastel colors and tactile edges", () => {
  for (const color of ["#fff0d5", "#e6f2ec", "#f1f4fb", "#f9edf3"])
    assert.ok(ui.includes("bg-[" + color + "]"));
  assert.match(ui, /rounded-\[24px\] border-2/);
  assert.match(ui, /group-open:rotate-180/);
});

test("Word Cards preserve German noun grammar and available verb metadata", () => {
  for (const key of ["partOfSpeech", "article", "plural", "perfect", "preterite",
    "auxiliary", "separable", "reflexive", "notes"])
    assert.ok(ui.includes("card.grammar." + key));
  assert.match(ui, /card\.type === "word"/);
});

test("Examples include bilingual text, optional teaching notes, and truthful counts", () => {
  assert.match(ui, /Examples \(\{card\.type === "word" \? card\.examples\.length : card\.examples\?\.length \?\? 0\}\)/);
  assert.match(ui, /card\.examples\?\.map/);
  assert.match(ui, /\{example\.source\}/);
  assert.match(ui, /\{example\.translation\}/);
  assert.match(ui, /\{example\.note &&/);
  assert.match(ui, /No curated examples are available/);
  assert.ok(schema.includes("examples?: BilingualExample[]"));
});

test("Meaning, Grammar and Other Forms preserve Sentence Card teaching content", () => {
  for (const term of ["card.naturalMeaning", "grammarNotes?.length",
    "wordNotes?.length", "card.alternatives?.length", "item.context"])
    assert.ok(ui.includes(term),term);
  assert.match(ui, /Grammar breakdown/);
  assert.match(ui, /Word by word/);
  assert.match(ui, /Other ways to say it/);
});

test("Word Card Other Forms preserves curated related words without inventing content", () => {
  for (const key of ["synonyms", "antonyms", "relatedWords", "commonExpressions"])
    assert.ok(ui.includes("card." + key));
  assert.match(ui, /No other forms or related expressions have been curated/);
  assert.match(ui, /No alternative expressions have been curated/);
});

test("Search, auth and Save remain unchanged in scope", () => {
  assert.match(ui, /for \(const type of \["word", "sentence"\]\)/);
  assert.match(ui, /fetch\("\/api\/cards\/search\?"/);
  assert.match(ui, /localStorage\.setItem\(key, JSON\.stringify\(next\)\)/);
  assert.match(ui, /Save this card/);
  assert.match(ui, /Only published cards are shown/);
  assert.doesNotMatch(ui, /fetch\("\/api\/cards\/generate"/);
});

test("translation direction keeps the opposite-language headline", () => {
  const word = {type:"word",sourceLanguage:"de",targetLanguage:"en",
    term:"sogar",translation:"even"};
  assert.equal(getCardDisplay(word,"de","sogar").headline,"even");
  assert.equal(getCardDisplay(word,"en","even").headline,"sogar");
  assert.equal(getCardDisplay(word,"de","sogar").supporting,"sogar");
});
