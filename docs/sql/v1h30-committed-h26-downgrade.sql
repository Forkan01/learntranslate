-- V1-H.30: ONLY for disposable database after H.26 installation.
-- Committed downgrade of H.26; H.12 private index remains intact.
begin;
drop trigger if exists zzz_cards_sync_published_search_terms on public.cards;
drop function if exists private.sync_published_card_search_terms();
drop table if exists public.published_card_search_terms;
-- Restore H.16 function separately, using the exact versioned definition.
commit;
\i docs/sql/v1h16-published-indexed-rpc.sql
