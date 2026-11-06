import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/browser-session-notices.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { announceSignOut, subscribeSessionNotices } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const component = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");

test("cross-tab notice is token-free and triggers only for sign-out", () => {
  const previous = globalThis.BroadcastChannel;
  const channels = [];
  class FakeChannel {
    constructor(name) { this.name = name; channels.push(this); }
    postMessage(value) { for (const c of channels) if (c !== this && c.name === this.name) c.onmessage?.({ data: value }); }
    close() { const index = channels.indexOf(this); if (index >= 0) channels.splice(index, 1); }
  }
  globalThis.BroadcastChannel = FakeChannel;
  try {
    let notices = 0;
    const unsubscribe = subscribeSessionNotices(() => notices++);
    announceSignOut();
    assert.equal(notices, 1);
    channels[0].onmessage({ data: { accessToken: "untrusted" } });
    assert.equal(notices, 1);
    unsubscribe();
    announceSignOut();
    assert.equal(notices, 1);
  } finally { globalThis.BroadcastChannel = previous; }
});
test("missing BroadcastChannel fails gracefully", () => {
  const previous = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  try { assert.doesNotThrow(() => { announceSignOut(); subscribeSessionNotices(() => {})(); }); }
  finally { globalThis.BroadcastChannel = previous; }
});
test("UI rechecks server after notices and visibility changes", () => {
  assert.match(component, /subscribeSessionNotices\(\(\) => \{/);
  assert.match(component, /document\.visibilityState === "visible"/);
  assert.match(component, /if \(response\.ok\) \{[\s\S]*?announceSignOut\(\)/);
});
