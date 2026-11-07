-- V1-H.31: READ-ONLY production approval gate. No writes.
select (select count(*) from public.cards) as total_cards,
       (select count(*) from public.cards where status='published') as published_cards,
       (select count(*) from private.card_search_terms) as private_terms,
       (select count(distinct card_id) from private.card_search_terms) as private_indexed_cards,
       (select relrowsecurity from pg_class where oid='public.cards'::regclass) as cards_rls,
       (select prosecdef from pg_proc where oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure) as public_rpc_security_definer;
select policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename='cards' order by policyname;
select has_table_privilege('anon','public.cards','SELECT') as anon_cards_select,
       has_table_privilege('authenticated','public.cards','SELECT') as authenticated_cards_select,
       has_schema_privilege('anon','private','USAGE') as anon_private_schema;
select tgname,tgenabled from pg_trigger
where tgrelid='public.cards'::regclass and not tgisinternal order by tgname;
select to_regclass('public.published_card_search_terms') as h26_installed;
