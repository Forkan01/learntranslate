import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
test("logout attempts scoped Supabase revocation and does not expose credentials", () => {
  const logout = source.slice(source.indexOf("export async function DELETE("));
  assert.ok(logout.includes('"/auth/v1/logout?scope=local"'));
  assert.ok(logout.includes('Authorization: "Bearer " + access'));
  assert.ok(logout.includes("revoked = provider.ok"));
  assert.ok(logout.includes("serverRevoked: revoked"));
  assert.ok(logout.includes("clearCookies(response)"));
  assert.ok(logout.includes("allowSameOriginWrite(request)"));
  assert.ok(!logout.includes("refresh_token:"));
});
test("logout reports failed revocation separately from clearing browser cookies", () => {
  const logout = source.slice(source.indexOf("export async function DELETE("));
  assert.ok(logout.includes("revoked = false;"));
  assert.ok(logout.includes("catch {"));
  assert.ok(logout.indexOf("clearCookies(response)") > logout.indexOf("serverRevoked: revoked"));
});
