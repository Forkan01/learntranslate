-- V1-H.25: Stage narrow partial indexes for the RLS-respecting invoker RPC.
-- No production execution. Indexes speed candidate selection; reverse-sense splitting
-- still requires per-candidate work, so benchmark before activating.
begin;
create index if not exists cards_v1h25_published_lookup_idx
 on public.cards (type,source_language,target_language,term,id)
 where status='published';
create index if not exists cards_v1h25_published_german_term_idx
 on public.cards (public.lookup_normalized_term(content->>'term'))
 where status='published' and type='word' and source_language='de' and target_language='en';
create index if not exists cards_v1h25_published_german_plural_idx
 on public.cards (public.lookup_normalized_term(content->'grammar'->>'plural'))
 where status='published' and type='word' and source_language='de' and target_language='en';
commit;
