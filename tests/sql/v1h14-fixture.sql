-- Disposable PostgreSQL 17 fixture, not production data.
create role anon nologin;
create role authenticated nologin;
create table public.cards (
 id uuid primary key, type text not null, source_language text not null,
 target_language text not null, term text not null, search_key text,
 status text not null, content jsonb not null,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
insert into public.cards(id,type,source_language,target_language,term,status,content) values
 ('00000000-0000-4000-8000-000000000001','word','de','en','Rechnung','published','{"type":"word","sourceLanguage":"de","targetLanguage":"en","term":"Rechnung","translation":"bill; invoice","grammar":{"partOfSpeech":"noun","article":"die","plural":"Rechnungen"}}'),
 ('00000000-0000-4000-8000-000000000002','word','de','en','Geheimnis','draft','{"type":"word","sourceLanguage":"de","targetLanguage":"en","term":"Geheimnis","translation":"secret","grammar":{"partOfSpeech":"noun","article":"das","plural":"Geheimnisse"}}');
