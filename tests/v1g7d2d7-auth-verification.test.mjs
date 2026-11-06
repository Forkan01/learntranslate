import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/browser-signout-intent.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { signOutMarker, markSignOutIntent, callbackIsStale } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
function mockBrowser(windowValue, cryptoValue) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowValue });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: cryptoValue });
  return () => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else Reflect.deleteProperty(globalThis, "crypto");
  };
}
test("callback marker becomes stale after sign-out intent", () => {
  const store = new Map();
  const restore = mockBrowser({ localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  } }, { randomUUID: () => "unique-marker" });
  try {
    const initial = signOutMarker();
    assert.equal(callbackIsStale(initial), false);
    markSignOutIntent();
    assert.equal(callbackIsStale(initial), true);
    assert.equal(callbackIsStale(signOutMarker()), false);
    assert.equal(store.size, 1);
    assert.equal([...store.values()][0], "unique-marker");
  } finally { restore(); }
});
test("storage denial does not throw or assert a false marker change", () => {
  const restore = mockBrowser({ localStorage: {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  } }, { randomUUID: () => "unused" });
  try {
    assert.equal(signOutMarker(), null);
    assert.doesNotThrow(markSignOutIntent);
    assert.equal(callbackIsStale(null), false);
  } finally { restore(); }
});
