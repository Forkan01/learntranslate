-- V1-H.17: read-only production preflight; safe to execute before any DDL.
-- Fail deployment if required cards schema/roles are missing.
DO $$
DECLARE n bigint; duplicates bigint;
BEGIN
 if to_regclass('public.cards') is null then raise exception 'public.cards missing'; end if;
 if to_regrole('anon') is null or to_regrole('authenticated') is null then
   raise exception 'API roles missing'; end if;
 if not (select relrowsecurity from pg_class where oid='public.cards'::regclass) then
   raise exception 'cards RLS must be enabled'; end if;
 select count(*) into n from public.cards where status='published';
 select count(*) into duplicates from (
   select search_key from public.cards where search_key is not null
   group by search_key having count(*) > 1
 ) d;
 if duplicates > 0 then raise exception 'Duplicate search keys: %',duplicates; end if;
 raise notice 'Preflight OK; published cards: %',n;
END $$;
