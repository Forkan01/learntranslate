import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
const decisionSource = readFileSync(new URL("../src/lib/cards/session-recovery-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(decisionSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { interpretSessionResponse } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("retryable 503 and network failures do not claim user is signed out", () => {
  assert.equal(interpretSessionResponse(503, { signedIn: false }), "retryable");
  assert.equal(interpretSessionResponse(500, { signedIn: false }), "retryable");
  assert.equal(interpretSessionResponse(200, { signedIn: false, retryable: true }), "retryable");
  assert.match(source, /setStatus\("retryable"\)/);
  assert.match(source, /Session check temporarily unavailable/);
  assert.match(source, /try \{ await checkSession\(\); \} finally \{ setChecking\(false\); \}/);
});
test("signed-in banner requires verified successful session response", () => {
  assert.equal(interpretSessionResponse(200, { signedIn: true }), "signed-in");
  assert.equal(interpretSessionResponse(401, { signedIn: true }), "retryable");
  assert.equal(interpretSessionResponse(200, { signedIn: false }), "signed-out");
  assert.match(source, /setStatus\(interpretSessionResponse\(response\.status, data\)\)/);
  assert.match(source, /if \(status === "loading" \|\| status === "signed-out"\) return null/);
});
