-- V1-H.23 read-only parity probes. Run after the indexed RPC is installed.
\set ON_ERROR_STOP on
DO $$ DECLARE bad integer; BEGIN
 with checks(term,src,dst,typ,expected) as (values
 ('invoice','en','de','word',1),
 ('die Rechnung','de','en','word',1),
 ('der Rechnung','de','en','word',0),
 ('Rechnungen','de','en','word',1),
 ('not-a-card','en','de','word',0))
 select count(*) into bad from checks q where
 (select count(*) from public.lookup_published_card_indexed(q.term,q.src,q.dst,q.typ)) <> q.expected;
 if bad>0 then raise exception 'Indexed search regression: % probes failed',bad; end if;
 if exists(select 1 from private.card_search_terms t join public.cards c on c.id=t.card_id where c.status <> 'published') then
 raise exception 'Unpublished card indexed'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'Private schema exposed'; end if;
END $$;
