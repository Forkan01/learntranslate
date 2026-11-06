import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/session-recovery-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { interpretSessionResponse } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
test("confirmed signed-in and signed-out are distinct", () => {
  assert.equal(interpretSessionResponse(200, { signedIn: true }), "signed-in");
  assert.equal(interpretSessionResponse(200, { signedIn: false }), "signed-out");
});
test("network/proxy/provider failures do not become signed-out", () => {
  for (const status of [401, 403, 429, 500, 502, 503, 504]) {
    assert.equal(interpretSessionResponse(status, { signedIn: false }), "retryable");
  }
});
test("missing, malformed and ambiguous payloads never assert signed-out", () => {
  for (const value of [null, [], {}, "offline", { signedIn: 0 }, { signedIn: "false" }]) {
    assert.equal(interpretSessionResponse(200, value), "retryable");
  }
  assert.equal(interpretSessionResponse(200, { signedIn: false, retryable: true }), "retryable");
});
test("session component uses shared interpretation", () => {
  const ui = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
  assert.match(ui, /setStatus\(interpretSessionResponse\(response\.status, data\)\)/);
});
