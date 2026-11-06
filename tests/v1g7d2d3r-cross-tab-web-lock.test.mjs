import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/browser-session-queue.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { serializeSessionRequest } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
// Node.js may expose navigator as a getter-only global. Override its descriptor
// for each test and restore it exactly, including when an assertion fails.
function mockNavigator(value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value });
  return () => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  };
}
test("Web Lock holds until request resolves and serializes concurrent operations", async () => {
  const calls = [];
  let lockTail = Promise.resolve();
  const restoreNavigator = mockNavigator({ locks: { request: (name, options, callback) => {
    assert.equal(name, "lt:auth:session-cookie-operations:v1");
    assert.equal(options.mode, "exclusive");
    const result = lockTail.then(callback);
    lockTail = result.then(() => undefined, () => undefined);
    return result;
  } } });
  try {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = serializeSessionRequest(async () => { calls.push("first-start"); await gate; calls.push("first-end"); });
    const second = serializeSessionRequest(async () => { calls.push("second"); });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(calls, ["first-start"]);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(calls, ["first-start", "first-end", "second"]);
  } finally { restoreNavigator(); }
});
test("lock failures propagate, subsequent operations can recover", async () => {
  let fail = true;
  const restoreNavigator = mockNavigator({ locks: { request: async (_name, _opts, cb) => {
    if (fail) { fail = false; throw new Error("lock denied"); }
    return cb();
  } } });
  try {
    await assert.rejects(serializeSessionRequest(async () => "should not execute"), /lock denied/);
    assert.equal(await serializeSessionRequest(async () => "ok"), "ok");
  } finally { restoreNavigator(); }
});
test("callback POST uses same queue as GET and DELETE", () => {
  const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
  assert.match(callback, /serializeSessionRequest\(\(\) => \{[\s\S]*?return fetch\("\/api\/auth\/session"/);
  assert.match(status, /serializeSessionRequest\(\(\) => fetch\("\/api\/auth\/session"/);
});
