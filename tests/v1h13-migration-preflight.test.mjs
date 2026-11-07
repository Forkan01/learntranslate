import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync('docs/sql/v1h12-indexed-search-migration-candidate.sql','utf8');
const normalization=readFileSync('docs/sql/v1h7-lookup-published-card-fallback.sql','utf8');

test('migration requires a separately staged normalization helper',()=>{
 assert.match(sql,/public\.lookup_normalized_term\(/);
 assert.match(normalization,/create or replace function public\.lookup_normalized_term/);
 assert.doesNotMatch(sql,/create or replace function public\.lookup_normalized_term/);
});
test('derived index stays in private schema and is not granted to API roles',()=>{
 assert.match(sql,/create table if not exists private\.card_search_terms/);
 assert.match(sql,/alter table private\.card_search_terms enable row level security/);
 assert.match(sql,/revoke all on private\.card_search_terms from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant\s+(?:all|select|execute)\s+on\s+(?:private\.card_search_terms|function private\.lookup_card_ids)[^;]*\s+to\s+(?:anon|authenticated)/i);
});
test('index has equality columns and backfill does not mutate cards',()=>{
 assert.match(sql,/create index if not exists card_search_terms_lookup_idx/);
 assert.match(sql,/source_language,target_language,card_type,normalized_term,card_id/);
 assert.doesNotMatch(sql,/update\s+public\.cards\s+set/i);
 assert.match(sql,/on conflict do nothing/g);
});
test('unpublished cards are excluded from indexing',()=>{
 assert.match(sql,/new\.status <> 'published'/);
 assert.match(sql,/c\.status='published'/);
 assert.match(sql,/if tg_op='DELETE'/);
});
test('release must be blocked until SQL is executable and access checked',()=>{
 const review=readFileSync('docs/v1h12-migration-review.md','utf8');
 assert.match(review,/Not applied/i);
 assert.match(review,/staging/i);
 assert.match(review,/SECURITY DEFINER/i);
});
