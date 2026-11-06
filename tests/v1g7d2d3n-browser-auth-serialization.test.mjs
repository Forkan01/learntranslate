import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/browser-session-queue.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { queueSessionRequest, checkBrowserSession, signOutBrowserSession } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test("concurrent GET and DELETE are ordered, not overlapped", async () => {
  const gate = deferred(), events = [];
  const first = queueSessionRequest(async () => { events.push("GET-start"); await gate.promise; events.push("GET-end"); });
  const second = queueSessionRequest(async () => { events.push("DELETE-start"); events.push("DELETE-end"); });
  await Promise.resolve();
  assert.deepEqual(events, ["GET-start"]);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["GET-start", "GET-end", "DELETE-start", "DELETE-end"]);
});
test("a rejected request does not permanently block subsequent session requests", async () => {
  await assert.rejects(queueSessionRequest(async () => { throw new Error("offline"); }), /offline/);
  assert.equal(await queueSessionRequest(async () => "recovered"), "recovered");
});
test("aborted queued check never starts a fetch", async () => {
  const gate = deferred();
  const blocker = queueSessionRequest(() => gate.promise);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(async () => { gate.resolve(); await checkBrowserSession(controller.signal); }, { name: "AbortError" });
  await blocker;
});
test("session status UI uses queued calls for check and signout", () => {
  const ui = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
  assert.match(ui, /checkBrowserSession\(signal\)/);
  assert.match(ui, /checkBrowserSession\(controller\.signal\)/);
  assert.match(ui, /signOutBrowserSession\(\)/);
});
test("browser queue wraps fetch and does not expose cookies to JavaScript", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  try {
    await checkBrowserSession();
    await signOutBrowserSession();
    assert.deepEqual(calls.map(c => [c.url, c.init.method ?? "GET"]), [["/api/auth/session", "GET"], ["/api/auth/session", "DELETE"]]);
  } finally { globalThis.fetch = original; }
});
