-- V1-H.32 safer release candidate: keep private term index private.
-- No public search-term table, no SECURITY DEFINER public RPC.
-- The existing private.card_search_terms is retained but not exposed.
-- Requires published-only SELECT policy on public.cards (review live policy first).
\i docs/sql/v1h24-invoker-rpc-candidate.sql
\i docs/sql/v1h25-invoker-search-indexes.sql
