-- V1-H.29 read-only production audit. Safe to run before any migration.
select status,count(*) as cards from public.cards group by status order by status;
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (('public','cards'),('private','card_search_terms'))
order by 1,2;
select p.proname,p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p where p.oid='public.lookup_published_card_indexed(text,text,text,text)'::regprocedure;
select schemaname,tablename,policyname,roles,cmd,qual from pg_policies
where (schemaname,tablename) in (('public','cards'),('private','card_search_terms'))
order by 1,2,3;
select tgname,tgenabled from pg_trigger
where tgrelid='public.cards'::regclass and not tgisinternal order by tgname;
select indexrelname,idx_scan from pg_stat_user_indexes
where schemaname='public' and relname='cards' order by indexrelname;
