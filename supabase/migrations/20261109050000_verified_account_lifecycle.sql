-- Check live Auth lifecycle state on every data authorization, even with an
-- otherwise valid, unexpired JWT. Do not modify the applied isolation migration.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_verified_google_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM auth.users u
   WHERE u.id=auth.uid()
     AND u.email_confirmed_at IS NOT NULL
     AND u.is_anonymous IS FALSE
     AND u.deleted_at IS NULL
     AND (u.banned_until IS NULL OR u.banned_until<=now())
     AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google')
 );
$$;
REVOKE ALL ON FUNCTION public.is_verified_google_user() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_google_user() TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
