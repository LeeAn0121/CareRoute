-- Apply after 20261109020000_account_data_isolation.sql. No global-token fallback.
BEGIN;
CREATE SCHEMA IF NOT EXISTS calendar_private;
REVOKE ALL ON SCHEMA calendar_private FROM PUBLIC, anon, authenticated;
CREATE TABLE calendar_private.feed_tokens (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE calendar_private.feed_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_private.feed_tokens FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rotate_calendar_feed_token() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE raw_token text;
BEGIN
  IF NOT public.is_verified_google_user() THEN
    RAISE EXCEPTION 'Verified Google sign-in required' USING ERRCODE='42501';
  END IF;
  -- 256 random bytes, not a JWT. Only its SHA-256 hash is retained.
  raw_token := encode(extensions.gen_random_bytes(256), 'hex');
  INSERT INTO calendar_private.feed_tokens(owner_id, token_hash)
  VALUES (auth.uid(), encode(extensions.digest(raw_token, 'sha256'), 'hex'))
  ON CONFLICT (owner_id) DO UPDATE
    SET token_hash=EXCLUDED.token_hash, issued_at=now();
  RETURN raw_token;
END;
$$;

CREATE FUNCTION public.revoke_calendar_feed_token() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT public.is_verified_google_user() THEN
    RAISE EXCEPTION 'Verified Google sign-in required' USING ERRCODE='42501';
  END IF;
  DELETE FROM calendar_private.feed_tokens WHERE owner_id=auth.uid();
END;
$$;

-- Service-role only: one indexed hash match, with live identity and legacy ACL checks.
CREATE FUNCTION public.resolve_calendar_feed_token(p_token_hash text)
RETURNS TABLE(owner_id uuid, legacy_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT t.owner_id, EXISTS (
    SELECT 1 FROM public.legacy_data_access a
    WHERE a.email=lower(btrim(u.email)) AND a.enabled
  )
  FROM calendar_private.feed_tokens t JOIN auth.users u ON u.id=t.owner_id
  WHERE t.token_hash=p_token_hash AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND NOT coalesce(u.is_anonymous,false)
    AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google');
$$;
REVOKE ALL ON FUNCTION public.rotate_calendar_feed_token(), public.revoke_calendar_feed_token(),
  public.resolve_calendar_feed_token(text) FROM PUBLIC, anon, authenticated, service_role;
-- Explicit entrypoints even when account isolation revokes default function grants.
GRANT EXECUTE ON FUNCTION public.rotate_calendar_feed_token(), public.revoke_calendar_feed_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_calendar_feed_token(text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
