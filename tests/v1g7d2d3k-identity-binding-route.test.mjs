import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
test("identity cookie is HttpOnly and removed on logout", () => {
  assert.match(route, /const IDENTITY = "lt_auth_identity"/);
  assert.match(route, /response\.cookies\.set\(IDENTITY, "", \{ \.\.\.COOKIE, maxAge: 0 \}\)/);
  assert.match(route, /result\.cookies\.set\(IDENTITY, newBinding, \{ \.\.\.COOKIE/);
});
test("distributed refresh requires valid original binding and matching Supabase user", () => {
  assert.match(route, /verifySessionIdentityBinding\(request\.cookies\.get\(IDENTITY\)\?\.value \?\? "", refresh\)/);
  assert.match(route, /if \(!expectedUserId\)/);
  assert.match(route, /\(await verifyGenerationUser\(pair\.access\)\)\?\.id === expectedUserId/);
});
test("rotated refresh token receives a fresh binding; legacy path remains", () => {
  assert.match(route, /issueSessionIdentityBinding\(expectedUserId, decision\.refresh\)/);
  assert.match(route, /await setIdentityBinding\(result, tokens\.access, tokens\.refresh\)/);
  assert.match(route, /singleFlightRefresh\(refresh/);
});
