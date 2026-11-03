import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/cards/review-storage.ts", import.meta.url), "utf8");
test("review storage cannot be imported into browser bundles", () => {
  assert.match(source, /import "server-only"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
});
test("generated content is revalidated before persistence", () => {
  assert.match(source, /parseGeneratedCard\(input,/);
  assert.match(source, /makeCardSearchKey\(/);
});
test("review-only writes require a server-side flag and secret", () => {
  assert.match(source, /ENABLE_CARD_REVIEW_STORAGE/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /status: "review"/);
  assert.doesNotMatch(source, /status: "published"/);
});
test("duplicate keys are ignored and failures are explicit", () => {
  assert.match(source, /on_conflict/);
  assert.match(source, /resolution=ignore-duplicates/);
  assert.match(source, /if \(!response\.ok\)/);
});
