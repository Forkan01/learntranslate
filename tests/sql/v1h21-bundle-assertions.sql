\set ON_ERROR_STOP on
DO $$ DECLARE n integer; BEGIN
 select count(*) into n from public.lookup_published_card_indexed('invoice','en','de','word');
 if n<>1 then raise exception 'Bundled reverse lookup failed'; end if;
 select count(*) into n from public.lookup_published_card_indexed('die Rechnung','de','en','word');
 if n<>1 then raise exception 'Bundled article lookup failed'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('secret','en','de','word')) then raise exception 'Draft exposed'; end if;
 if not exists(select 1 from pg_trigger where tgname='cards_sync_search_terms' and not tgisinternal) then raise exception 'Sync trigger missing'; end if;
END $$;
