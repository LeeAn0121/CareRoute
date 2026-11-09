BEGIN;
-- Legacy anonymous subscriptions have no verified owner and are never selected.
CREATE FUNCTION public.authorized_visit_subscriptions(p_recipient_id uuid)
RETURNS TABLE(id uuid, endpoint text, p256dh text, auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT DISTINCT s.id,s.endpoint,s.p256dh,s.auth
 FROM public.push_subscriptions s
 JOIN auth.users u ON u.id=s.owner_id AND u.email_confirmed_at IS NOT NULL
   AND u.is_anonymous IS FALSE AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now())
 JOIN public.recipients r ON r.id=p_recipient_id
 WHERE auth.role()='service_role'
 AND EXISTS(SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google')
 AND (r.owner_id=s.owner_id OR (r.owner_id IS NULL AND EXISTS(
   SELECT 1 FROM public.legacy_data_access a WHERE a.email=lower(btrim(u.email)) AND a.enabled)));
$$;
REVOKE ALL ON FUNCTION public.authorized_visit_subscriptions(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorized_visit_subscriptions(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
