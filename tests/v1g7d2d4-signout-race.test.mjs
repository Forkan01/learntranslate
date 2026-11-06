import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
test("local sign-out invalidates older session checks", () => {
  assert.match(ui, /signingOut\.current = true;\s*requestEpoch\.current\+\+/);
  assert.match(ui, /epoch !== requestEpoch\.current \|\| signingOut\.current/);
});
test("duplicate sign-out is blocked and uncertain results are reconciled", () => {
  assert.match(ui, /if \(signingOut\.current\) return;/);
  assert.match(ui, /finally \{\s*signingOut\.current = false;[\s\S]*?void checkSession\(\)/);
});
test("remote sign-out messages still require server revalidation", () => {
  assert.match(ui, /subscribeSessionNotices\(\(\) => \{[\s\S]*?void checkSession\(\)/);
});
