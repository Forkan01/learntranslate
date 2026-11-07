\set ON_ERROR_STOP on
-- Requires H.26 installed. The downgrade commits; no outer rollback.
DO $$ BEGIN
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'Expected H26 invoker before downgrade'; end if;
END $$;
\i docs/sql/v1h30-committed-h26-downgrade.sql
DO $$ BEGIN
 if to_regclass('public.published_card_search_terms') is not null then raise exception 'Downgrade table still exists'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.cards'::regclass and tgname='zzz_cards_sync_published_search_terms' and not tgisinternal) then raise exception 'Downgrade trigger still exists'; end if;
 if not (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'H16 RPC not restored'; end if;
 if (select count(*) from public.cards)<>2 then raise exception 'Card count changed'; end if;
END $$;
-- Reapply staged migration and confirm it works across a committed downgrade.
\i docs/sql/v1h26-rls-search-terms.sql
DO $$ BEGIN
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'H26 RPC not restored'; end if;
 if to_regclass('public.published_card_search_terms') is null then raise exception 'H26 table not restored'; end if;
 if (select count(*) from public.cards)<>2 then raise exception 'Cards lost on reapply'; end if;
END $$;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Reapplied RPC failed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('secret','en','de','word')) then raise exception 'Draft leaked after reapply'; end if;
END $$;
reset role;
