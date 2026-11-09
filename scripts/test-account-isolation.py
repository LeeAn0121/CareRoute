#!/usr/bin/env python3
"""Synthetic account-isolation regression suite; always rolls back.

Requires Python 3, psql, PostgreSQL with pgcrypto, and an EMPTY local database
named careroute_security_test. The connecting role must be a local superuser.
Example: python3 scripts/test-account-isolation.py --host 127.0.0.1 --user postgres
PGPASSWORD may supply the local password. No project credentials are read.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def migration(name):
    text = (ROOT / 'supabase' / 'migrations' / name).read_text()
    # Strip exactly the migration's transaction envelope, never internal bodies.
    if not text.endswith('COMMIT;\n') or len(re.findall(r'^BEGIN;$', text, re.M)) != 1:
        raise ValueError(f'Unexpected migration transaction envelope: {name}')
    return re.sub(r'^BEGIN;\n', '', text, count=1, flags=re.M).removesuffix('COMMIT;\n')


fixture=r"""
BEGIN;
SET LOCAL plpgsql.check_asserts=on;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOLOGIN SUPERUSER; END IF;
END $$;
SET LOCAL ROLE postgres;
-- Simulate permissive Supabase/global defaults to verify both layers are removed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC,anon,authenticated;
-- Fail closed if the local test DB already contains application schemas/tables.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,is_anonymous boolean NOT NULL DEFAULT false,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE auth.identities(user_id uuid REFERENCES auth.users(id),provider text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
GRANT USAGE ON SCHEMA auth,storage,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO anon,authenticated,service_role;
CREATE TABLE public.recipients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,photo_url text,last_completed_key text,last_completed_memo text,last_visit_started_at timestamptz);
CREATE TABLE public.push_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),endpoint text UNIQUE,p256dh text,auth text);
CREATE TABLE public.print_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL,recipient_ids uuid[],pdf_path text);
CREATE TABLE public.visit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL);
CREATE TABLE public.medications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,drug_name text);
CREATE TABLE public.share_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL);
CREATE TABLE public.vitals_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL);
CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY old_public ON storage.objects FOR ALL USING(true) WITH CHECK(true);
GRANT ALL ON storage.objects TO anon,authenticated,service_role;
INSERT INTO storage.buckets VALUES('recipient-photos',true),('print-pdfs',true);
INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','legacy.jpg'),('print-pdfs','legacy.pdf');
INSERT INTO public.recipients(id,name,last_completed_key,last_completed_memo) VALUES('10000000-0000-0000-0000-000000000000','legacy',((now() AT TIME ZONE 'Asia/Seoul')::date-1)::text,'legacy memo');
"""
tests=r"""
-- Fixtures are synthetic; never load application records.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000001','a@example.test',now()),
 ('00000000-0000-0000-0000-000000000002','b@example.test',now()),
 ('00000000-0000-0000-0000-000000000003','jggen0121@naver.com',now()),
 ('00000000-0000-0000-0000-000000000004','jggen0401@gmail.com',now()),
 ('00000000-0000-0000-0000-000000000005','jggen4177@gmail.com',now()),
 ('00000000-0000-0000-0000-000000000006','nongoogle@example.test',now()),
 ('00000000-0000-0000-0000-000000000007','unverified@example.test',NULL);
