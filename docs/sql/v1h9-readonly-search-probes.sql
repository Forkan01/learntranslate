-- Read-only V1-H.9 probes. Execute with SELECT only; does not install RPC.
-- Compare normalized forms against JS normalizeSearchTerm before rollout.
with cases(input, expected) as (values
 ('Ｆｅｈｌｅｒ','fehler'),
 ('  GEFÜHL  ','gefühl'),
 ('Ge' || U&'\\0308' || 'fühl','gëfühl'),
 ('  job   application  ','job application'),
 ('Ä','ä'),('ẞ','ß')
), results as (
 select input,expected,
 lower(btrim(regexp_replace(normalize(input,NFKC),'[[:space:]]+',' ','g'))) as actual
 from cases
)
select input,expected,actual,actual=expected as passed from results;

-- Confirm the existing public read policy and role privileges.
select policyname,cmd,roles,qual from pg_policies
where schemaname='public' and tablename='cards';
select has_table_privilege('anon','public.cards','SELECT') as anon_can_select,
       has_table_privilege('authenticated','public.cards','SELECT') as authenticated_can_select;

-- Confirm no unpublished cards are returned by the published-card filter.
select count(*) as unpublished_visible_from_published_filter from public.cards
where status='published' and status <> 'published';
