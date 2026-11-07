\set ON_ERROR_STOP on
-- Must follow H.24 and H.25, with published-card RLS policy already installed.
\i docs/sql/v1h26-rls-search-terms.sql
DO $$ BEGIN
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'Public RPC is privileged'; end if;
 if has_table_privilege('anon','public.published_card_search_terms','INSERT') then raise exception 'Anon can write index'; end if;
END $$;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Invoice lookup failed'; end if;
 if (select count(*) from public.lookup_published_card_indexed('die Rechnung','de','en','word'))<>1 then raise exception 'Article lookup failed'; end if;
 if (select count(*) from public.lookup_published_card_indexed('Rechnungen','de','en','word'))<>1 then raise exception 'Plural lookup failed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('der Rechnung','de','en','word')) then raise exception 'Wrong article matched'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('secret','en','de','word')) then raise exception 'Draft leaked'; end if;
END $$;
reset role;
-- Mutation lifecycle: published -> draft -> published.
update public.cards set status='draft' where term='Rechnung';
set role anon;
DO $$ BEGIN
 if exists(select 1 from public.lookup_published_card_indexed('invoice','en','de','word')) then raise exception 'Unpublished index leaked'; end if;
END $$;
reset role;
update public.cards set status='published' where term='Rechnung';
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Republish index not refreshed'; end if;
END $$;
reset role;
