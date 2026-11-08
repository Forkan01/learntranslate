import test from "node:test";
import assert from "node:assert/strict";
import { curatedSentenceGrammar } from "../src/lib/cards/curated-sentence-grammar.mjs";
import { auditLearningCard } from "../scripts/card-quality-audit.mjs";

test("four distinct curated sentence explanations are structurally valid", () => {
  assert.equal(curatedSentenceGrammar.length, 4);
  assert.equal(new Set(curatedSentenceGrammar.map(entry => entry.term)).size, 4);
  for (const entry of curatedSentenceGrammar) {
    const card = {
      schemaVersion: 1, type: "sentence", sourceLanguage: "de", targetLanguage: "en",
      term: entry.term, translation: "English translation", naturalMeaning: "Learning context",
      grammarBreakdown: entry.grammarBreakdown, wordBreakdown: entry.wordBreakdown
    };
    assert.deepEqual(auditLearningCard(card), [], entry.term);
    assert.ok(entry.grammarBreakdown.length >= 2);
    assert.ok(entry.wordBreakdown.length >= 3);
  }
});
