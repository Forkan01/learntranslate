import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(path, replacements = {}) {
  let js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(replacements)) js = js.replaceAll(from, to);
  return "data:text/javascript;base64," + Buffer.from(js).toString("base64");
}
const cryptoUrl = load("../src/lib/cards/refresh-handoff-crypto.ts");
const bindingUrl = load("../src/lib/cards/session-identity-binding.ts", { '"./refresh-handoff-crypto"': JSON.stringify(cryptoUrl) });
const { issueSessionIdentityBinding, verifySessionIdentityBinding } = await import(bindingUrl);
const original = { identity: process.env.SESSION_REFRESH_IDENTITY_KEY, binding: process.env.SESSION_IDENTITY_BINDING_KEY };
process.env.SESSION_REFRESH_IDENTITY_KEY = "11".repeat(32);
process.env.SESSION_IDENTITY_BINDING_KEY = "33".repeat(32);
const userA = "123e4567-e89b-42d3-a456-426614174000";
const userB = "123e4567-e89b-42d3-a456-426614174001";
test("binding authenticates verified user and exact refresh credential", () => {
  const token = issueSessionIdentityBinding(userA, "refresh-A", 10000);
  assert.ok(token);
  assert.equal(verifySessionIdentityBinding(token, "refresh-A", 10001), userA);
  assert.equal(verifySessionIdentityBinding(token, "refresh-B", 10001), null);
});
test("tampering, expiration and future timestamps fail closed", () => {
  const token = issueSessionIdentityBinding(userB, "refresh-B", 10000);
  assert.equal(verifySessionIdentityBinding(token.slice(0, -2) + "xx", "refresh-B", 10001), null);
  assert.equal(verifySessionIdentityBinding(token, "refresh-B", 10000 + 7 * 86400 + 1), null);
  assert.equal(verifySessionIdentityBinding(token, "refresh-B", 9999), null);
});
test("missing secrets and malformed identities cannot issue or verify", () => {
  const token = issueSessionIdentityBinding(userA, "refresh-A", 10000);
  assert.equal(issueSessionIdentityBinding("not-a-user", "refresh-A", 10000), null);
  delete process.env.SESSION_IDENTITY_BINDING_KEY;
  assert.equal(issueSessionIdentityBinding(userA, "refresh-A", 10000), null);
  assert.equal(verifySessionIdentityBinding(token, "refresh-A", 10000), null);
  process.env.SESSION_IDENTITY_BINDING_KEY = "33".repeat(32);
});
test("identity binding is not yet wired to live auth", () => {
  const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  assert.match(route, /issueSessionIdentityBinding|verifySessionIdentityBinding/);
});
test.after(() => {
  for (const [name, value] of [["SESSION_REFRESH_IDENTITY_KEY", original.identity], ["SESSION_IDENTITY_BINDING_KEY", original.binding]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
