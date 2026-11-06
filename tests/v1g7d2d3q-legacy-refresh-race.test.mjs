import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
test("legacy provider 400/401/403 are classified separately", () => {
  assert.match(route, /response\.status === 400 \|\| response\.status === 401 \|\| response\.status === 403/);
  assert.match(route, /throw new InvalidRefreshCredentialError\(\)/);
});
test("legacy rejection preserves cookies and reports uncertain state", () => {
  const start = route.indexOf("if (error instanceof InvalidRefreshCredentialError)");
  const end = route.indexOf("// Network failures", start);
  assert.ok(start > 0 && end > start);
  const branch = route.slice(start, end);
  assert.match(branch, /retryable: true/);
  assert.match(branch, /status: 503/);
  assert.doesNotMatch(branch, /clearCookies|setCookies/);
});
test("explicit sign-out and missing refresh still clear cookies", () => {
  assert.match(route, /if \(!validRefresh\(refresh\)\)[\s\S]*?clearCookies\(response\)/);
  const deleteRoute = route.slice(route.indexOf("export async function DELETE"));
  assert.match(deleteRoute, /clearCookies\(response\)/);
});
