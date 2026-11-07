-- V1-H.7 staged database-side fallback lookup. Apply only after review.
-- SECURITY INVOKER preserves the existing published-card RLS policy.
create or replace function public.lookup_published_card_fallback(
  p_term text, p_source text, p_target text, p_type text
)
returns setof public.cards
language sql
stable
security invoker
set search_path = ''
as $$
  select c.* from public.cards c
  where c.status = 'published'
    and c.type = p_type
    and c.source_language = 'de'
    and c.target_language = 'en'
    and (
      (p_source = 'en' and p_target = 'de' and exists (
        select 1 from regexp_split_to_table(coalesce(c.content->>'translation',''), ';') as sense(value)
        where lower(btrim(regexp_replace(sense.value, '[[:space:]]+', ' ', 'g')))
          = lower(btrim(regexp_replace(p_term, '[[:space:]]+', ' ', 'g')))
      ))
      or
      (p_source = 'de' and p_target = 'en' and p_type = 'word' and (
        lower(btrim(c.content->>'term')) = lower(btrim(p_term))
        or (
          p_term !~* '^(der|die|das)[[:space:]]+'
          and lower(btrim(regexp_replace(c.content->>'term', '^(der|die|das)[[:space:]]+', '', 'i')))
            = lower(btrim(p_term))
        )
        or (
          c.content->'grammar'->>'article' in ('der','die','das')
          and lower(btrim(p_term)) = lower(c.content->'grammar'->>'article' || ' ' ||
            regexp_replace(c.content->>'term', '^(der|die|das)[[:space:]]+', '', 'i'))
        )
        or (
          c.content->'grammar'->>'partOfSpeech' = 'noun'
          and lower(btrim(c.content->'grammar'->>'plural')) = lower(btrim(p_term))
        )
      ))
    )
  order by c.term asc, c.id asc
  limit 1;
$$;
-- Do not grant execution to PUBLIC implicitly. Keep the RPC read-only.
revoke all on function public.lookup_published_card_fallback(text,text,text,text) from public;
grant execute on function public.lookup_published_card_fallback(text,text,text,text) to anon, authenticated;
