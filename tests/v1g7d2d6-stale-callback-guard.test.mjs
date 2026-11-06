import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
const status = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
const marker = readFileSync(new URL("../src/lib/cards/browser-signout-intent.ts", import.meta.url), "utf8");
test("sign-out records intent before queued DELETE", () => {
  assert.match(status, /markSignOutIntent\(\);\s*requestEpoch\.current\+\+/);
});
test("callback checks sign-out marker inside serialized operation before POST", () => {
  assert.match(callback, /serializeSessionRequest\(\(\) => \{\s*if \(cancelled \|\| callbackIsStale\(initialSignOutMarker\)\)/);
  assert.match(callback, /callbackIsStale\(initialSignOutMarker\)[\s\S]*?return fetch\("\/api\/auth\/session"/);
});
test("marker never stores credentials and storage errors do not break sign-out", () => {
  assert.match(marker, /localStorage\.setItem\(KEY, crypto\.randomUUID\(\)\)/);
  assert.match(marker, /catch \{/);
});
