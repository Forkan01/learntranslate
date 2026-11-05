import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
async function load(path) {
 const source=readFileSync(new URL(path,import.meta.url),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const crypto=await load("../src/lib/cards/refresh-handoff-crypto.ts");
const redis=await load("../src/lib/cards/refresh-redis-protocol.ts");
const priorId=process.env.SESSION_REFRESH_IDENTITY_KEY,priorKey=process.env.SESSION_REFRESH_HANDOFF_KEY;
test("missing secrets fail closed",()=>{
 delete process.env.SESSION_REFRESH_IDENTITY_KEY;delete process.env.SESSION_REFRESH_HANDOFF_KEY;
 assert.equal(crypto.refreshIdentity("sample"),null);
 assert.equal(crypto.encryptRefreshHandoff("a".repeat(64),{access:"a",refresh:"r",expires:3600}),null);
});
test("identity is deterministic and handoff encrypted, bound and tamper-evident",()=>{
 process.env.SESSION_REFRESH_IDENTITY_KEY="11".repeat(32);
 process.env.SESSION_REFRESH_HANDOFF_KEY="22".repeat(32);
 const id=crypto.refreshIdentity("refresh-secret");
 assert.equal(id,crypto.refreshIdentity("refresh-secret"));
 assert.notEqual(id,crypto.refreshIdentity("different-secret"));
 const pair={access:"access-secret",refresh:"refresh-secret",expires:3600};
 const envelope=crypto.encryptRefreshHandoff(id,pair);
 assert.ok(envelope);assert.ok(!JSON.stringify(envelope).includes("refresh-secret"));
 assert.deepEqual(crypto.decryptRefreshHandoff(id,envelope),pair);
 assert.equal(crypto.decryptRefreshHandoff("a".repeat(64),envelope),null);
 assert.equal(crypto.decryptRefreshHandoff(id,{...envelope,ciphertext:envelope.ciphertext.slice(0,-2)+"xx"}),null);
});
test("redis keys validate identity and scripts enforce ownership",()=>{
 assert.equal(redis.refreshRedisKeys("bad"),null);
 const keys=redis.refreshRedisKeys("a".repeat(64));
 assert.ok(keys.lease.endsWith(":lease"));
 assert.ok(keys.handoff.endsWith(":handoff"));
 assert.match(redis.REFRESH_PUBLISH_LUA,/GET.*ARGV\[1\]/);
 assert.match(redis.REFRESH_RELEASE_LUA,/GET.*ARGV\[1\]/);
 assert.equal(redis.REFRESH_HANDOFF_TTL_MS,15000);
});
test.after(()=>{
 if(priorId===undefined)delete process.env.SESSION_REFRESH_IDENTITY_KEY;else process.env.SESSION_REFRESH_IDENTITY_KEY=priorId;
 if(priorKey===undefined)delete process.env.SESSION_REFRESH_HANDOFF_KEY;else process.env.SESSION_REFRESH_HANDOFF_KEY=priorKey;
});
