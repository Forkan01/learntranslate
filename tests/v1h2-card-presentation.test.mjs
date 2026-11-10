import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");

test("word grammar section preserves part of speech, article, and plural", () => {
  assert.match(ui, /Article: \{card\.grammar\.article\}/);
  assert.match(ui, /Plural: \{card\.grammar\.plural\}/);
  assert.match(ui, /\{card\.grammar\.partOfSpeech\}/);
});

test("examples accordion label reflects actual card type and curated count", () => {
  assert.match(ui, /Examples \(\{card\.type === "word" \? card\.examples\.length : card\.examples\?\.length \?\? 0\}\)/);
  assert.doesNotMatch(ui, /5 real-life examples/);
  assert.match(ui, /card\.examples\?\.map/);
});

test("sentence grammar and alternative expressions remain accessible in the new accordions", () => {
  assert.match(ui, /\{item\.note && <p[^>]*>\{item\.note\}<\/p>\}/);
  assert.match(ui, /\{item\.context && <p[^>]*>\{item\.context\}<\/p>\}/);
  assert.match(ui, /<h4 className="font-black">Word by word<\/h4>/);
  assert.match(ui, /<h4 className="font-black">Other ways to say it<\/h4>/);
  assert.match(ui, /Grammar breakdown/);
});
