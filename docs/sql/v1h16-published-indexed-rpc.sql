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