INSERT INTO auth.identities SELECT id,'google' FROM auth.users WHERE email<>'nongoogle@example.test';
CREATE FUNCTION pg_temp.expect_denied(q text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION 'expected permission denial: %',q;
END $$;
CREATE FUNCTION pg_temp.check_true(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion: %',msg; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_denied(text),pg_temp.check_true(boolean,text) TO anon,authenticated,service_role;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied('select * from public.recipients');
SELECT pg_temp.expect_denied('select * from public.visit_session_events');
SELECT pg_temp.expect_denied('select * from storage.objects');
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000000',current_date,'in_progress')$q$);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'verified');
SELECT pg_temp.check_true(public.can_access_owner(NULL)=false,'NULL owner must return false, never SQL NULL');
SELECT pg_temp.check_true((select count(*)=0 from public.recipients),'A cannot see legacy');
SELECT pg_temp.expect_denied('select * from public.legacy_data_access');
SELECT pg_temp.expect_denied('select * from public.security_change_log');
SELECT pg_temp.expect_denied('truncate storage.objects');
SELECT pg_temp.expect_denied('truncate public.recipients cascade');
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000000',current_date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$insert into public.recipients(name,owner_id) values('forge','00000000-0000-0000-0000-000000000002')$q$);
INSERT INTO public.recipients(id,name) VALUES('10000000-0000-0000-0000-000000000001','A');
SELECT pg_temp.check_true((SELECT owner_id=auth.uid() FROM public.recipients),'new owner defaults A');
SELECT pg_temp.expect_denied($q$update public.recipients set owner_id=NULL$q$);
INSERT INTO public.medications(recipient_id,drug_name) VALUES('10000000-0000-0000-0000-000000000001','fixture');
SELECT pg_temp.check_true((SELECT owner_id=auth.uid() FROM public.medications),'medication inherits A');
INSERT INTO public.print_logs(recipient_ids) VALUES(ARRAY['10000000-0000-0000-0000-000000000001']::uuid[]);
INSERT INTO public.share_logs DEFAULT VALUES;
INSERT INTO public.push_subscriptions(endpoint) VALUES('fixture:A');
SELECT pg_temp.check_true((SELECT owner_id=auth.uid() FROM public.share_logs),'unlinked log private');
INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos',auth.uid()::text||'/a.jpg'),('print-pdfs',auth.uid()::text||'/a.pdf');
UPDATE public.recipients SET photo_url='https://fixture.test/storage/v1/object/public/recipient-photos/'||auth.uid()::text||'/a.jpg';
INSERT INTO public.print_logs(pdf_path) VALUES(auth.uid()::text||'/a.pdf');
SELECT pg_temp.expect_denied($q$insert into storage.objects(bucket_id,name) values('recipient-photos','other/a.jpg')$q$);
SELECT pg_temp.expect_denied($q$update storage.objects set name='other/moved.jpg'$q$);
DO $$ DECLARE s public.visit_sessions; today date:=(now() AT TIME ZONE 'Asia/Seoul')::date; req uuid:=gen_random_uuid(); BEGIN
 s:=public.transition_visit_session('10000000-0000-0000-0000-000000000001',today,'in_progress',NULL,NULL,0,req);
 ASSERT s.owner_id=auth.uid(),'RPC session owner';
 ASSERT (SELECT owner_id=auth.uid() AND actor_id=auth.uid() FROM public.visit_session_events WHERE session_id=s.id),'event inherits + actor';
 s:=public.transition_visit_session(s.recipient_id,today,'completed','memo',NULL,s.version);
 s:=public.transition_visit_session(s.recipient_id,today,'planned',s.memo,'correction',s.version);
 ASSERT s.status='planned' AND s.memo='memo','correct completion';
 s:=public.transition_visit_session(s.recipient_id,today,'in_progress',NULL,NULL,0,req);
 ASSERT s.status='in_progress','idempotent retry';
END $$;
SELECT pg_temp.expect_denied('update public.visit_session_events set reason=''forged''');
SELECT pg_temp.expect_denied('insert into public.visit_sessions(recipient_id,recipient_name,visit_date) values(NULL,''fake'',current_date)');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.recipients),'B cannot see A/legacy');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.visit_sessions),'B cannot see A sessions');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.visit_session_events),'B cannot see A events');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM storage.objects),'B cannot see A/legacy files');
SELECT pg_temp.expect_denied($q$insert into public.medications(recipient_id) values('10000000-0000-0000-0000-000000000001')$q$);
SELECT pg_temp.expect_denied($q$insert into public.print_logs(recipient_ids) values(ARRAY['10000000-0000-0000-0000-000000000001']::uuid[])$q$);
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000001',current_date,'completed')$q$);
SELECT pg_temp.expect_denied($q$select public.account_internal_transition_visit_session('10000000-0000-0000-0000-000000000001',current_date,'completed')$q$);
DO $$ DECLARE t text; n integer; BEGIN
 FOREACH t IN ARRAY ARRAY['visit_logs','share_logs','vitals_logs'] LOOP
   PERFORM pg_temp.expect_denied(format('INSERT INTO public.%I(recipient_id) VALUES(%L)',t,'10000000-0000-0000-0000-000000000001'));
 END LOOP;
 UPDATE public.recipients SET name='stolen' WHERE id='10000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT; ASSERT n=0,'cross update affects zero rows';
 DELETE FROM public.recipients WHERE id='10000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT; ASSERT n=0,'cross delete affects zero rows';
END $$;

