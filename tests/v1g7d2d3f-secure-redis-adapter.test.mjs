import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/secure-redis-refresh-adapter.ts", import.meta.url), "utf8");
test("adapter compiles as TypeScript", () => {
  const output = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  assert.equal(output.diagnostics?.length ?? 0, 0);
});
test("both provider and handoff credentials require trusted verification", () => {
  assert.match(source, /if \(!pair \|\| !await inputs\.verifyPair\(pair\)\)/);
  assert.match(source, /if \(!await inputs\.verifyPair\(pair\)\)/);
});
test("Redis handoff is encrypted and identity is opaque", () => {
  assert.match(source, /refreshIdentity\(inputs\.refreshToken\)/);
  assert.match(source, /encryptRefreshHandoff\(id, pair\)/);
  assert.match(source, /decryptRefreshHandoff\(id, parsed as HandoffEnvelope\)/);
  assert.match(source, /publishRefreshHandoff\(lease, JSON\.stringify\(envelope\)\)/);
});
test("adapter is not wired to live auth route", () => {
  const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /coordinateSecureRedisRefresh/);
});
