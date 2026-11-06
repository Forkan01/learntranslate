import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/lib/cards/distributed-refresh-decision.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { decideDistributedRefresh } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const pair = { access: "new-access", refresh: "new-refresh", expires: 3600 };

test("retryable result never authorizes Set-Cookie", () => {
  assert.deepEqual(decideDistributedRefresh({ kind: "retryable" }), { kind: "retryable" });
  assert.match(route, /if \(decision\.kind !== "set"\)[\s\S]*?status: 503/);
});
test("successful handoff must still bind newly rotated token to expected user", () => {
  assert.deepEqual(decideDistributedRefresh({ kind: "success", pair }), { kind: "set", ...pair });
  assert.match(route, /verifyPair: async \(pair\) => \(await verifyGenerationUser\(pair\.access\)\)\?\.id === expectedUserId/);
  assert.match(route, /issueSessionIdentityBinding\(expectedUserId, decision\.refresh\)/);
});
test("malformed provider results cannot issue cookies", () => {
  for (const bad of [{ ...pair, expires: 0 }, { ...pair, refresh: "" }, { ...pair, access: "" }, { ...pair, expires: NaN }]) {
    assert.deepEqual(decideDistributedRefresh({ kind: "success", pair: bad }), { kind: "retryable" });
  }
});
test("legacy rejected refresh is retryable without clearing cookies", () => {
  const start = route.indexOf("if (error instanceof InvalidRefreshCredentialError)");
  const end = route.indexOf("// Network failures", start);
  assert.ok(start > 0 && end > start);
  const branch = route.slice(start, end);
  assert.match(branch, /retryable: true/);
  assert.match(branch, /status: 503/);
  assert.doesNotMatch(branch, /clearCookies/);
});
