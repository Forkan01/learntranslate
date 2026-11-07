-- V1-H.19 reviewed privilege hardening; do not execute without approval.
-- Event trigger ensure_rls invokes this function internally; API roles need no EXECUTE.
begin;
DO $$ BEGIN
 if to_regprocedure('public.rls_auto_enable()') is null then
   raise exception 'Expected event trigger function missing';
 end if;
 if not exists(select 1 from pg_event_trigger
   where evtname='ensure_rls' and evtfoid='public.rls_auto_enable()'::regprocedure
   and evtenabled='O') then
   raise exception 'Expected enabled ensure_rls event trigger missing';
 end if;
END $$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
DO $$ BEGIN
 if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
 or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
   raise exception 'API roles retain event trigger function execute privilege';
 end if;
END $$;
commit;
