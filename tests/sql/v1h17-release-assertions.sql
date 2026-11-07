\set ON_ERROR_STOP on
-- Confirm role grants and verify indexed results never include drafts.
DO $$
DECLARE n bigint;
BEGIN
 if not has_function_privilege('anon','public.lookup_published_card_indexed(text,text,text,text)','EXECUTE') then
   raise exception 'anon cannot execute indexed RPC'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'private schema exposed'; end if;
 if has_table_privilege('anon','private.card_search_terms','SELECT') then raise exception 'private index exposed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('invoice','en','de','word');
 if n <> 1 then raise exception 'English reverse parity failed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('die Rechnung','de','en','word');
 if n <> 1 then raise exception 'German article parity failed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('der Rechnung','de','en','word');
 if n <> 0 then raise exception 'Incorrect article accepted'; end if;
 select count(*) into n from public.lookup_published_card_indexed('secret','en','de','word');
 if n <> 0 then raise exception 'Draft card leaked'; end if;
END $$;