INSERT INTO public.recipients(id,name) VALUES('10000000-0000-0000-0000-000000000002','B');
SELECT pg_temp.expect_denied($q$update public.recipients set photo_url='https://fixture.test/storage/v1/object/public/recipient-photos/00000000-0000-0000-0000-000000000001/a.jpg'$q$);
SELECT pg_temp.expect_denied($q$insert into public.print_logs(pdf_path) values('00000000-0000-0000-0000-000000000001/a.pdf')$q$);
SELECT pg_temp.expect_denied($q$insert into public.print_logs(recipient_ids) values(ARRAY['10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001']::uuid[])$q$);
DO $$ DECLARE u text; BEGIN
 FOREACH u IN ARRAY ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'] LOOP
 PERFORM set_config('request.jwt.claim.sub',u,true);
 ASSERT public.has_legacy_access(),'three legacy users';
 ASSERT (SELECT count(*)=1 FROM public.recipients),'legacy only';
 ASSERT (SELECT count(*)=2 FROM storage.objects),'legacy files only';
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
INSERT INTO public.recipients(id,name) VALUES('10000000-0000-0000-0000-000000000003','legacy user private');
INSERT INTO public.print_logs(recipient_ids) VALUES(ARRAY['10000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000003']::uuid[]);
SELECT pg_temp.check_true((SELECT owner_id=auth.uid() FROM public.print_logs),'mixed batch private to actor');
INSERT INTO public.medications(recipient_id) VALUES('10000000-0000-0000-0000-000000000000');
SELECT pg_temp.check_true((SELECT owner_id IS NULL FROM public.medications),'legacy child inherits NULL');
SELECT pg_temp.expect_denied($q$insert into public.medications(recipient_id,owner_id) values('10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000002')$q$);
-- Legacy projection trigger must call the guarded wrapper as the original caller.
UPDATE public.recipients SET last_completed_key=(now() AT TIME ZONE 'Asia/Seoul')::date::text,last_completed_memo='legacy edit'
 WHERE id='10000000-0000-0000-0000-000000000003';
SELECT pg_temp.check_true((SELECT status='completed' AND owner_id=auth.uid() FROM public.visit_sessions WHERE recipient_id='10000000-0000-0000-0000-000000000003'),'legacy trigger works with private owner');
-- Start/complete/correct the shared legacy record and save a known retry UUID.
DO $$ DECLARE s public.visit_sessions; today date:=(now() AT TIME ZONE 'Asia/Seoul')::date; BEGIN
 s:=public.transition_visit_session('10000000-0000-0000-0000-000000000000',today,'in_progress',NULL,NULL,0,'20000000-0000-0000-0000-000000000000');
 ASSERT s.owner_id IS NULL,'shared session inherits NULL';
 s:=public.transition_visit_session(s.recipient_id,today,'completed','shared memo',NULL,s.version);
 s:=public.transition_visit_session(s.recipient_id,today,'planned',s.memo,'shared correction',s.version);
 ASSERT s.owner_id IS NULL,'shared correction preserves NULL';
END $$;

INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos',auth.uid()::text||'/shared.jpg');
UPDATE public.recipients SET photo_url='https://fixture.test/storage/v1/object/public/recipient-photos/'||auth.uid()::text||'/shared.jpg' WHERE owner_id IS NULL;
SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000000',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress',NULL,NULL,(SELECT version FROM public.visit_sessions WHERE recipient_id='10000000-0000-0000-0000-000000000000' AND visit_date=(now() AT TIME ZONE 'Asia/Seoul')::date));
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.check_true(public.can_read_storage('recipient-photos','00000000-0000-0000-0000-000000000003/shared.jpg'),'shared recipient new upload readable by other legacy user');
SELECT pg_temp.check_true(NOT public.can_delete_storage('recipient-photos','00000000-0000-0000-0000-000000000003/shared.jpg'),'reference read does not grant delete');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.print_logs),'mixed batch hidden from other legacy user');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000000',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress',NULL,NULL,0,'20000000-0000-0000-0000-000000000000')$q$);

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.check_true(NOT public.is_verified_google_user(),'nongoogle blocked');
SELECT pg_temp.expect_denied($q$insert into public.recipients(name) values('nongoogle')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
SELECT pg_temp.check_true(NOT public.is_verified_google_user(),'unverified blocked');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000000',current_date,'planned',NULL,'forged')$q$);
SET LOCAL ROLE postgres;
UPDATE public.legacy_data_access SET enabled=false WHERE email='jggen0401@gmail.com';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.check_true(NOT public.has_legacy_access(),'admin allowlist disable effective');
SELECT pg_temp.expect_denied($q$select public.transition_visit_session('10000000-0000-0000-0000-000000000000',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress',NULL,NULL,0,'20000000-0000-0000-0000-000000000000')$q$);

SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.recipients),'disabled user loses shared rows');
SET LOCAL ROLE postgres;
UPDATE public.legacy_data_access SET enabled=true WHERE email='jggen0401@gmail.com';
-- Preserve private ownership after recipient deletion, including FK SET NULL.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DELETE FROM public.recipients WHERE id='10000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true((SELECT owner_id=auth.uid() AND recipient_id IS NULL FROM public.visit_sessions),'deleted session ownership retained');
SELECT pg_temp.check_true((SELECT count(*)>0 FROM public.visit_session_events),'deleted recipient audit retained');
SET LOCAL ROLE postgres;
DO $$ BEGIN
 BEGIN UPDATE public.visit_session_events SET reason='tamper'; RAISE EXCEPTION 'accepted tamper';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='accepted tamper' THEN RAISE; END IF; END;
 BEGIN DELETE FROM public.security_change_log; RAISE EXCEPTION 'accepted tamper';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='accepted tamper' THEN RAISE; END IF; END;
 ASSERT (SELECT bool_and(NOT public) FROM storage.buckets),'private buckets';
 ASSERT NOT has_function_privilege('anon','public.transition_visit_session(uuid,date,text,text,text,integer,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.account_internal_transition_visit_session(uuid,date,text,text,text,integer,uuid)','EXECUTE');
 ASSERT (SELECT count(*)>0 FROM public.security_change_log WHERE actor_id IS NOT NULL),'private actor audit';
END $$;

-- Each allowlisted client omits owner_id. RETURNING must report shared NULL,
-- for both single-recipient and recipient_ids-only print events and other logs.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE u text; t text; returned_owner uuid; visible boolean; shared_id uuid:='10000000-0000-0000-0000-000000000000';
 s public.visit_sessions; v integer; today date:=(now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
 FOREACH u IN ARRAY ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'] LOOP
   PERFORM set_config('request.jwt.claim.sub',u,true);
   FOREACH t IN ARRAY ARRAY['print_logs','visit_logs','share_logs','vitals_logs'] LOOP
     EXECUTE format('INSERT INTO public.%I(recipient_id) VALUES($1) RETURNING owner_id',t)
       INTO returned_owner USING shared_id;
     ASSERT returned_owner IS NULL,'legacy client event RETURNING owner_id NULL';
   END LOOP;
   INSERT INTO public.print_logs(recipient_ids) VALUES(ARRAY[shared_id]) RETURNING owner_id INTO returned_owner;
   ASSERT returned_owner IS NULL,'legacy batch event RETURNING owner_id NULL';
   PERFORM pg_temp.expect_denied(format('INSERT INTO public.print_logs(recipient_id,owner_id) VALUES(%L,%L)',shared_id,u));
   SELECT version INTO v FROM public.visit_sessions WHERE recipient_id=shared_id AND visit_date=today;
   s:=public.transition_visit_session(shared_id,today,'completed','shared client test',NULL,v);
   ASSERT s.owner_id IS NULL,'legacy RPC returns shared owner';
   ASSERT EXISTS(SELECT FROM public.visit_session_events WHERE session_id=s.id AND actor_id=u::uuid
     AND owner_id IS NULL AND (after_state->>'version')::integer=s.version),'legacy audit event shared with original actor';
   s:=public.transition_visit_session(shared_id,today,'planned',s.memo,'fixture correction',s.version);
 END LOOP;
 FOREACH u IN ARRAY ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'] LOOP
   PERFORM set_config('request.jwt.claim.sub',u,true);
   ASSERT (SELECT count(*)=6 FROM public.print_logs WHERE recipient_id=shared_id OR recipient_ids=ARRAY[shared_id]),'all three can read all six shared print events';
   FOREACH t IN ARRAY ARRAY['visit_logs','share_logs','vitals_logs'] LOOP
     EXECUTE format('SELECT count(*)=3 FROM public.%I WHERE recipient_id=$1',t) INTO visible USING shared_id;
     ASSERT visible,'all three can read all shared child logs';
   END LOOP;
 END LOOP;
END $$;
SET LOCAL ROLE postgres;
-- Fresh objects must not inherit any client grants, including global PUBLIC EXECUTE.
CREATE TABLE public.isolation_future_table(id bigint);
CREATE SEQUENCE public.isolation_future_sequence;
CREATE FUNCTION public.isolation_future_rpc() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
CREATE SCHEMA isolation_future_schema;
CREATE FUNCTION isolation_future_schema.global_default_probe() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
DO $$ DECLARE who text; t text; BEGIN
 FOREACH who IN ARRAY ARRAY['anon','authenticated'] LOOP
   ASSERT NOT has_function_privilege(who,'public.isolation_future_rpc()','EXECUTE'),'future RPC denied';
   ASSERT NOT has_function_privilege(who,'isolation_future_schema.global_default_probe()','EXECUTE'),'global PUBLIC EXECUTE revoked';
   ASSERT NOT has_table_privilege(who,'public.isolation_future_table','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'future table denied';
   ASSERT NOT has_sequence_privilege(who,'public.isolation_future_sequence','USAGE,SELECT,UPDATE'),'future sequence denied';
 END LOOP;
 ASSERT has_function_privilege('service_role','public.isolation_future_rpc()','EXECUTE'),'future service RPC';
 ASSERT has_table_privilege('service_role','public.isolation_future_table','SELECT,INSERT,UPDATE,DELETE'),'future service table';
 ASSERT has_sequence_privilege('service_role','public.isolation_future_sequence','USAGE,SELECT,UPDATE'),'future service sequence';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   ASSERT EXISTS(SELECT FROM pg_indexes WHERE schemaname='public' AND tablename=t AND indexname=t||'_owner_idx'),'owner index';
   ASSERT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='account_read' AND qual LIKE '%can_access_owner(owner_id)%'),'owner read check';
 END LOOP;
 ASSERT NOT has_table_privilege('authenticated','public.legacy_data_access','SELECT,INSERT,UPDATE,DELETE'),'ACL admin-only';
 ASSERT NOT has_table_privilege('anon','public.legacy_data_access','SELECT,INSERT,UPDATE,DELETE'),'ACL anon denied';
END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000002',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress');
SELECT pg_temp.check_true((SELECT count(*)=3 FROM public.recipients),'service role retains access');


-- Calendar capability isolation, rotation/revocation and live lifecycle enforcement.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ DECLARE token text; BEGIN
 token:=public.rotate_calendar_feed_token();
 ASSERT length(token)=512,'256-byte calendar token';
 PERFORM set_config('test.calendar.raw_a',token,true);
END $$;
SELECT pg_temp.expect_denied('SELECT * FROM calendar_private.feed_tokens');
SELECT pg_temp.expect_denied($q$SELECT * FROM public.resolve_calendar_feed_token('fake')$q$);
SET LOCAL ROLE postgres;
SELECT set_config('test.calendar.hash_a',encode(extensions.digest(current_setting('test.calendar.raw_a'),'sha256'),'hex'),true);
DO $$ BEGIN
 ASSERT (SELECT token_hash=current_setting('test.calendar.hash_a') FROM calendar_private.feed_tokens WHERE owner_id='00000000-0000-0000-0000-000000000003'),'only hash persisted';
END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT owner_id='00000000-0000-0000-0000-000000000003' AND legacy_access FROM public.resolve_calendar_feed_token(current_setting('test.calendar.hash_a'))),'service resolves exact owner');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
DO $$ BEGIN PERFORM public.rotate_calendar_feed_token(); PERFORM public.revoke_calendar_feed_token(); END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.resolve_calendar_feed_token(current_setting('test.calendar.hash_a'))),'another user revoke cannot revoke A token');
SET LOCAL ROLE postgres;
UPDATE public.legacy_data_access SET enabled=false WHERE email='jggen0121@naver.com';
SELECT pg_temp.check_true((SELECT NOT legacy_access FROM public.resolve_calendar_feed_token(current_setting('test.calendar.hash_a'))),'calendar legacy ACL live');
UPDATE public.legacy_data_access SET enabled=true WHERE email='jggen0121@naver.com';
DO $$ DECLARE mutation text; BEGIN
 FOREACH mutation IN ARRAY ARRAY['is_anonymous=true','deleted_at=now()','banned_until=now()+interval ''1 hour'''] LOOP
  EXECUTE 'UPDATE auth.users SET '||mutation||' WHERE id=''00000000-0000-0000-0000-000000000003''';
  ASSERT (SELECT count(*)=0 FROM public.resolve_calendar_feed_token(current_setting('test.calendar.hash_a'))),'calendar lifecycle check';
  UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000003';
 END LOOP;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN PERFORM public.rotate_calendar_feed_token(); END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.resolve_calendar_feed_token(current_setting('test.calendar.hash_a'))),'rotation invalidates old token');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.revoke_calendar_feed_token();
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT * FROM public.resolve_calendar_feed_token('fake')$q$);

