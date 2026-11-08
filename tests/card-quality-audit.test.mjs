import test from "node:test";
import assert from "node:assert/strict";
import { auditLearningCard } from "../scripts/card-quality-audit.mjs";

const base = { schemaVersion: 1, type: "word", sourceLanguage: "de", targetLanguage: "en", term: "Antrag", translation: "application", grammar: { partOfSpeech: "noun", article: "der", plural: "Anträge" }, examples: Array.from({ length: 5 }, () => ({ source: "Ich stelle einen Antrag.", translation: "I submit an application." })) };
test("complete word card passes", () => assert.deepEqual(auditLearningCard(base), []));
test("missing noun article and insufficient examples flagged", () => {
  const result = auditLearningCard({ ...base, grammar: { partOfSpeech: "noun" }, examples: base.examples.slice(0, 4) });
  assert.ok(result.includes("missing_german_noun_article"));
  assert.ok(result.includes("word_examples_not_five"));
});
test("optional fields are not required", () => assert.deepEqual(auditLearningCard(base), []));
test("sentence meaning is required", () => {
  const sentence = { schemaVersion: 1, type: "sentence", sourceLanguage: "de", targetLanguage: "en", term: "Guten Tag.", translation: "Good day.", naturalMeaning: "" };
  assert.ok(auditLearningCard(sentence).includes("missing_natural_meaning"));
});
test("invalid language direction flagged", () => assert.ok(auditLearningCard({ ...base, targetLanguage: "de" }).includes("language_pair")));
