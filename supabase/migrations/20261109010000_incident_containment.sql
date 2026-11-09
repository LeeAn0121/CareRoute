-- Emergency containment. Preserve rows and service-role access for investigation.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
UPDATE storage.buckets SET public = false WHERE id IN ('recipient-photos', 'print-pdfs');
CREATE POLICY incident_private_files ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (bucket_id NOT IN ('recipient-photos', 'print-pdfs'))
WITH CHECK (bucket_id NOT IN ('recipient-photos', 'print-pdfs'));
DO $$ DECLARE r record; BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR r IN SELECT jobid FROM cron.job WHERE command LIKE '%send-visit-reminders%' AND active LOOP
      PERFORM cron.alter_job(r.jobid, active := false);
    END LOOP;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
