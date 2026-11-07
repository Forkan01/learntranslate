\set ON_ERROR_STOP on
\i docs/sql/v1h25-invoker-search-indexes.sql
DO $$ BEGIN
 if (select count(*) from pg_indexes where schemaname='public' and tablename='cards' and indexname in
 ('cards_v1h25_published_lookup_idx','cards_v1h25_published_german_term_idx','cards_v1h25_published_german_plural_idx'))<>3 then
 raise exception 'Expected three published-only search indexes'; end if;
END $$;
-- Idempotency: installing twice must not fail.
\i docs/sql/v1h25-invoker-search-indexes.sql
-- Exercise published-only RLS and candidate lookup under anon role.
grant select on public.cards to anon;
create policy "V1H25 published read" on public.cards for select to anon using(status='published');
set role anon;
select count(*) as visible_published_cards from public.cards where status='published';
DO $$ BEGIN
 if (select count(*) from public.cards where status='published')<>1 then raise exception 'Unexpected published visibility'; end if;
 if exists(select 1 from public.cards where status='draft') then raise exception 'Draft visible to anon'; end if;
END $$;
reset role;
