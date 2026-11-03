import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
test("missing card gets distinct UI rather than a generic error", () => {
  assert.ok(ui.includes("else setMissing(true)"));
  assert.ok(ui.includes("No published card for"));
  assert.ok(ui.includes('href="/categories"'));
});
test("AI generation cannot be invoked from the public search interface", () => {
  assert.ok(ui.includes('disabled aria-disabled="true"'));
  assert.ok(ui.includes("Generate with AI · Coming soon"));
  assert.ok(!ui.includes('fetch("/api/cards/generate"'));
});
test("new searches clear stale missing-card state", () => {
  assert.ok(ui.includes("setMissing(false)"));
});
