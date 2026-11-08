import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getCardDisplay } from "../src/lib/cards/card-display.mjs";

const searchPage = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
const deWord = {
  type: "word", sourceLanguage: "de", targetLanguage: "en",
  term: "Antrag", translation: "application; request",
};

test("German search emphasizes English meaning and retains German original", () => {
  assert.deepEqual(getCardDisplay(deWord, "de", "Antrag"), {
    headline: "application",
    headlineLanguage: "en",
    supporting: "Antrag",
    supportingLanguage: "de",
    supportingLabel: "Original",
    otherMeanings: ["request"],
  });
});

test("English reverse lookup emphasizes curated German term, not stored English translation", () => {
  assert.deepEqual(getCardDisplay(deWord, "en", "request"), {
    headline: "Antrag",
    headlineLanguage: "de",
    supporting: "request",
    supportingLanguage: "en",
    supportingLabel: "You searched",
    otherMeanings: [],
  });
});

test("direct English cards emphasize German and keep the English original", () => {
  const enWord = { ...deWord, term: "habit", translation: "Gewohnheit", sourceLanguage: "en", targetLanguage: "de" };
  const display = getCardDisplay(enWord, "en", "habit");
  assert.equal(display.headline, "Gewohnheit");
  assert.equal(display.headlineLanguage, "de");
  assert.equal(display.supporting, "habit");
});

test("sentence cards follow the same direction behavior without changing the card", () => {
  const card = {
    type: "sentence", sourceLanguage: "de", targetLanguage: "en",
    term: "Ich hätte gern einen Termin.", translation: "I would like an appointment.",
    naturalMeaning: "A polite way to request an appointment.",
  };
  const original = structuredClone(card);
  assert.equal(getCardDisplay(card, "de", "Ich hätte gern einen Termin").headline, "I would like an appointment.");
  assert.equal(getCardDisplay(card, "en", "I would like an appointment.").headline, "Ich hätte gern einen Termin.");
  assert.deepEqual(card, original);
});

test("multiple curated translation senses are presented without dropping secondary meanings", () => {
  const display = getCardDisplay({ ...deWord, translation: "application ; request ; petition" }, "de", "Antrag");
  assert.equal(display.headline, "application");
  assert.deepEqual(display.otherMeanings, ["request", "petition"]);
});

test("UI keeps the successful query context and renders the display helper", () => {
  assert.match(searchPage, /searchedSource: Direction; searchedTerm: string/);
  assert.match(searchPage, /setResult\(\{ \.\.\.found, searchedSource: source, searchedTerm: submittedTerm \}\)/);
  assert.match(searchPage, /getCardDisplay\(card, result\.searchedSource, result\.searchedTerm\)/);
  assert.match(searchPage, /display\.headline/);
  assert.match(searchPage, /display\.supporting/);
  assert.match(searchPage, /pronounce\(card\.term\)/);
  assert.match(searchPage, /Grammar breakdown/);
  assert.match(searchPage, /Word by word/);
});
