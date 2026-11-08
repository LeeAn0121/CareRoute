-- Canonical per-day state. Calendar dates always use Korea time.
-- No visit_logs inference: a legacy correction may have invalidated those logs.
BEGIN;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS last_completed_key text;

CREATE TABLE public.visit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  visit_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','missed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  memo text,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, visit_date)
);
CREATE TABLE public.visit_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.visit_sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  from_status text,
  to_status text NOT NULL,
  before_state jsonb,
  after_state jsonb NOT NULL,
  request_id uuid NOT NULL UNIQUE
);
CREATE INDEX visit_session_events_session_idx ON public.visit_session_events(session_id, created_at);
CREATE INDEX visit_sessions_date_recipient_idx ON public.visit_sessions(visit_date, recipient_id);
CREATE INDEX visit_sessions_latest_completed_idx
  ON public.visit_sessions(recipient_id, visit_date DESC) WHERE status = 'completed';
ALTER TABLE public.visit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_sessions_public_read ON public.visit_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY visit_session_events_public_read ON public.visit_session_events FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.visit_sessions, public.visit_session_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.visit_sessions, public.visit_session_events TO anon, authenticated;

-- Reject invalid date strings without normalizing (to_date alone normalizes dates).
CREATE FUNCTION public.visit_session_legacy_date(p_key text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE d date;
BEGIN
  IF p_key IS NULL OR p_key !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
  BEGIN d := p_key::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL; END;
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.visit_session_legacy_date(text) FROM PUBLIC, anon, authenticated;

-- Unknown historical actual completion time stays NULL, including in audit snapshots.
-- Invalid/future legacy keys remain untouched on recipients but cannot seed completed sessions.
INSERT INTO public.visit_sessions(recipient_id, recipient_name, visit_date, status, memo, version)
SELECT id, name, public.visit_session_legacy_date(last_completed_key), 'completed', last_completed_memo, 1
FROM public.recipients
WHERE public.visit_session_legacy_date(last_completed_key) <= (statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
-- Preserve a known actual start only for today's unfinished visit.
INSERT INTO public.visit_sessions(recipient_id, recipient_name, visit_date, status, started_at, version)
SELECT id, name, (last_visit_started_at AT TIME ZONE 'Asia/Seoul')::date,
  'in_progress', last_visit_started_at, 1
FROM public.recipients
WHERE last_visit_started_at IS NOT NULL
  AND (last_visit_started_at AT TIME ZONE 'Asia/Seoul')::date = (statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date
ON CONFLICT (recipient_id, visit_date) DO NOTHING;
-- Initial snapshots include all nullable fields; SQL NULL before_state means no prior session.
-- The JSON recipient ID/name survive later ON DELETE SET NULL on the live session.
INSERT INTO public.visit_session_events(session_id, reason, from_status, to_status, before_state, after_state, request_id)
SELECT id, CASE WHEN status = 'completed' THEN '기존 최근 완료일 이관 (실제 완료 시각 알 수 없음)'
  ELSE '기존 오늘 방문 시작 시각 이관' END, NULL, status, NULL, to_jsonb(s), gen_random_uuid()
FROM public.visit_sessions s;

CREATE FUNCTION public.transition_visit_session(
  p_recipient_id uuid, p_visit_date date, p_status text,
  p_memo text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_expected_version int DEFAULT 0, p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS public.visit_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  s public.visit_sessions; previous jsonb; e public.visit_session_events;
  latest public.visit_sessions; guard text; recipient public.recipients;
  today date := (statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  -- Every entry point obtains the recipient lock before any session lock.
  SELECT * INTO recipient FROM public.recipients WHERE id = p_recipient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient not found' USING ERRCODE = 'P0002'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  SELECT * INTO e FROM public.visit_session_events WHERE request_id = p_request_id;
  IF FOUND THEN
    IF (e.after_state->>'recipient_id')::uuid IS DISTINCT FROM p_recipient_id
       OR (e.after_state->>'visit_date')::date IS DISTINCT FROM p_visit_date
       OR e.to_status IS DISTINCT FROM p_status
       OR e.after_state->>'memo' IS DISTINCT FROM p_memo
       OR e.reason IS DISTINCT FROM nullif(btrim(p_reason), '') THEN
      RAISE EXCEPTION 'request_id already used for a different operation' USING ERRCODE = '22023';
    END IF;
    -- Return the original result even if later transitions changed the session.
    SELECT * INTO s FROM jsonb_populate_record(NULL::public.visit_sessions, e.after_state);
    RETURN s;
  END IF;
  IF p_visit_date IS NULL OR p_status IS NULL OR p_status NOT IN ('planned','in_progress','completed','missed','cancelled')
     OR p_expected_version IS NULL OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'Invalid transition arguments' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.visit_sessions(recipient_id, recipient_name, visit_date) VALUES (p_recipient_id, recipient.name, p_visit_date)
    ON CONFLICT (recipient_id, visit_date) DO NOTHING;
  SELECT * INTO s FROM public.visit_sessions WHERE recipient_id = p_recipient_id AND visit_date = p_visit_date FOR UPDATE;
  IF s.version <> p_expected_version THEN
    RAISE EXCEPTION 'Stale visit session version: expected %, actual %', p_expected_version, s.version USING ERRCODE = '40001';
  END IF;
  -- A first planned row is creation; repeating any persisted status is not a transition.
  IF s.version > 0 AND s.status = p_status THEN
    RAISE EXCEPTION 'Session already has requested status; retry with original request_id';
  END IF;
  IF s.status IN ('missed','cancelled') AND p_status <> 'planned' THEN
    RAISE EXCEPTION 'Missed/cancelled sessions require a planned correction first';
  END IF;
  IF p_status = 'planned' AND s.status <> 'planned' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Returning to planned requires a correction reason';
  END IF;
  IF s.status = 'completed' AND (p_status <> 'planned' OR nullif(btrim(p_reason), '') IS NULL) THEN
    RAISE EXCEPTION 'Completed sessions require a planned correction with a reason';
  END IF;
  IF p_status IN ('missed','cancelled') AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Missed/cancelled sessions require a reason';
  END IF;
  IF (p_status = 'in_progress' AND p_visit_date <> today)
     OR (p_status IN ('completed','missed') AND p_visit_date > today) THEN
    RAISE EXCEPTION 'Invalid visit date for requested status';
  END IF;
  previous := CASE WHEN s.version = 0 THEN NULL ELSE to_jsonb(s) END;
  UPDATE public.visit_sessions SET
    status = p_status, memo = p_memo, recipient_name = recipient.name,
    started_at = CASE WHEN p_status = 'in_progress' THEN coalesce(s.started_at,
      CASE WHEN (recipient.last_visit_started_at AT TIME ZONE 'Asia/Seoul')::date = today
        THEN recipient.last_visit_started_at END, statement_timestamp())
                      WHEN p_status = 'completed' THEN s.started_at ELSE NULL END,
    completed_at = CASE WHEN p_status = 'completed' THEN statement_timestamp() ELSE NULL END,
    version = s.version + 1, updated_at = statement_timestamp()
    WHERE id = s.id RETURNING * INTO s;
  INSERT INTO public.visit_session_events(session_id, reason, from_status, to_status, before_state, after_state, request_id)
  VALUES (s.id, nullif(btrim(p_reason), ''), previous->>'status', s.status, previous, to_jsonb(s), p_request_id);
  SELECT * INTO latest FROM public.visit_sessions
    WHERE recipient_id = p_recipient_id AND status = 'completed' ORDER BY visit_date DESC LIMIT 1;
  guard := current_setting('careroute.visit_session_sync', true);
  PERFORM set_config('careroute.visit_session_sync', 'on', true);
  UPDATE public.recipients SET last_completed_key = to_char(latest.visit_date, 'YYYY-MM-DD'),
    last_completed_memo = latest.memo,
    last_visit_started_at = (SELECT started_at FROM public.visit_sessions
      WHERE recipient_id = p_recipient_id AND visit_date = today AND status = 'in_progress')
    WHERE id = p_recipient_id;
  PERFORM set_config('careroute.visit_session_sync', coalesce(guard, ''), true);
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_visit_session(uuid,date,text,text,text,int,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_visit_session(uuid,date,text,text,text,int,uuid) TO anon, authenticated;

-- AFTER trigger allows the RPC to refresh the legacy projection in the same transaction.
CREATE FUNCTION public.sync_legacy_visit_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  old_day date; new_day date; s public.visit_sessions;
  today date := (statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF current_setting('careroute.visit_session_sync', true) = 'on' THEN RETURN NEW; END IF;
  old_day := public.visit_session_legacy_date(OLD.last_completed_key);
  new_day := public.visit_session_legacy_date(NEW.last_completed_key);
  IF NEW.last_completed_key IS NOT NULL AND new_day IS NULL THEN
    RAISE EXCEPTION 'Invalid legacy completion date';
  END IF;
  IF new_day > today THEN
    RAISE EXCEPTION 'Legacy completion cannot be in the future';
  END IF;
  -- A date advance adds history. Only an explicit NULL is a legacy undo.
  IF NEW.last_completed_key IS NULL AND old_day IS NOT NULL THEN
    SELECT * INTO s FROM public.visit_sessions WHERE recipient_id = NEW.id AND visit_date = old_day;
    IF FOUND AND s.status = 'completed' THEN
      PERFORM public.transition_visit_session(NEW.id, old_day, 'planned', s.memo, '이전 버전 앱에서 정정', s.version);
    END IF;
  END IF;
  IF new_day IS NOT NULL AND (old_day IS DISTINCT FROM new_day OR OLD.last_completed_memo IS DISTINCT FROM NEW.last_completed_memo) THEN
    SELECT * INTO s FROM public.visit_sessions WHERE recipient_id = NEW.id AND visit_date = new_day;
    IF FOUND AND s.status = 'completed' THEN
      PERFORM public.transition_visit_session(NEW.id, new_day, 'planned', s.memo, '이전 버전 앱에서 정정', s.version);
    END IF;
    SELECT * INTO s FROM public.visit_sessions WHERE recipient_id = NEW.id AND visit_date = new_day;
    PERFORM public.transition_visit_session(NEW.id, new_day, 'completed', NEW.last_completed_memo,
      '이전 버전 앱에서 완료', coalesce(s.version, 0));
  END IF;
  IF OLD.last_visit_started_at IS DISTINCT FROM NEW.last_visit_started_at THEN
    IF NEW.last_visit_started_at IS NOT NULL AND (NEW.last_visit_started_at AT TIME ZONE 'Asia/Seoul')::date <> today THEN
      RAISE EXCEPTION 'Legacy visit start must be today';
    END IF;
    SELECT * INTO s FROM public.visit_sessions WHERE recipient_id = NEW.id AND visit_date = today;
    IF NEW.last_visit_started_at IS NOT NULL THEN
      -- RPC reads the locked recipient and preserves this valid actual legacy start.
      PERFORM public.transition_visit_session(NEW.id, today, 'in_progress', s.memo, '이전 버전 앱에서 시작', coalesce(s.version, 0));
    ELSIF FOUND AND s.status = 'in_progress' THEN
      PERFORM public.transition_visit_session(NEW.id, today, 'planned', s.memo, '이전 버전 앱에서 시작 취소', s.version);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_legacy_visit_session() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER recipients_sync_legacy_visit_session
AFTER UPDATE OF last_completed_key, last_completed_memo, last_visit_started_at ON public.recipients
FOR EACH ROW WHEN (OLD.last_completed_key IS DISTINCT FROM NEW.last_completed_key
  OR OLD.last_completed_memo IS DISTINCT FROM NEW.last_completed_memo
  OR OLD.last_visit_started_at IS DISTINCT FROM NEW.last_visit_started_at)
EXECUTE FUNCTION public.sync_legacy_visit_session();

-- Audit rows are immutable even for accidental privileged DML. No cascading deletes.
CREATE FUNCTION public.reject_visit_session_event_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'visit_session_events is append-only'; END;
$$;
REVOKE ALL ON FUNCTION public.reject_visit_session_event_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER visit_session_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
ON public.visit_session_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_visit_session_event_mutation();
COMMIT;
