-- Account isolation after incident containment. No legacy ownership backfill.
-- Deploy this file alone after 20261109010000; cron remains paused, buckets private.
BEGIN;

CREATE TABLE public.legacy_data_access (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO public.legacy_data_access(email) VALUES
 ('jggen0121@naver.com'), ('jggen0401@gmail.com'), ('jggen4177@gmail.com');
CREATE TABLE public.legacy_storage_objects (
  bucket_id text NOT NULL, name text NOT NULL, PRIMARY KEY(bucket_id, name)
);
INSERT INTO public.legacy_storage_objects SELECT bucket_id, name FROM storage.objects
 WHERE bucket_id IN ('recipient-photos', 'print-pdfs');
CREATE TABLE public.security_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid, table_name text NOT NULL, operation text NOT NULL,
  before_state jsonb, after_state jsonb
);
ALTER TABLE public.legacy_data_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_data_access, public.legacy_storage_objects, public.security_change_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.legacy_data_access, public.legacy_storage_objects, public.security_change_log TO service_role;

CREATE FUNCTION public.is_verified_google_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google'));
$$;
CREATE FUNCTION public.has_legacy_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.is_verified_google_user() AND EXISTS (
   SELECT 1 FROM auth.users u JOIN public.legacy_data_access a ON a.email=lower(btrim(u.email))
   WHERE u.id=auth.uid() AND a.enabled);
