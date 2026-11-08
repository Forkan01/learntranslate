import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const starterPath = fileURLToPath(new URL("../data/vocabulary/starter.json", import.meta.url));
const draftScript = fileURLToPath(new URL("../scripts/create-card-draft.mjs", import.meta.url));
const importScript = fileURLToPath(new URL("../scripts/build-vocabulary-import.mjs", import.meta.url));

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

function withFixture(cards, fn) {
  const dir = mkdtempSync(join(tmpdir(), "lt-h39a-"));
  const path = join(dir, "cards.json");
  try {
    writeFileSync(path, JSON.stringify(cards));
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("manual German word template has five placeholders and explicit article only", () => {
  const result = run(draftScript, ["word", "die Entscheidung", "work-career"]);
  assert.equal(result.status, 0, result.stderr);
  const [entry] = JSON.parse(result.stdout);
  assert.deepEqual(entry.categories, ["work-career"]);
  assert.equal(entry.content.type, "word");
  assert.equal(entry.content.grammar.article, "die");
  assert.equal(entry.content.grammar.plural, "");
  assert.equal(entry.content.examples.length, 5);
  assert.equal(entry.content.translation, "");
});

test("manual sentence template and English source keep direction explicit", () => {
  const sentence = run(draftScript, ["sentence", "Ich hätte gern einen Termin.", "conversations"]);
  assert.equal(sentence.status, 0, sentence.stderr);
  const [entry] = JSON.parse(sentence.stdout);
  assert.equal(entry.content.type, "sentence");
  assert.equal(entry.content.naturalMeaning, "");
  const english = run(draftScript, ["word", "habit", "daily-life", "en"]);
  assert.equal(english.status, 0, english.stderr);
  const [en] = JSON.parse(english.stdout);
  assert.equal(en.content.sourceLanguage, "en");
  assert.equal(en.content.targetLanguage, "de");
  assert.equal(en.content.grammar.partOfSpeech, "other");
});

test("unfinished manual draft cannot be imported accidentally", () => {
  const draft = run(draftScript, ["word", "die Entscheidung", "work-career"]);
  assert.equal(draft.status, 0, draft.stderr);
  withFixture(JSON.parse(draft.stdout), path => {
    const result = run(importScript, [path, "--check"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid translation/);
  });
});

test("existing starter validates without creating SQL or touching Supabase", () => {
  const result = run(importScript, [starterPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Valid: 2 review cards across 2 categories\. No SQL executed\./);
  assert.doesNotMatch(result.stdout, /BEGIN;|INSERT INTO|UPDATE|DELETE/);
});

test("import SQL is transactional, review-only, and protects already-published duplicates", () => {
  const result = run(importScript, [starterPath]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /BEGIN;/);
  assert.match(result.stdout, /COMMIT;/);
  assert.match(result.stdout, /Unknown LearnTranslate category/);
  assert.match(result.stdout, /WITH inserted AS \(/);
  assert.match(result.stdout, /ON CONFLICT \(search_key\) DO NOTHING RETURNING id/);
  assert.match(result.stdout, /SELECT inserted\.id, cat\.id FROM inserted/);
  assert.match(result.stdout, /'review'/);
  assert.doesNotMatch(result.stdout, /UPDATE public\.cards|DELETE FROM public\.cards|SET status = 'published'/);
  assert.doesNotMatch(result.stdout, /SELECT c\.id, cat\.id FROM public\.cards/);
});

test("special characters in terms are SQL-escaped", () => {
  const cards = JSON.parse(readFileSync(starterPath, "utf8"));
  cards[0].content.term = "die O'Connor-Absicht";
  withFixture(cards, path => {
    const result = run(importScript, [path]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /die O''Connor-Absicht/);
    assert.match(result.stdout, /SET LOCAL standard_conforming_strings = on;/);
  });
});

test("duplicate lookup keys in a single import are rejected", () => {
  const [card] = JSON.parse(readFileSync(starterPath, "utf8"));
  withFixture([card, structuredClone(card)], path => {
    const result = run(importScript, [path]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate search key/);
  });
});

test("invalid category slugs, missing German noun metadata, and invalid drafts fail closed", () => {
  const [original] = JSON.parse(readFileSync(starterPath, "utf8"));
  for (const mutate of [
    card => { card.categories = ["conversations'); DROP TABLE public.cards;--"]; },
    card => { delete card.content.grammar.article; },
    card => { card.content.examples[0].source = ""; },
  ]) {
    const card = structuredClone(original);
    mutate(card);
    withFixture([card], path => {
      const result = run(importScript, [path]);
      assert.notEqual(result.status, 0, "malformed content was accepted");
    });
  }
});
