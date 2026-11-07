\set ON_ERROR_STOP on
-- Must run on disposable fixture after H.24/H.25, before H.26.
DO $$ BEGIN
 if to_regclass('public.published_card_search_terms') is not null then raise exception 'Public derived term table unexpectedly exists'; end if;
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'Public RPC must be invoker'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'Private index exposed'; end if;
 if has_table_privilege('anon','private.card_search_terms','SELECT') then raise exception 'Anon can read private terms'; end if;
END $$;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'English reverse search failed'; end if;
 if (select count(*) from public.lookup_published_card_indexed('die Rechnung','de','en','word'))<>1 then raise exception 'Article search failed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('secret','en','de','word')) then raise exception 'Draft leaked'; end if;
END $$;
reset role;
