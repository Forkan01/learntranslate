\set ON_ERROR_STOP on
-- Disposable fixture: mirror production read permissions and RLS policy.
grant select on public.cards to anon,authenticated;
create policy "Published cards are readable" on public.cards for select to anon,authenticated using(status='published');
\i docs/sql/v1h24-invoker-rpc-candidate.sql
DO $$ BEGIN
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then
 raise exception 'RPC must be SECURITY INVOKER'; end if;
END $$;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Anon invoice search failed'; end if;
 if (select count(*) from public.lookup_published_card_indexed('die Rechnung','de','en','word'))<>1 then raise exception 'Anon noun search failed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('der Rechnung','de','en','word')) then raise exception 'Incorrect article matched'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('secret','en','de','word')) then raise exception 'Draft leaked'; end if;
END $$;
reset role;
