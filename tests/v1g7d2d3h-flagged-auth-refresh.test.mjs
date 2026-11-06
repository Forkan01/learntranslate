import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
test("distributed refresh requires explicit opt-in; legacy path remains", () => {
  assert.match(route, /process\.env\.ENABLE_DISTRIBUTED_SESSION_REFRESH === "true"/);
  assert.match(route, /singleFlightRefresh\(refresh/);
});
test("opt-in path verifies credentials and never clears cookies on coordination failure", () => {
  const start = route.indexOf('if (process.env.ENABLE_DISTRIBUTED_SESSION_REFRESH === "true")');
  const end = route.indexOf("  try {\n    const tokens = await singleFlightRefresh", start);
  assert.ok(start > 0 && end > start);
  const branch = route.slice(start, end);
  assert.match(branch, /verifyGenerationUser\(pair\.access\)/);
  assert.match(branch, /decideDistributedRefresh\(outcome\)/);
  assert.match(branch, /retryable: true/);
  assert.doesNotMatch(branch, /clearCookies\(/);
  assert.match(branch, /setCookies\(result, decision\.access/);
});
