\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture ONLY; generate 10,000 distinct published word cards.
insert into public.cards(id,type,source_language,target_language,term,status,content)
select md5('v1h28-benchmark-'||g::text)::uuid,'word','de','en','Wort'||g::text,'published',
 jsonb_build_object('type','word','sourceLanguage','de','targetLanguage','en',
 'term','Wort'||g::text,'translation','sense'||g::text||'; alternate'||g::text,
 'grammar',jsonb_build_object('partOfSpeech','noun','article','das','plural','Wörter'||g::text))
from generate_series(1,10000) as g;
analyze public.cards;
analyze public.published_card_search_terms;
DO $$ BEGIN
 if (select count(*) from public.cards)<10000 then raise exception 'Benchmark seed incomplete'; end if;
 if (select count(*) from public.published_card_search_terms)<20000 then raise exception 'Index not populated'; end if;
END $$;
-- EXPLAIN ANALYZE reports measured timings in CI logs, without asserting
-- machine-dependent latency thresholds. The query must match exactly.
set role anon;
explain (analyze,buffers,format text) select id from public.lookup_published_card_indexed('sense9999','en','de','word');
explain (analyze,buffers,format text) select id from public.lookup_published_card_indexed('das Wort9999','de','en','word');
explain (analyze,buffers,format text) select id from public.lookup_published_card_indexed('Wörter9999','de','en','word');
explain (analyze,buffers,format text) select id from public.lookup_published_card_indexed('not-present','en','de','word');
DO $$ BEGIN
 if (select count(*) from public.lookup_published_card_indexed('sense9999','en','de','word'))<>1 then raise exception 'Reverse match failed at scale'; end if;
 if (select count(*) from public.lookup_published_card_indexed('das Wort9999','de','en','word'))<>1 then raise exception 'Article match failed at scale'; end if;
 if (select count(*) from public.lookup_published_card_indexed('Wörter9999','de','en','word'))<>1 then raise exception 'Plural match failed at scale'; end if;
 if exists(select 1 from public.lookup_published_card_indexed('not-present','en','de','word')) then raise exception 'False match at scale'; end if;
END $$;
reset role;
