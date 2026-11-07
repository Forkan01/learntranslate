-- V1-H.11: staged indexed search terms. NOT installed automatically.
-- Derived index entries are kept in sync with cards by a trigger.
-- Security: RLS + security-invoker queries; never expose drafts.
create table if not exists public.card_lookup_terms (
  card_id uuid not null references public.cards(id) on delete cascade,
  source_language text not null check (source_language in ('de','en')),
  target_language text not null check (target_language in ('de','en')),
  card_type text not null check (card_type in ('word','sentence')),
  normalized_term text not null,
  primary key(card_id,source_language,target_language,card_type,normalized_term)
);
create index if not exists card_lookup_terms_search_idx
  on public.card_lookup_terms(source_language,target_language,card_type,normalized_term,card_id);
alter table public.card_lookup_terms enable row level security;
-- Public users can read only entries whose cards are published.
create policy "Published lookup terms are readable" on public.card_lookup_terms
  for select to anon,authenticated using (
    exists (select 1 from public.cards c where c.id=card_id and c.status='published')
  );
revoke all on public.card_lookup_terms from public,anon,authenticated;
grant select on public.card_lookup_terms to anon,authenticated;

-- Trigger function intentionally SECURITY DEFINER: only database triggers should
-- maintain the derived table. Revoke all direct EXECUTE permissions below.
create or replace function public.refresh_card_lookup_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sense text;
  v_term text;
  v_article text;
  v_plural text;
begin
  delete from public.card_lookup_terms where card_id = new.id;
  if new.status <> 'published' or new.source_language <> 'de' or new.target_language <> 'en' then
    return new;
  end if;
  if new.type = 'word' and new.content->'grammar'->>'partOfSpeech' = 'noun' then
    v_term := regexp_replace(coalesce(new.content->>'term',''), '^(der|die|das)[[:space:]]+', '', 'i');
    v_article := new.content->'grammar'->>'article';
    v_plural := new.content->'grammar'->>'plural';
    insert into public.card_lookup_terms(card_id,source_language,target_language,card_type,normalized_term)
    select new.id,'de','en',new.type,public.lookup_normalized_term(x)
    from (values(v_term),(case when v_article in ('der','die','das') then v_article||' '||v_term end),(v_plural)) t(x)
    where x is not null and public.lookup_normalized_term(x) <> ''
    on conflict do nothing;
  end if;
  for v_sense in select value from regexp_split_to_table(coalesce(new.content->>'translation',''),';') as t(value) loop
    if public.lookup_normalized_term(v_sense) <> '' then
      insert into public.card_lookup_terms(card_id,source_language,target_language,card_type,normalized_term)
      values(new.id,'en','de',new.type,public.lookup_normalized_term(v_sense)) on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.refresh_card_lookup_terms() from public,anon,authenticated;
-- Do not install until reviewed for SECURITY DEFINER privilege boundaries.
create trigger cards_refresh_lookup_terms after insert or update of content,status,term,type,source_language,target_language
  on public.cards for each row execute function public.refresh_card_lookup_terms();
-- Backfill existing cards through the same trigger logic in a controlled migration.
-- WARNING: this example backfill updates rows and their updated_at triggers; a
-- production migration should use a dedicated non-mutating backfill instead.
