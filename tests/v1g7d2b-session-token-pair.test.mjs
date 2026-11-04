import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
const helper = readFileSync(new URL("../src/lib/cards/bind-session-token-pair.ts", import.meta.url), "utf8");
test("session POST persists only verified rotated credentials", () => {
  const post = route.slice(route.indexOf("export async function POST("), route.indexOf("export async function GET("));
  assert.ok(post.includes("await bindSessionTokenPair(access, refresh, config)"));
  assert.ok(post.includes("setCookies(response, bound.access, bound.refresh, bound.expires)"));
  assert.ok(!post.includes("setCookies(response, access, refresh, expires)"));
});
test("binding checks both identities and rejects refresh mismatch", () => {
  assert.ok(helper.includes("await verifyGenerationUser(access)"));
  assert.ok(helper.includes('grant_type=refresh_token'));
  assert.ok(helper.includes("await verifyGenerationUser(tokens.access_token)"));
  assert.ok(helper.includes("refreshed.id !== original.id"));
  assert.ok(helper.includes("if (!response.ok) return null"));
  assert.ok(helper.includes("return { access: tokens.access_token, refresh: tokens.refresh_token, expires: tokens.expires_in }"));
});
