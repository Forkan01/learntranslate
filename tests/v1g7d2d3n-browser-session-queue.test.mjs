import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/browser-session-queue.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { serializeSessionRequest } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const component = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
test("simultaneous session operations run in request order", async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = serializeSessionRequest(async () => { events.push("get-start"); await gate; events.push("get-end"); });
  const second = serializeSessionRequest(async () => { events.push("delete-start"); events.push("delete-end"); });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, ["get-start"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["get-start", "get-end", "delete-start", "delete-end"]);
});
test("a failed session request cannot permanently block sign-out", async () => {
  await assert.rejects(serializeSessionRequest(async () => { throw Error("offline"); }));
  assert.equal(await serializeSessionRequest(async () => "recovered"), "recovered");
});
test("SessionStatus uses the queue for GET and DELETE and invalidates stale UI updates", () => {
  assert.match(component, /serializeSessionRequest\(\(\) => fetch\("\/api\/auth\/session", \{ cache: "no-store", signal \}\)\)/);
  assert.match(component, /serializeSessionRequest\(\(\) => fetch\("\/api\/auth\/session", \{ method: "DELETE" \}\)\)/);
  assert.match(component, /epoch !== requestEpoch\.current/);
  assert.match(component, /requestEpoch\.current\+\+;/);
});
