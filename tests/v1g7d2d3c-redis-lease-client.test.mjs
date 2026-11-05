import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/lib/cards/refresh-redis-client.ts",import.meta.url),"utf8");
test("lease is acquired atomically with bounded expiry",()=>{
 assert.match(source,/\["SET", keys\.lease, owner, "NX", "PX", REFRESH_LEASE_TTL_MS\]/);
 assert.match(source,/randomBytes\(24\)/);
 assert.match(source,/result === null\) return null/);
});
test("handoff publication and release use ownership-fenced scripts",()=>{
 assert.match(source,/\["EVAL", REFRESH_PUBLISH_LUA, 2, keys\.lease, keys\.handoff/);
 assert.match(source,/\["EVAL", REFRESH_RELEASE_LUA, 1, keys\.lease, lease\.owner\]/);
 assert.match(source,/REFRESH_HANDOFF_TTL_MS/);
});
test("all commands fail closed and avoid caching",()=>{
 assert.match(source,/response\.ok\) throw/);
 assert.match(source,/parsed\.error !== undefined/);
 assert.match(source,/cache: "no-store"/);
 assert.match(source,/AbortSignal\.timeout\(3500\)/);
 assert.doesNotMatch(source,/console\.(log|error)/);
});