-- Service-only fanout authorization: no anonymous legacy subscriptions, no other owners.
SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.push_subscriptions(endpoint,owner_id,p256dh,auth)
 SELECT 'fixture:push:'||id::text,id,'fixture-key','fixture-auth' FROM auth.users;
INSERT INTO public.push_subscriptions(endpoint,owner_id) VALUES('fixture:legacy-anon',NULL);
SET LOCAL ROLE service_role;
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 AND bool_and(endpoint='fixture:push:00000000-0000-0000-0000-000000000002')
  FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'B recipient only B devices';
 ASSERT (SELECT count(*)=1 AND bool_and(endpoint='fixture:push:00000000-0000-0000-0000-000000000003')
  FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'legacy user private recipient only own devices';
 ASSERT (SELECT count(*)=3 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'shared recipient only three allowlisted Google owners';
 ASSERT (SELECT count(*)=0 FROM public.authorized_visit_subscriptions('ffffffff-ffff-ffff-ffff-ffffffffffff')),'unknown recipient no fanout';
END $$;
SET LOCAL ROLE postgres;
UPDATE public.legacy_data_access SET enabled=false WHERE email='jggen0401@gmail.com';
SET LOCAL ROLE service_role;
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'ACL disable immediately removes push fanout');
SET LOCAL ROLE postgres;
UPDATE public.legacy_data_access SET enabled=true WHERE email='jggen0401@gmail.com';
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE service_role;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'unverified private owner no fanout');
SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='00000000-0000-0000-0000-000000000002';

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE auth.users SET is_anonymous=true WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'anonymous existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'anonymous no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'anonymous no own rows';
 ASSERT NOT public.can_access_owner(NULL),'anonymous no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'anonymous no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'anonymous no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'anonymous RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000002',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000002/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'anonymous no private fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'anonymous cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'anonymous cleared restores own fanout');
