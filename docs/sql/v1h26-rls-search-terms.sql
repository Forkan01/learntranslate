-- V1-H.26 staged: RLS-protected exact term index for reverse lookup.
-- Install AFTER V1-H.24 (invoker RPC) and V1-H.25 (indexes).
begin;
create table if not exists public.published_card_search_terms (
 card_id uuid not null references public.cards(id) on delete cascade,
 source_language text not null, target_language text not null,
 card_type text not null, normalized_term text not null,
 primary key(card_id,source_language,target_language,card_type,normalized_term)
);
create index if not exists published_card_search_terms_lookup_idx
 on public.published_card_search_terms(source_language,target_language,card_type,normalized_term,card_id);
alter table public.published_card_search_terms enable row level security;
revoke all on public.published_card_search_terms from public,anon,authenticated;
grant select on public.published_card_search_terms to anon,authenticated;
drop policy if exists published_terms_visible on public.published_card_search_terms;
create policy published_terms_visible on public.published_card_search_terms
 for select to anon,authenticated using (exists (
 select 1 from public.cards c where c.id=card_id and c.status='published'
  and c.source_language='de' and c.target_language='en'
  and c.type=card_type
 ));
-- A private, non-API trigger maintains derived terms. It executes after
-- cards_sync_search_terms, using the existing curated exact-match index.
create or replace function private.sync_published_card_search_terms()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
   delete from public.published_card_search_terms where card_id=old.id;
 else
   delete from public.published_card_search_terms where card_id=new.id;
   insert into public.published_card_search_terms(card_id,source_language,target_language,card_type,normalized_term)
   select card_id,source_language,target_language,card_type,normalized_term
   from private.card_search_terms where card_id=new.id;
 end if;
 return null;
end $$;
revoke all on function private.sync_published_card_search_terms() from public,anon,authenticated;
drop trigger if exists zzz_cards_sync_published_search_terms on public.cards;
create trigger zzz_cards_sync_published_search_terms
 after insert or update of content,status,term,type,source_language,target_language or delete
 on public.cards for each row execute function private.sync_published_card_search_terms();
insert into public.published_card_search_terms(card_id,source_language,target_language,card_type,normalized_term)
select card_id,source_language,target_language,card_type,normalized_term
from private.card_search_terms on conflict do nothing;
create or replace function public.lookup_published_card_indexed(
 p_term text,p_source text,p_target text,p_type text
)
returns table(id uuid,search_key text,status text,content jsonb,created_at timestamptz,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select c.id,c.search_key,c.status,c.content,c.created_at,c.updated_at
 from public.published_card_search_terms t
 join public.cards c on c.id=t.card_id
 where p_term is not null and length(p_term) between 1 and 250
 and p_source in ('de','en') and p_target in ('de','en') and p_source<>p_target
 and p_type in ('word','sentence')
 and t.normalized_term=public.lookup_normalized_term(p_term)
 and t.source_language=p_source and t.target_language=p_target and t.card_type=p_type
 and c.status='published' and c.source_language='de' and c.target_language='en'
 and c.type=p_type and c.content->>'type'=p_type
 and c.content->>'sourceLanguage'='de' and c.content->>'targetLanguage'='en'
 order by c.term,c.id limit 100;
$$;
revoke all on function public.lookup_published_card_indexed(text,text,text,text) from public;
grant execute on function public.lookup_published_card_indexed(text,text,text,text) to anon,authenticated;
commit;
