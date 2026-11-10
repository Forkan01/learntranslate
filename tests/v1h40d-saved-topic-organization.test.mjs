import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SAVED_TOPICS, SAVED_TOPIC_STORAGE_KEY, isSavedTopic, savedCardKey,
  parseSavedTopics, assignSavedTopic, removeSavedTopic, filterSavedCards
} from "../src/lib/cards/saved-topics.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../src/app/categories/page.tsx");
const publicRoute = read("../src/app/api/categories/route.ts");
const cardUI = read("../src/app/categories/LearningCard.tsx");
const search = read("../src/app/search/page.tsx");

const word = {
  schemaVersion: 1, type: "word", sourceLanguage: "de", targetLanguage: "en",
  term: "Gespräch", translation: "conversation; discussion",
  grammar: { partOfSpeech: "noun", article: "das" }, examples: []
};
const english = {
  ...word, term: "conversation", translation: "Gespräch",
  sourceLanguage: "en", targetLanguage: "de"
};
const sentence = {
  schemaVersion: 1, type: "sentence", sourceLanguage: "de", targetLanguage: "en",
  term: "Ich bin müde.", translation: "I am tired.", naturalMeaning: "I feel tired."
};
const wordSameTextDifferentType = { ...sentence, term: "Gespräch" };

test("uses exactly the existing situation/topic categories with no CEFR categories", () => {
  assert.equal(SAVED_TOPICS.length, 12);
  assert.equal(new Set(SAVED_TOPICS.map(topic => topic.slug)).size, SAVED_TOPICS.length);
  for (const topic of SAVED_TOPICS) {
    assert.match(topic.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(isSavedTopic(topic.slug), true);
  }
  assert.equal(isSavedTopic("A1"), false);
  assert.equal(isSavedTopic("unrecognized"), false);
  assert.equal(SAVED_TOPIC_STORAGE_KEY, "lt:saved-card-topics:v1");
});

test("stable saved card keys distinguish term, type and source language", () => {
  assert.equal(savedCardKey(word), JSON.stringify(["word", "de", "Gespräch"]));
  assert.notEqual(savedCardKey(word), savedCardKey(english));
  assert.notEqual(savedCardKey(word), savedCardKey(wordSameTextDifferentType));
  assert.equal(savedCardKey({ ...word }), savedCardKey(word));
});

test("a topic can be assigned, reassigned and unset without mutating card data", () => {
  const initial = {};
  const original = structuredClone(word);
  const daily = assignSavedTopic(initial, word, "daily-life");
  const work = assignSavedTopic(daily, word, "work-career");
  const cleared = assignSavedTopic(work, word, "");
  assert.equal(daily[savedCardKey(word)], "daily-life");
  assert.equal(work[savedCardKey(word)], "work-career");
  assert.equal(cleared[savedCardKey(word)], undefined);
  assert.deepEqual(initial, {});
  assert.deepEqual(word, original);
  assert.throws(() => assignSavedTopic(daily, word, "B2"), /Unknown saved topic/);
});

test("removing a saved card assignment preserves assignments for other cards", () => {
  const a = assignSavedTopic({}, word, "conversations");
  const b = assignSavedTopic(a, sentence, "daily-life");
  const result = removeSavedTopic(b, word);
  assert.equal(result[savedCardKey(word)], undefined);
  assert.equal(result[savedCardKey(sentence)], "daily-life");
  assert.equal(b[savedCardKey(word)], "conversations");
});

test("parses valid local topic metadata and rejects invalid or unknown entries", () => {
  const key = savedCardKey(word);
  const otherKey = savedCardKey(sentence);
  const parsed = parseSavedTopics(JSON.stringify({
    [key]: "conversations",
    [otherKey]: "travel-transport",
    "not-a-card-key": "health",
    [JSON.stringify(["word","de",""])]: "housing",
    [JSON.stringify(["word","de","hello"])]: "invalid",
  }));
  assert.equal(parsed[key], "conversations");
  assert.equal(parsed[otherKey], "travel-transport");
  assert.equal(Object.keys(parsed).length, 2);
  assert.deepEqual(Object.keys(parseSavedTopics("not JSON")), []);
  assert.deepEqual(Object.keys(parseSavedTopics("[]")), []);
  assert.deepEqual(Object.keys(parseSavedTopics(null)), []);
  assert.deepEqual(Object.keys(parseSavedTopics("x".repeat(100001))), []);
});

test("filters saved cards by All, Unsorted, topic and bilingual search", () => {
  const items = [word, sentence, english];
  let topics = assignSavedTopic({}, word, "conversations");
  topics = assignSavedTopic(topics, english, "work-career");
  assert.deepEqual(filterSavedCards(items, topics, "all", ""), items);
  assert.deepEqual(filterSavedCards(items, topics, "unsorted", ""), [sentence]);
  assert.deepEqual(filterSavedCards(items, topics, "conversations", ""), [word]);
  assert.deepEqual(filterSavedCards(items, topics, "work-career", "GESPRÄCH"), [english]);
  assert.deepEqual(filterSavedCards(items, topics, "all", "conVERSation"), [word, english]);
  assert.deepEqual(filterSavedCards(items, topics, "unsorted", "i AM TIRED"), [sentence]);
  assert.deepEqual(filterSavedCards(items, topics, "conversations", "not here"), []);
});

test("the Saved collection offers a topic selector, filter and word/translation search", () => {
  assert.match(page, /import \{[\s\S]*SAVED_TOPICS, SAVED_TOPIC_STORAGE_KEY, savedCardKey, parseSavedTopics/);
  assert.match(page, /function readSavedTopics\(\): Record<string, string>/);
  assert.match(page, /const \[savedTopicFilter, setSavedTopicFilter\] = useState\("all"\)/);
  assert.match(page, /const \[savedSearch, setSavedSearch\] = useState\(""\)/);
  assert.match(page, /filterSavedCards\(savedCards, topicAssignments, savedTopicFilter, savedSearch\)/);
  assert.match(page, /htmlFor="saved-topic-filter"/);
  assert.match(page, /htmlFor="saved-search"/);
  assert.match(page, /Organize by topic/);
  assert.match(page, /onChange=\{event => changeSavedTopic\(content, event\.target\.value\)\}/);
});

test("category-saved cards inherit category only if they had no existing choice", () => {
  assert.match(page, /selected && isSavedTopic\(selected\.slug\)/);
  assert.match(page, /!Object\.hasOwn\(existingTopics, savedCardKey\(card\)\)/);
  assert.match(page, /assignSavedTopic\(existingTopics, card, selected\.slug\)/);
  assert.match(page, /localStorage\.setItem\(SAVED_TOPIC_STORAGE_KEY, JSON\.stringify\(assigned\)\)/);
  assert.match(page, /localStorage\.setItem\(SAVED_TOPIC_STORAGE_KEY, JSON\.stringify\(next\)\)/);
});

test("removing a card also clears its topic; cross-tab updates both collections", () => {
  assert.match(page, /readSavedCards\(\)\.reverse\(\)\.filter\(value => !sameCard\(value, card\)\)/);
  assert.match(page, /removeSavedTopic\(readSavedTopics\(\), card\)/);
  assert.match(page, /setTopicAssignments\(topics\)/);
  assert.match(page, /setSavedCards\(readSavedCards\(\)\)/);
  assert.match(page, /setTopicAssignments\(readSavedTopics\(\)\)/);
  assert.match(page, /window\.addEventListener\("storage", load\)/);
});

test("UI preserves existing Search, Categories, saved-card and publication contracts", () => {
  assert.match(page, /const storageKey = "lt:cards:v1"/);
  assert.match(page, /onSave=\{showSaved \? undefined : \(\) => save\(content\)\}/);
  assert.match(page, /onRemove=\{showSaved \? \(\) => removeSaved\(content\) : undefined\}/);
  assert.match(page, /<LearningCard key=\{id\}/);
  assert.match(page, /<Link href="\/categories"/);
  assert.doesNotMatch(page, /href="\/saved"/);
  assert.match(search, /const key = "lt:cards:v1"/);
  assert.equal((cardUI.match(/<details\b/g) || []).length, 4);
  assert.match(publicRoute, /status:"eq\.published"/);
  assert.doesNotMatch(page, /\/api\/cards\/generate|SUPABASE_SERVICE_ROLE_KEY/);
});
