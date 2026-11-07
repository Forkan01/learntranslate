-- V1-H.21: controlled indexed search installation candidate.
-- NOT applied to production. Requires separate approval.
-- Run as a single transaction; feature flag remains OFF.
begin;
-- Fail before any DDL if the expected schema is absent.
DO $$ BEGIN
 if to_regclass('public.cards') is null then raise exception 'Missing cards table'; end if;
 if not (select relrowsecurity from pg_class where oid='public.cards'::regclass) then raise exception 'cards RLS disabled'; end if;
 if to_regclass('private.card_search_terms') is not null then raise exception 'Index already exists: manual review required'; end if;
 if to_regprocedure('public.lookup_published_card_indexed(text,text,text,text)') is not null then raise exception 'RPC already exists: manual review required'; end if;
END $$;

-- 1. Normalization helper
-- PostgreSQL 17 supports NFKC normalization; use a single normalization rule
-- for both stored values and queries. JS locale case-folding edge cases still
-- require compatibility testing before switching the live endpoint.
create or replace function public.lookup_normalized_term(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select lower(btrim(regexp_replace(normalize(p_value, NFKC), '[[:space:]]+', ' ', 'g')));
$$;
revoke all on function public.lookup_normalized_term(text) from public;
grant execute on function public.lookup_normalized_term(text) to anon, authenticated;


-- 2. Private index, trigger, and backfill
-- V1-H.12: reviewed candidate; DO NOT run until staging tests pass.
-- The lookup index is derived from published cards only.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.card_search_terms (
 card_id uuid not null references public.cards(id) on delete cascade,
 source_language text not null check(source_language in ('de','en')),
 target_language text not null check(target_language in ('de','en')),
 card_type text not null check(card_type in ('word','sentence')),
 normalized_term text not null,
 primary key(card_id,source_language,target_language,card_type,normalized_term)
);
create index if not exists card_search_terms_lookup_idx on private.card_search_terms
 (source_language,target_language,card_type,normalized_term,card_id);
alter table private.card_search_terms enable row level security;
revoke all on private.card_search_terms from public,anon,authenticated;

-- Trigger maintenance is isolated in a non-exposed schema and cannot be
-- called directly by API roles. Owner privileges are used only for index writes.
create or replace function private.refresh_card_search_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v text; v_base text; v_article text; v_plural text;
begin
 if tg_op='DELETE' then
   delete from private.card_search_terms where card_id=old.id;
   return old;
 end if;
 delete from private.card_search_terms where card_id=new.id;
 if new.status <> 'published' or new.source_language <> 'de' or new.target_language <> 'en' then return new; end if;
 -- English reverse senses, preserving exact semicolon-separated matching.
 for v in select value from regexp_split_to_table(coalesce(new.content->>'translation',''),';') as x(value) loop
   v := public.lookup_normalized_term(v);
   if v <> '' then
     insert into private.card_search_terms values(new.id,'en','de',new.type,v) on conflict do nothing;
   end if;
 end loop;
 if new.type='word' then
   -- Existing JS fallback matches the exact term even for non-nouns.
   v := public.lookup_normalized_term(coalesce(new.content->>'term',''));
   if v <> '' then
     insert into private.card_search_terms values(new.id,'de','en','word',v) on conflict do nothing;
   end if;
   if new.content->'grammar'->>'partOfSpeech'='noun' then
     v_base := regexp_replace(coalesce(new.content->>'term',''),'^(der|die|das)[[:space:]]+','','i');
     v_article := new.content->'grammar'->>'article';
     v_plural := new.content->'grammar'->>'plural';
     for v in select value from (values(v_base),
       (case when v_article in ('der','die','das') then v_article||' '||v_base end),
       (v_plural)) as x(value) where value is not null loop
       v := public.lookup_normalized_term(v);
       if v <> '' then insert into private.card_search_terms values(new.id,'de','en','word',v) on conflict do nothing; end if;
     end loop;
   end if;
 end if;
 return new;
end;
$$;
revoke all on function private.refresh_card_search_terms() from public,anon,authenticated;

create trigger cards_sync_search_terms
 after insert or update of content,status,term,type,source_language,target_language or delete
 on public.cards for each row execute function private.refresh_card_search_terms();

-- Non-mutating backfill: call trigger function indirectly is not possible,
-- so populate via set-based inserts without modifying cards or timestamps.
insert into private.card_search_terms(card_id,source_language,target_language,card_type,normalized_term)
select c.id,'en','de',c.type,public.lookup_normalized_term(x.value)
from public.cards c cross join lateral regexp_split_to_table(coalesce(c.content->>'translation',''),';') as x(value)
where c.status='published' and c.source_language='de' and c.target_language='en'
 and public.lookup_normalized_term(x.value) <> '' on conflict do nothing;
insert into private.card_search_terms(card_id,source_language,target_language,card_type,normalized_term)
select c.id,'de','en','word',public.lookup_normalized_term(x.value)
from public.cards c cross join lateral (values
 (c.content->>'term'),
 (case when c.content->'grammar'->>'partOfSpeech'='noun' then
   regexp_replace(coalesce(c.content->>'term',''),'^(der|die|das)[[:space:]]+','','i') end),
 (case when c.content->'grammar'->>'partOfSpeech'='noun' and c.content->'grammar'->>'article' in ('der','die','das') then
   (c.content->'grammar'->>'article')||' '||regexp_replace(coalesce(c.content->>'term',''),'^(der|die|das)[[:space:]]+','','i') end),
 (case when c.content->'grammar'->>'partOfSpeech'='noun' then c.content->'grammar'->>'plural' end)
) as x(value)
where c.status='published' and c.source_language='de' and c.target_language='en' and c.type='word'
 and x.value is not null and public.lookup_normalized_term(x.value) <> '' on conflict do nothing;

-- API RPC runs with caller privileges; RLS on public.cards remains effective.
-- The private index table is read by a dedicated SECURITY DEFINER helper;
-- it only returns candidate UUIDs, never card contents. This still requires
-- a privilege-boundary audit before release.
create or replace function private.lookup_card_ids(p_term text,p_source text,p_target text,p_type text)
returns setof uuid language sql stable security definer set search_path = '' as $$
 select t.card_id from private.card_search_terms t
 where t.source_language=p_source and t.target_language=p_target
   and t.card_type=p_type and t.normalized_term=public.lookup_normalized_term(p_term)
 order by t.card_id limit 100;
$$;
revoke all on function private.lookup_card_ids(text,text,text,text) from public,anon,authenticated;
-- Do not grant API roles direct access to private schema/functions.
-- Integration RPC remains deferred until permission model is verified.

-- 3. Published-only RPC
-- V1-H.16: deploy only after isolated PostgreSQL and privilege review.
-- The API calls this public RPC with the publishable (anon) key.
-- SECURITY DEFINER is intentionally scoped to published cards only.
create or replace function public.lookup_published_card_indexed(
  p_term text, p_source text, p_target text, p_type text
)
returns table(id uuid, search_key text, status text, content jsonb,
              created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.search_key, c.status, c.content, c.created_at, c.updated_at
  from private.card_search_terms t
  join public.cards c on c.id = t.card_id
  where p_term is not null and length(p_term) between 1 and 250
    and p_source in ('de','en') and p_target in ('de','en')
    and p_source <> p_target and p_type in ('word','sentence')
    and t.normalized_term = public.lookup_normalized_term(p_term)
    and t.source_language = p_source and t.target_language = p_target
    and t.card_type = p_type
    and c.status = 'published'
    and c.source_language = 'de' and c.target_language = 'en'
    and c.type = p_type
    and c.content->>'type' = p_type
    and c.content->>'sourceLanguage' = 'de'
    and c.content->>'targetLanguage' = 'en'
  order by c.term, c.id
  limit 100;
$$;
revoke all on function public.lookup_published_card_indexed(text,text,text,text) from public;
revoke all on function public.lookup_published_card_indexed(text,text,text,text) from anon, authenticated;
grant execute on function public.lookup_published_card_indexed(text,text,text,text) to anon, authenticated;

-- 4. Post-install invariants
DO $$ DECLARE n integer; BEGIN
 select count(*) into n from public.cards c where c.status='published' and c.source_language='de' and c.target_language='en' and not exists(select 1 from private.card_search_terms t where t.card_id=c.id);
 if n<>0 then raise exception 'Published cards without search terms: %',n; end if;
 if has_schema_privilege('anon','private','USAGE') or has_table_privilege('anon','private.card_search_terms','SELECT') then raise exception 'Private index exposed'; end if;
 if not has_function_privilege('anon','public.lookup_published_card_indexed(text,text,text,text)','EXECUTE') then raise exception 'RPC not executable'; end if;
END $$;
commit;