SET LOCAL ROLE postgres;

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE auth.users SET deleted_at=now() WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'deleted existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'deleted no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'deleted no own rows';
 ASSERT NOT public.can_access_owner(NULL),'deleted no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'deleted no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'deleted no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'deleted RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000002',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000002/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'deleted no private fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'deleted cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'deleted cleared restores own fanout');
SET LOCAL ROLE postgres;

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'banned existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'banned no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'banned no own rows';
 ASSERT NOT public.can_access_owner(NULL),'banned no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'banned no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'banned no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'banned RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000002',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000002/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'banned no private fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'banned cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'banned cleared restores own fanout');
SET LOCAL ROLE postgres;

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000003';
UPDATE auth.users SET is_anonymous=true WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'anonymous existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'anonymous no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'anonymous no own rows';
 ASSERT NOT public.can_access_owner(NULL),'anonymous no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'anonymous no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'anonymous no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'anonymous RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000003',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000003/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'anonymous no private fanout');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'anonymous excluded from shared fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'anonymous cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'anonymous cleared restores own fanout');
SET LOCAL ROLE postgres;

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000003';
UPDATE auth.users SET deleted_at=now() WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'deleted existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'deleted no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'deleted no own rows';
 ASSERT NOT public.can_access_owner(NULL),'deleted no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'deleted no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'deleted no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'deleted RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000003',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000003/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'deleted no private fanout');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'deleted excluded from shared fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'deleted cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'deleted cleared restores own fanout');
SET LOCAL ROLE postgres;

SET LOCAL ROLE postgres;
UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='00000000-0000-0000-0000-000000000003';
UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ DECLARE t text; visible boolean; BEGIN
 ASSERT NOT public.is_verified_google_user(),'banned existing JWT rejected';
 ASSERT NOT public.has_legacy_access(),'banned no legacy ACL';
 ASSERT NOT public.can_access_owner(auth.uid()),'banned no own rows';
 ASSERT NOT public.can_access_owner(NULL),'banned no legacy rows';
 ASSERT NOT public.can_read_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'banned no own file read';
 ASSERT NOT public.can_delete_storage('recipient-photos',auth.uid()::text||'/fixture.jpg'),'banned no own file delete';
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('SELECT count(*)=0 FROM public.%I',t) INTO visible;
   ASSERT visible,'banned RLS all nine tables';
 END LOOP;
