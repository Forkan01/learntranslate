import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
test("word summary separates part of speech, article, and plural", () => {
  assert.match(ui, /Article: \{card\.grammar\.article\}/);
  assert.match(ui, /Plural: \{card\.grammar\.plural\}/);
  assert.match(ui, /\{card\.grammar\.partOfSpeech\}/);
});
test("examples label reflects actual card count", () => {
  assert.match(ui, /Real-life examples \(\{card\.examples\.length\}\)/);
  assert.doesNotMatch(ui, /5 real-life examples/);
});
test("sentence details retain optional explanatory notes and remain collapsible", () => {
  assert.match(ui, /\{item\.note && <p[^>]*>\{item\.note\}<\/p>\}/);
  assert.match(ui, /\{item\.context && <p[^>]*>\{item\.context\}<\/p>\}/);
  assert.match(ui, /<summary[^>]*>Word by word<\/summary>/);
  assert.match(ui, /<summary[^>]*>Other ways to say it<\/summary>/);
});
