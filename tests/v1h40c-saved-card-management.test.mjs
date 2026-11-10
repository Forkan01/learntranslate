import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const search = read("../src/app/search/page.tsx");
const categories = read("../src/app/categories/page.tsx");
const card = read("../src/app/categories/LearningCard.tsx");
const categoryApi = read("../src/app/api/categories/route.ts");

test("Search recognizes previously saved Word and Sentence Cards by stable identity", () => {
  assert.match(search, /function alreadySaved\(card: LearningCardContent\): boolean/);
  assert.match(search, /localStorage\.getItem\("lt:cards:v1"\)/);
  for (const property of ["term", "type", "sourceLanguage"]) {
    assert.ok(search.includes("(value as LearningCardContent)." + property + " === card." + property));
  }
  assert.match(search, /setSaved\(alreadySaved\(found\.content\)\)/);
  assert.match(search, /setResult\(\{ \.\.\.found, searchedSource: source, searchedTerm: submittedTerm \}\)/);
  assert.match(search, /✓ Saved on this device/);
});

test("Saved collection can remove an individual card through accessible UI", () => {
  assert.match(card, /onRemove\?: \(\) => void/);
  assert.match(card, /\{onRemove && <div/);
  assert.match(card, /onClick=\{onRemove\}/);
  assert.match(card, /Remove from saved/);
  assert.match(card, /aria-label=\{\`Remove \$\{card\.term\} from saved cards\`\}/);
  assert.match(categories, /onRemove=\{showSaved \? \(\) => removeSaved\(content\) : undefined\}/);
});

test("Remove filters only matching card identity and persists remaining browser cards", () => {
  assert.match(categories, /function removeSaved\(card: LearningCardContent\)/);
  assert.match(categories, /readSavedCards\(\)\.reverse\(\)\.filter\(value => !sameCard\(value, card\)\)/);
  assert.match(categories, /localStorage\.setItem\(storageKey, JSON\.stringify\(next\)\)/);
  assert.match(categories, /setSavedCards\(\[\.\.\.next\]\.reverse\(\)\)/);
  assert.match(categories, /setExpanded\(null\)/);
  assert.match(categories, /Card removed from this device/);
  assert.match(categories, /Removing this card is unavailable/);
});

test("The Save contract and both public navigation options stay unchanged", () => {
  assert.match(search, /const key = "lt:cards:v1"/);
  assert.match(categories, /const storageKey = "lt:cards:v1"/);
  assert.match(categories, /function save\(card: LearningCardContent\)/);
  assert.match(categories, /onSave=\{showSaved \? undefined : \(\) => save\(content\)\}/);
  assert.match(categories, /<Link href="\/"/);
  assert.match(categories, /<Link href="\/categories"/);
  assert.doesNotMatch(categories, /href="\/saved"/);
});

test("No API, database, AI generation or user authentication changes are introduced", () => {
  assert.match(categoryApi, /status:"eq\.published"/);
  assert.doesNotMatch(categories, /\/api\/cards\/generate/);
  assert.doesNotMatch(card, /\/api\/admin\//);
  assert.doesNotMatch(categories, /SUPABASE_SERVICE_ROLE_KEY/);
});