END $$;
SELECT pg_temp.expect_denied($q$INSERT INTO public.recipients(name) VALUES('lifecycle denied')$q$);
SELECT pg_temp.expect_denied('SELECT public.rotate_calendar_feed_token()');
SELECT pg_temp.expect_denied('SELECT public.revoke_calendar_feed_token()');
SELECT pg_temp.expect_denied($q$SELECT public.transition_visit_session('10000000-0000-0000-0000-000000000003',(now() AT TIME ZONE 'Asia/Seoul')::date,'in_progress')$q$);
SELECT pg_temp.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('recipient-photos','00000000-0000-0000-0000-000000000003/denied.jpg')$q$);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'banned no private fanout');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'banned excluded from shared fanout');

SET LOCAL ROLE postgres;
UPDATE auth.users SET is_anonymous=false,deleted_at=NULL,banned_until=now()-interval '1 second' WHERE id='00000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT pg_temp.check_true(public.is_verified_google_user(),'banned cleared / expired ban restores live access');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000003')),'banned cleared restores own fanout');
SET LOCAL ROLE postgres;

DELETE FROM auth.identities WHERE user_id='00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE service_role;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000002')),'nongoogle private owner no fanout');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.expect_denied($q$SELECT * FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')$q$);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied($q$SELECT * FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')$q$);
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.authorized_visit_subscriptions('10000000-0000-0000-0000-000000000000')),'non-service JWT role rejected even with SQL admin execute');
RESET ROLE;
ROLLBACK;
"""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', choices=['127.0.0.1', 'localhost', '::1', '/tmp', '/var/run/postgresql'], default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5432)
    parser.add_argument('--database', choices=['careroute_security_test'], default='careroute_security_test')
    parser.add_argument('--user', default=os.environ.get('CAREROUTE_SECURITY_DB_USER', 'postgres'))
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be 1..65535')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]{0,62}', args.user):
        parser.error('user must be a simple role name, never a DSN/connection string')
    psql = shutil.which('psql')
    if not psql:
        parser.error('psql is required')
    names = [
        '20261108000000_visit_sessions.sql',
        '20261109010000_incident_containment.sql',
        '20261109020000_account_data_isolation.sql',
        '20261109030000_account_calendar_feed.sql',
        '20261109040000_account_push_recipients.sql',
        '20261109050000_verified_account_lifecycle.sql',
    ]
    # Reject inherited libpq routing/DSNs/services/hostaddr/options. Only a local
    # password is retained; every connection coordinate is an explicit argv value.
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    if 'PGPASSWORD' in os.environ:
        env['PGPASSWORD'] = os.environ['PGPASSWORD']
    env.update(PGCONNECT_TIMEOUT='5', PGSSLMODE='disable')
    preflight = """
DO $$ BEGIN
 IF current_database()<>'careroute_security_test' THEN
   RAISE EXCEPTION 'Refusing any database other than careroute_security_test';
 END IF;
 IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'Test fixture requires a local superuser';
 END IF;
 IF inet_server_addr() IS NOT NULL AND NOT
    (inet_server_addr() <<= '127.0.0.0/8'::inet OR inet_server_addr()='::1'::inet) THEN
   RAISE EXCEPTION 'Refusing a non-loopback server';
 END IF;
 IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f'))
    OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('auth','storage','calendar_private','extensions')) THEN
   RAISE EXCEPTION 'Test database must be empty';
 END IF;
END $$;
"""
    sql = preflight + fixture + ''.join(migration(name) for name in names) + tests
    result = subprocess.run(
        [psql, '-X', '-q', '-w', '-h', args.host, '-p', str(args.port),
         '-U', args.user, '-d', args.database, '-v', 'ON_ERROR_STOP=1'],
        input=sql, text=True, capture_output=True, env=env,
    )
    if result.returncode:
        # stdout may contain synthetic capability tokens; never emit query results.
        print(result.stderr, end='', file=sys.stderr)
        return result.returncode
    print('PASS: account isolation, lifecycle, calendar, push, storage and default-privilege assertions; all fixture DDL/data/roles rolled back.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
