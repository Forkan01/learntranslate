\set ON_ERROR_STOP on
-- Verify a non-owner API role can execute RPC without private schema privileges.
set role anon;
select count(*) as indexed_invoice from public.lookup_published_card_indexed('invoice','en','de','word');
reset role;
DO $$
DECLARE n integer;
BEGIN
 select count(*) into n from public.lookup_published_card_indexed('invoice','en','de','word');
 if n <> 1 then raise exception 'Reverse English lookup failed: %',n; end if;
 select count(*) into n from public.lookup_published_card_indexed('die Rechnung','de','en','word');
 if n <> 1 then raise exception 'German article lookup failed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('Rechnungen','de','en','word');
 if n <> 1 then raise exception 'Plural lookup failed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('der Rechnung','de','en','word');
 if n <> 0 then raise exception 'Wrong article returned'; end if;
 select count(*) into n from public.lookup_published_card_indexed('secret','en','de','word');
 if n <> 0 then raise exception 'Draft leaked'; end if;
 select count(*) into n from public.lookup_published_card_indexed('invoice','en','en','word');
 if n <> 0 then raise exception 'Invalid direction returned'; end if;
 select count(*) into n from public.lookup_published_card_indexed('invoice','en','de','sentence');
 if n <> 0 then raise exception 'Wrong card type returned'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'private schema exposed'; end if;
 if has_table_privilege('anon','private.card_search_terms','SELECT') then raise exception 'private table exposed'; end if;
END $$;
update public.cards set status='draft' where term='Rechnung';
DO $$ BEGIN
 if exists(select 1 from public.lookup_published_card_indexed('invoice','en','de','word')) then
 raise exception 'Unpublished card exposed'; end if;
END $$;
select 'PASS: indexed RPC and publication security' as result;