$$;
CREATE FUNCTION public.can_access_owner(p_owner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.is_verified_google_user() AND
   coalesce(p_owner=auth.uid() OR (p_owner IS NULL AND public.has_legacy_access()),false);
$$;
-- Never use SECURITY DEFINER current_user as caller identity. The role GUC is
-- the invoking SET ROLE, unchanged by SECURITY DEFINER; 'none' needs a real admin session.
CREATE FUNCTION public.is_account_data_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT coalesce(auth.role()='service_role',false)
 OR current_setting('role',true) IN ('postgres','supabase_admin')
 OR (current_setting('role',true)='none' AND session_user IN ('postgres','supabase_admin'));
$$;

DO $$ DECLARE t text; p record; BEGIN
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('ALTER TABLE public.%I ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT',t);
   EXECUTE format('CREATE INDEX %I ON public.%I(owner_id)',t||'_owner_idx',t);
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY account_read ON public.%I FOR SELECT TO authenticated USING (public.can_access_owner(owner_id))',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   IF t NOT IN ('visit_sessions','visit_session_events') THEN
     EXECUTE format('CREATE POLICY account_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_owner(owner_id))',t);
     EXECUTE format('CREATE POLICY account_delete ON public.%I FOR DELETE TO authenticated USING (public.can_access_owner(owner_id))',t);
     EXECUTE format('GRANT INSERT, DELETE ON public.%I TO authenticated',t);
   END IF;
   IF t IN ('recipients','medications','push_subscriptions') THEN
     EXECUTE format('CREATE POLICY account_update ON public.%I FOR UPDATE TO authenticated USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id))',t);
     EXECUTE format('GRANT UPDATE ON public.%I TO authenticated',t);
   END IF;
 END LOOP;
END $$;
ALTER TABLE public.recipients ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.push_subscriptions ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.visit_session_events ADD COLUMN actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Bypass RLS only inside helpers to avoid recursion. References never authorize
-- themselves: the write trigger below validates every new photo/PDF reference.
CREATE FUNCTION public.can_read_storage(p_bucket text, p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.is_verified_google_user() AND p_bucket IN ('recipient-photos','print-pdfs') AND (
   split_part(p_name,'/',1)=auth.uid()::text
   OR (public.has_legacy_access() AND EXISTS (SELECT 1 FROM public.legacy_storage_objects l WHERE l.bucket_id=p_bucket AND l.name=p_name))
   OR (p_bucket='recipient-photos' AND EXISTS (SELECT 1 FROM public.recipients r
      WHERE public.can_access_owner(r.owner_id)
      AND split_part(r.photo_url,'?',1) ~ '^https?://[^/]+/storage/v1/object/(public|authenticated|sign)/recipient-photos/'
      AND regexp_replace(split_part(r.photo_url,'?',1),'^https?://[^/]+/storage/v1/object/(public|authenticated|sign)/recipient-photos/','')=p_name))
   OR (p_bucket='print-pdfs' AND EXISTS (SELECT 1 FROM public.print_logs l WHERE l.pdf_path=p_name AND public.can_access_owner(l.owner_id)))
 );
$$;

CREATE FUNCTION public.enforce_account_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE parent_owner uuid; candidate uuid; ids uuid[] := ARRAY[]::uuid[];
 j jsonb := to_jsonb(NEW); oldj jsonb; chosen uuid; seen boolean := false;
 mixed boolean := false; path text; admin boolean := public.is_account_data_admin();
BEGIN
 IF TG_OP='UPDATE' THEN
   oldj := to_jsonb(OLD);
   IF NOT admin AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
     RAISE EXCEPTION 'owner_id is immutable' USING ERRCODE='42501';
   END IF;
   -- FK SET NULL must retain ownership. Validate only newly changed links.
   IF j->>'recipient_id' IS NOT DISTINCT FROM oldj->>'recipient_id'
      AND j->'recipient_ids' IS NOT DISTINCT FROM oldj->'recipient_ids'
      AND j->>'session_id' IS NOT DISTINCT FROM oldj->>'session_id' THEN
     ids := NULL;
   END IF;
 END IF;
 IF NOT admin AND NOT public.is_verified_google_user() THEN
   RAISE EXCEPTION 'Verified Google sign-in required' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='visit_session_events' AND TG_OP='INSERT' THEN
   SELECT owner_id INTO parent_owner FROM public.visit_sessions WHERE id=NEW.session_id FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invalid session' USING ERRCODE='42501'; END IF;
   IF NOT admin AND NOT public.can_access_owner(parent_owner) THEN RAISE EXCEPTION 'Session denied' USING ERRCODE='42501'; END IF;
   NEW.owner_id := parent_owner;
   NEW.actor_id := auth.uid();
 ELSIF TG_TABLE_NAME IN ('recipients','push_subscriptions') THEN
   IF TG_OP='INSERT' AND NOT admin THEN
     IF NEW.owner_id IS NOT NULL AND NEW.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Owner denied' USING ERRCODE='42501'; END IF;
     NEW.owner_id := auth.uid();
   END IF;
 ELSIF ids IS NOT NULL THEN
   IF j->>'recipient_id' IS NOT NULL THEN ids := array_append(ids,(j->>'recipient_id')::uuid); END IF;
   IF TG_TABLE_NAME='print_logs' AND jsonb_typeof(j->'recipient_ids')='array' THEN
     SELECT ids || coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO ids FROM jsonb_array_elements_text(j->'recipient_ids');
   END IF;
   FOREACH candidate IN ARRAY ids LOOP
     SELECT owner_id INTO parent_owner FROM public.recipients WHERE id=candidate FOR KEY SHARE;
     IF NOT FOUND OR candidate IS NULL THEN RAISE EXCEPTION 'Invalid recipient' USING ERRCODE='42501'; END IF;
     IF NOT admin AND NOT public.can_access_owner(parent_owner) THEN RAISE EXCEPTION 'Recipient denied' USING ERRCODE='42501'; END IF;
     IF NOT seen THEN chosen:=parent_owner; seen:=true;
     ELSIF chosen IS DISTINCT FROM parent_owner THEN mixed:=true;
     END IF;
   END LOOP;
   IF TG_OP='INSERT' THEN
     -- User-supplied owner is never authoritative. No parent => private to actor.
     NEW.owner_id := CASE WHEN seen AND NOT mixed THEN chosen ELSE auth.uid() END;
     IF admin AND NOT seen AND j->>'owner_id' IS NOT NULL THEN NEW.owner_id:=(j->>'owner_id')::uuid; END IF;
     IF NOT admin AND j->>'owner_id' IS NOT NULL AND (j->>'owner_id')::uuid IS DISTINCT FROM NEW.owner_id THEN
       RAISE EXCEPTION 'Owner denied' USING ERRCODE='42501';
     END IF;
   ELSIF seen AND NEW.owner_id IS DISTINCT FROM (CASE WHEN mixed THEN auth.uid() ELSE chosen END) THEN
     RAISE EXCEPTION 'Reparenting changes ownership' USING ERRCODE='42501';
   END IF;
 END IF;
 -- Prevent references to guessed paths from turning can_read_storage into a grant oracle.
 IF NOT admin AND TG_TABLE_NAME='recipients' AND j->>'photo_url' IS NOT NULL
   AND (TG_OP='INSERT' OR j->>'photo_url' IS DISTINCT FROM oldj->>'photo_url') THEN
   path:=regexp_replace(split_part(j->>'photo_url','?',1),'^https?://[^/]+/storage/v1/object/(public|authenticated|sign)/recipient-photos/','');
   IF path=split_part(j->>'photo_url','?',1) OR NOT public.can_read_storage('recipient-photos',path) THEN
     RAISE EXCEPTION 'Photo reference denied' USING ERRCODE='42501';
   END IF;
 END IF;
 IF NOT admin AND TG_TABLE_NAME='print_logs' AND nullif(j->>'pdf_path','') IS NOT NULL
   AND (TG_OP='INSERT' OR j->>'pdf_path' IS DISTINCT FROM oldj->>'pdf_path')
   AND NOT public.can_read_storage('print-pdfs',j->>'pdf_path') THEN
   RAISE EXCEPTION 'PDF reference denied' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events'] LOOP
   EXECUTE format('CREATE TRIGGER account_owner_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_account_owner()',t);
 END LOOP;
END $$;

-- Preserve the implementation and its CAS/idempotency checks; guard before retry lookup too.
ALTER FUNCTION public.transition_visit_session(uuid,date,text,text,text,int,uuid) RENAME TO account_internal_transition_visit_session;
REVOKE ALL ON FUNCTION public.account_internal_transition_visit_session(uuid,date,text,text,text,int,uuid) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.transition_visit_session(
 p_recipient_id uuid, p_visit_date date, p_status text, p_memo text DEFAULT NULL,
 p_reason text DEFAULT NULL, p_expected_version int DEFAULT 0, p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS public.visit_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE own uuid;
BEGIN
 SELECT owner_id INTO own FROM public.recipients WHERE id=p_recipient_id FOR UPDATE;
 IF NOT FOUND OR (NOT public.is_account_data_admin() AND NOT public.can_access_owner(own)) THEN
   RAISE EXCEPTION 'Recipient access denied' USING ERRCODE='42501';
 END IF;
 RETURN public.account_internal_transition_visit_session(p_recipient_id,p_visit_date,p_status,p_memo,p_reason,p_expected_version,p_request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_visit_session(uuid,date,text,text,text,int,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_visit_session(uuid,date,text,text,text,int,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_legacy_visit_session(), public.reject_visit_session_event_mutation(), public.visit_session_legacy_date(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.audit_account_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 INSERT INTO public.security_change_log(actor_id,table_name,operation,before_state,after_state)
 VALUES(auth.uid(),TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 RETURN NULL;
END;
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['recipients','push_subscriptions','print_logs','visit_logs','medications','share_logs','vitals_logs','visit_sessions','visit_session_events','legacy_data_access','legacy_storage_objects'] LOOP
   EXECUTE format('CREATE TRIGGER account_change_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_account_change()',t);
 END LOOP;
END $$;
CREATE TRIGGER security_change_log_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.security_change_log
 FOR EACH STATEMENT EXECUTE FUNCTION public.reject_visit_session_event_mutation();

-- Replace every old storage policy: permissive policies combine with OR.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
   EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
 END LOOP;
END $$;
-- Managed Supabase storage tables are owned by supabase_storage_admin. Verify
-- its existing RLS setting rather than attempting a forbidden ALTER TABLE.
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
   RAISE EXCEPTION 'Storage RLS must be enabled before access is restored';
 END IF;
END $$;
UPDATE storage.buckets SET public=false WHERE id IN ('recipient-photos','print-pdfs');
CREATE POLICY account_storage_read ON storage.objects FOR SELECT TO authenticated
 USING (public.can_read_storage(bucket_id,name));
CREATE POLICY account_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (public.is_verified_google_user() AND bucket_id IN ('recipient-photos','print-pdfs') AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY account_storage_update ON storage.objects FOR UPDATE TO authenticated
 USING (public.is_verified_google_user() AND bucket_id IN ('recipient-photos','print-pdfs') AND split_part(name,'/',1)=auth.uid()::text)
 WITH CHECK (public.is_verified_google_user() AND bucket_id IN ('recipient-photos','print-pdfs') AND split_part(name,'/',1)=auth.uid()::text);
CREATE FUNCTION public.can_delete_storage(p_bucket text,p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.is_verified_google_user() AND p_bucket IN ('recipient-photos','print-pdfs') AND
 (split_part(p_name,'/',1)=auth.uid()::text OR (public.has_legacy_access() AND EXISTS
 (SELECT 1 FROM public.legacy_storage_objects l WHERE l.bucket_id=p_bucket AND l.name=p_name)));
$$;
CREATE POLICY account_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING (public.can_delete_storage(bucket_id,name));
REVOKE ALL ON storage.objects FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
-- Explicit grants only; containment stays in force for every unrelated function.
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY[
 'public.is_verified_google_user()'::regprocedure,'public.has_legacy_access()'::regprocedure,
 'public.can_access_owner(uuid)'::regprocedure,'public.is_account_data_admin()'::regprocedure,
 'public.can_read_storage(text,text)'::regprocedure,'public.can_delete_storage(text,text)'::regprocedure,
 'public.enforce_account_owner()'::regprocedure,'public.audit_account_change()'::regprocedure] LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.is_verified_google_user(), public.has_legacy_access(), public.can_access_owner(uuid), public.can_read_storage(text,text), public.can_delete_storage(text,text) TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
-- Future postgres-created objects are closed unless a migration explicitly opens them.
-- Global revokes are essential: IN SCHEMA revokes cannot subtract global grants,
-- including PostgreSQL's built-in PUBLIC EXECUTE default for new functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
-- Keep service integration access explicit; client grants remain opt-in per object.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
