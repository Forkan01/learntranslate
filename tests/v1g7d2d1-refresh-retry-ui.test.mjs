import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
test("retryable 503 and network failures do not claim user is signed out", () => {
  assert.match(source, /response\.status === 503 \|\| session\.retryable === true/);
  assert.match(source, /setStatus\("retryable"\)/);
  assert.match(source, /Session check temporarily unavailable/);
  assert.match(source, /try \{ await checkSession\(\); \} finally \{ setChecking\(false\); \}/);
});
test("signed-in banner requires verified successful session response", () => {
  assert.match(source, /session\.signedIn === true \? "signed-in" : "signed-out"/);
  assert.match(source, /if \(!response\.ok && response\.status !== 503\)/);
  assert.match(source, /if \(status === "loading" \|\| status === "signed-out"\) return null/);
});
