import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../src/app/search/SessionStatus.tsx", import.meta.url), "utf8");
test("revalidates on network restoration and removes listener on unmount", () => {
  assert.match(ui, /const onOnline = \(\) => \{ void checkSession\(\); \};/);
  assert.match(ui, /window\.addEventListener\("online", onOnline\)/);
  assert.match(ui, /window\.removeEventListener\("online", onOnline\)/);
});
test("session revalidation still rejects stale results and uncertain failures", () => {
  assert.match(ui, /epoch !== requestEpoch\.current \|\| signingOut\.current/);
  assert.match(ui, /setStatus\("retryable"\)/);
  assert.match(ui, /serializeSessionRequest\(\(\) => fetch\("\/api\/auth\/session"/);
});
