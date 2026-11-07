import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync("src/app/api/cards/search/route.ts","utf8");
test("indexed RPC is disabled by default",()=>{
 assert.match(route,/process\.env\.CARD_INDEXED_SEARCH_ENABLED !== "true"/);
});
test("indexed RPC uses bounded request and never bypasses published-card predicate",()=>{
 assert.match(route,/lookup_published_card_indexed/);
 assert.match(route,/AbortSignal\.timeout\(4000\)/);
 assert.match(route,/\.find\(predicate\)/);
 assert.match(route,/candidate\.status !== "published"/);
});
test("RPC errors and misses retain existing paginated search",()=>{
 assert.match(route,/if \(!response\.ok\) return undefined/);
 assert.match(route,/if \(!match\) match = await findPublishedFallback\(reverseUrl/);
 assert.match(route,/if \(!match\) match = await findPublishedFallback\(germanUrl/);
});
