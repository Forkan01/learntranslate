-- V1-H.24: SECURITY INVOKER replacement for public indexed-search RPC.
-- Staged only. Requires RLS SELECT policy and grants on public.cards.
-- This prioritizes RLS correctness; benchmark before enabling the feature flag.
begin;
create or replace function public.lookup_published_card_indexed(
 p_term text,p_source text,p_target text,p_type text
)
returns table(id uuid,search_key text,status text,content jsonb,
 created_at timestamptz,updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 select c.id,c.search_key,c.status,c.content,c.created_at,c.updated_at
 from public.cards c
 where p_term is not null and length(p_term) between 1 and 250
   and p_source in ('de','en') and p_target in ('de','en') and p_source<>p_target
   and p_type in ('word','sentence')
   and c.status='published' and c.source_language='de' and c.target_language='en'
   and c.type=p_type and c.content->>'type'=p_type
   and c.content->>'sourceLanguage'='de' and c.content->>'targetLanguage'='en'
   and (
     (p_source='en' and p_target='de' and exists (
       select 1 from regexp_split_to_table(coalesce(c.content->>'translation',''),';') s(value)
       where public.lookup_normalized_term(s.value)=public.lookup_normalized_term(p_term)))
     or
     (p_source='de' and p_target='en' and p_type='word' and (
       public.lookup_normalized_term(c.content->>'term')=public.lookup_normalized_term(p_term)
       or (c.content->'grammar'->>'partOfSpeech'='noun' and (
         public.lookup_normalized_term(regexp_replace(coalesce(c.content->>'term',''),'^(der|die|das)[[:space:]]+','','i'))=public.lookup_normalized_term(p_term)
         or (c.content->'grammar'->>'article' in ('der','die','das') and
           public.lookup_normalized_term((c.content->'grammar'->>'article')||' '||regexp_replace(coalesce(c.content->>'term',''),'^(der|die|das)[[:space:]]+','','i'))=public.lookup_normalized_term(p_term))
         or public.lookup_normalized_term(c.content->'grammar'->>'plural')=public.lookup_normalized_term(p_term)
       ))))
   )
 order by c.term,c.id limit 100;
$$;
revoke all on function public.lookup_published_card_indexed(text,text,text,text) from public;
grant execute on function public.lookup_published_card_indexed(text,text,text,text) to anon,authenticated;
-- The old private search index is retained for rollback; no card data changes.
commit;
