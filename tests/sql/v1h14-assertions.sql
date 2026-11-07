\set ON_ERROR_STOP on
DO $$
DECLARE c integer;
BEGIN
 select count(*) into c from private.card_search_terms where normalized_term='invoice' and source_language='en';
 if c<>1 then raise exception 'English sense missing'; end if;
 select count(*) into c from private.card_search_terms where normalized_term='die rechnung' and source_language='de';
 if c<>1 then raise exception 'German article missing'; end if;
 select count(*) into c from private.card_search_terms where normalized_term='rechnungen' and source_language='de';
 if c<>1 then raise exception 'Plural missing'; end if;
 select count(*) into c from private.card_search_terms where normalized_term='secret';
 if c<>0 then raise exception 'Draft indexed'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'anon private schema access'; end if;
 if has_function_privilege('anon','private.lookup_card_ids(text,text,text,text)','EXECUTE') then raise exception 'anon private function access'; end if;
END $$;
insert into public.cards(id,type,source_language,target_language,term,status,content) values
('00000000-0000-4000-8000-000000000003','word','de','en','Baum','published','{"term":"Baum","translation":"tree","grammar":{"partOfSpeech":"noun","article":"der","plural":"Bäume"}}');
DO $$ BEGIN
 if not exists(select 1 from private.card_search_terms where normalized_term='tree') then raise exception 'Insert trigger failed'; end if;
END $$;
update public.cards set status='draft' where term='Baum';
DO $$ BEGIN
 if exists(select 1 from private.card_search_terms where normalized_term='tree') then raise exception 'Unpublish trigger failed'; end if;
END $$;
update public.cards set status='published',content=jsonb_set(content,'{translation}','"wood"') where term='Baum';
DO $$ BEGIN
 if not exists(select 1 from private.card_search_terms where normalized_term='wood') then raise exception 'Update trigger failed'; end if;
END $$;
delete from public.cards where term='Baum';
DO $$ BEGIN
 if exists(select 1 from private.card_search_terms where normalized_term='wood') then raise exception 'Delete trigger failed'; end if;
END $$;
select 'PASS: PostgreSQL execution, backfill, role permissions and trigger lifecycle' as result;
