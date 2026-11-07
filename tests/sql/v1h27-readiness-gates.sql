\set ON_ERROR_STOP on
-- V1-H.27: run on disposable DB after H.26; never production.
DO $$ DECLARE n integer; BEGIN
 select count(*) into n from public.cards;
 if n<>2 then raise exception 'Unexpected fixture count: %',n; end if;
 if (select count(*) from public.published_card_search_terms t join public.cards c on c.id=t.card_id where c.status<>'published')<>0 then raise exception 'Draft terms stored in public index'; end if;
 if not (select relrowsecurity from pg_class where oid='public.published_card_search_terms'::regclass) then raise exception 'Public index RLS disabled'; end if;
 if (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) then raise exception 'Public RPC is SECURITY DEFINER'; end if;
END $$;
-- Anonymous direct table reads and RPC must have the same publication boundary.
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Expected invoice'; end if;
 if exists(select 1 from public.published_card_search_terms t join public.cards c on c.id=t.card_id where c.status='draft') then raise exception 'Draft index visible'; end if;
 if has_table_privilege('anon','public.published_card_search_terms','UPDATE') then raise exception 'Index writable by anon'; end if;
END $$;
reset role;
-- Transactional rollback rehearsal: mutate content and verify index, then roll back.
begin;
update public.cards set content=jsonb_set(content,'{translation}','"receipt"'::jsonb) where term='Rechnung';
set local role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('receipt','en','de','word'))<>1 then raise exception 'Updated term not indexed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('invoice','en','de','word')) then raise exception 'Stale term survived'; end if;
END $$;
rollback;
set role anon;
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('invoice','en','de','word'))<>1 then raise exception 'Rollback did not restore index'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('receipt','en','de','word')) then raise exception 'Rolled back term survived'; end if;
END $$;
reset role;
select 'PASS: H.27 publication, privilege, mutation rollback' as result;
