import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");

test("suggestions are chosen from the selected source language", () => {
  assert.ok(ui.includes('source === "de" ? ["Gespräch", "Bewerbung", "Gewohnheiten"] : ["habit", "conversation", "rent"]'));
});
test("suggestion click does not change search direction", () => {
  const click = ui.split('.map(x => <button key={x} type="button" onClick=')[1]?.split('className=')[0] ?? "";
  assert.ok(click.includes('setTerm(x)'));
  assert.ok(!click.includes('setSource('));
});
test("changing direction clears stale search state", () => {
  assert.ok(ui.includes('setTerm("");setResult(null);setNotice("");setSaved(false);'));
});
