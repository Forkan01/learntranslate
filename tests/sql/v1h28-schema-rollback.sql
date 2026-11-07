\set ON_ERROR_STOP on
-- Rehearse schema downgrade inside a transaction; ROLLBACK restores it.
-- Must execute after H.26 and H.27, before large dataset benchmark.
begin;
drop trigger zzz_cards_sync_published_search_terms on public.cards;
drop function private.sync_published_card_search_terms();
drop policy published_terms_visible on public.published_card_search_terms;
drop table public.published_card_search_terms;
-- Restore H.16 RPC definition as a downgrade rehearsal (not an approved production rollback).
\i docs/sql/v1h16-published-indexed-rpc.sql
DO $$ BEGIN
 if not (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then
 raise exception 'Downgrade RPC definition not restored'; end if;
 if to_regclass('public.published_card_search_terms') is not null then raise exception 'Derived table survived downgrade'; end if;
END $$;
rollback;
DO $$ BEGIN
 if to_regclass('public.published_card_search_terms') is null then raise exception 'Rollback did not restore table'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.cards'::regclass and tgname='zzz_cards_sync_published_search_terms' and not tgisinternal) then raise exception 'Rollback did not restore trigger'; end if;
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'Rollback did not restore invoker RPC'; end if;
END $$;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Rollback broke search'; end if;
END $$;
reset role;
