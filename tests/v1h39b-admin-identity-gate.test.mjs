import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateAdminAccess, normalizeAdminUserId } from "../src/lib/admin/admin-access.mjs";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const serverGate = readFileSync(new URL("../src/lib/admin/server-admin-access.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/admin/access/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

test("invalid or missing administrator configuration always denies without identity lookup", async () => {
  let calls = 0;
  const verifyUser = async () => { calls++; return { id: ADMIN }; };
  for (const config of [
    { enabled: undefined, adminId: ADMIN },
    { enabled: "false", adminId: ADMIN },
    { enabled: "True", adminId: ADMIN },
    { enabled: "true", adminId: undefined },
    { enabled: "true", adminId: "" },
    { enabled: "true", adminId: "anyone" },
    { enabled: "true", adminId: ADMIN + "," + OTHER },
    { enabled: "true", adminId: " " + ADMIN },
  ]) {
    assert.equal(await evaluateAdminAccess({ ...config, accessToken: "trusted-session", verifyUser }), "disabled");
  }
  assert.equal(calls, 0);
});

test("a real server-verified administrator is granted access", async () => {
  const seen = [];
  const result = await evaluateAdminAccess({
    enabled: "true", adminId: ADMIN.toUpperCase(), accessToken: "trusted-session",
    verifyUser: async token => { seen.push(token); return { id: ADMIN }; },
  });
  assert.equal(result, "allowed");
  assert.deepEqual(seen, ["trusted-session"]);
});

test("no session and unverifiable identities always fail closed", async () => {
  const verifyUser = async () => null;
  const defaults = { enabled: "true", adminId: ADMIN, verifyUser };
  assert.equal(await evaluateAdminAccess({ ...defaults, accessToken: undefined }), "unauthenticated");
  assert.equal(await evaluateAdminAccess({ ...defaults, accessToken: "" }), "unauthenticated");
  assert.equal(await evaluateAdminAccess({ ...defaults, accessToken: "expired" }), "unauthenticated");
  assert.equal(await evaluateAdminAccess({
    ...defaults, accessToken: "valid",
    verifyUser: async () => { throw new Error("Supabase unavailable"); },
  }), "unauthenticated");
  assert.equal(await evaluateAdminAccess({
    ...defaults, accessToken: "valid", verifyUser: async () => ({ id: "attacker" }),
  }), "unauthenticated");
});

test("a signed-in non-admin is denied even with a valid Supabase identity", async () => {
  const result = await evaluateAdminAccess({
    enabled: "true", adminId: ADMIN, accessToken: "non-admin-session",
    verifyUser: async () => ({ id: OTHER }),
  });
  assert.equal(result, "forbidden");
});

test("admin UUID matching is exact and never based on email or metadata", () => {
  assert.equal(normalizeAdminUserId(ADMIN.toUpperCase()), ADMIN);
  for (const input of [null, undefined, "", "admin@example.com", ADMIN + ",", " " + ADMIN, OTHER + ADMIN]) {
    assert.equal(normalizeAdminUserId(input), null);
  }
});

test("server gate gets only the signed-in user's HttpOnly cookie and verifies with Supabase Auth", () => {
  assert.match(serverGate, /import "server-only"/);
  assert.match(serverGate, /request\.cookies\.get\("lt_auth_access"\)\?\.value/);
  assert.match(serverGate, /verifyUser: verifyGenerationUser/);
  assert.match(serverGate, /process\.env\.ENABLE_LEARNTRANSLATE_ADMIN/);
  assert.match(serverGate, /process\.env\.LEARNTRANSLATE_ADMIN_USER_ID/);
  assert.doesNotMatch(serverGate, /request\.headers\.get\("x-admin|request\.nextUrl\.searchParams/);
  // Inspect executable source, not security commentary that mentions unsafe
  // examples to warn maintainers never to rely on them.
  const executableGate = serverGate
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, "")
    .replace(/^\\s*\\/\\/.*$/gm, "");
  assert.doesNotMatch(executableGate, /SUPABASE_SERVICE_ROLE_KEY|user_metadata/);
});

test("admin endpoint is GET-only with no secrets and no cache", () => {
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /resolveAdminAccess\(request\)/);
  for (const status of [401, 403, 404]) assert.match(route, new RegExp('status: ' + status));
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /Vary: "Cookie"/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|Authorization:|search_key|content:/);
});

test("admin page is only an access-status shell, not a card editor", () => {
  assert.match(ui, /fetch\("\/api\/admin\/access"/);
  assert.match(ui, /state === "authorized"/);
  assert.doesNotMatch(ui, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_LEARNTRANSLATE_ADMIN_USER_ID/);
  assert.doesNotMatch(ui, /fetch\("\/rest\/v1\/cards"|fetch\("\/api\/admin\/cards"/);
});
