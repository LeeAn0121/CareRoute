-- Direct per-day schedule removal/restoration; no record reset or history rewrite.
-- Keep the account-checked public wrapper, internal ACL, CAS, retry identity,
-- date validation, legacy projection and append-only audit behavior unchanged.
BEGIN;
-- Fail closed on an installation missing the account-isolation prerequisite;
-- never accidentally create a new internal function with default EXECUTE ACLs.
DO $$ BEGIN
  IF to_regprocedure('public.account_internal_transition_visit_session(uuid,date,text,text,text,integer,uuid)') IS NULL
     OR to_regprocedure('public.transition_visit_session(uuid,date,text,text,text,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Direct visit changes require the account-isolated transition functions';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.account_internal_transition_visit_session(
  p_recipient_id uuid, p_visit_date date, p_status text,
  p_memo text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_expected_version int DEFAULT 0, p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS public.visit_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  s public.visit_sessions; previous jsonb; e public.visit_session_events;
  latest public.visit_sessions; guard text; recipient public.recipients;
  restored public.visit_sessions; restore_previous boolean := false;
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
  -- Saving a completed form (including unchanged memo with vitals) is an
  -- audited, versioned operation. Request identity above handles retries, while
  -- CAS above rejects stale forms even when their memo has not changed.
  IF s.version > 0 AND s.status = p_status AND p_status <> 'completed' THEN
    RAISE EXCEPTION 'Session already has requested status; retry with original request_id';
  END IF;
  -- Undo only the cancellation at the current CAS version. The client names the
  -- old status/memo, but actual visit timestamps come from immutable server
  -- audit, never client arguments. A later change makes this undo stale.
  IF s.status = 'cancelled' AND p_status IN ('in_progress','completed','missed') THEN
    SELECT * INTO e FROM public.visit_session_events
      WHERE session_id = s.id AND to_status = 'cancelled'
        AND (after_state->>'version')::integer = s.version;
    IF NOT FOUND OR e.before_state IS NULL THEN
      RAISE EXCEPTION 'Cancellation has no restorable prior snapshot' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO restored FROM jsonb_populate_record(NULL::public.visit_sessions, e.before_state);
    IF restored.id IS DISTINCT FROM s.id
       OR restored.recipient_id IS DISTINCT FROM p_recipient_id
       OR restored.visit_date IS DISTINCT FROM p_visit_date
       OR restored.version IS DISTINCT FROM s.version - 1
       OR restored.status IS DISTINCT FROM p_status
       OR restored.memo IS DISTINCT FROM p_memo THEN
      RAISE EXCEPTION 'Cancellation undo must match the immediate prior status and memo' USING ERRCODE = '22023';
    END IF;
    restore_previous := true;
  END IF;
  -- Schedule removal and restoration are direct operations. They still append
  -- immutable before/after audit snapshots with the caller's optional reason.
  IF s.status IN ('missed','cancelled') AND p_status NOT IN ('planned','cancelled') AND NOT restore_previous THEN
    RAISE EXCEPTION 'Missed/cancelled sessions require a planned restoration first';
  END IF;
  IF s.status = 'completed' AND p_status NOT IN ('planned','cancelled','completed') THEN
    RAISE EXCEPTION 'Completed sessions require a planned restoration or cancellation';
  END IF;
  -- Recording a missed visit retains its existing reason requirement; removing
  -- a schedule (cancelled) or restoring it (planned) does not require one.
  IF p_status = 'missed' AND nullif(btrim(p_reason), '') IS NULL AND NOT restore_previous THEN
    RAISE EXCEPTION 'Missed sessions require a reason';
  END IF;
  IF (p_status = 'in_progress' AND p_visit_date <> today)
     OR (p_status IN ('completed','missed') AND p_visit_date > today) THEN
    RAISE EXCEPTION 'Invalid visit date for requested status';
  END IF;
  previous := CASE WHEN s.version = 0 THEN NULL ELSE to_jsonb(s) END;
  UPDATE public.visit_sessions SET
    status = p_status, memo = p_memo, recipient_name = recipient.name,
    started_at = CASE WHEN restore_previous THEN restored.started_at
                      WHEN p_status = 'in_progress' THEN coalesce(s.started_at,
      CASE WHEN (recipient.last_visit_started_at AT TIME ZONE 'Asia/Seoul')::date = today
        THEN recipient.last_visit_started_at END, statement_timestamp())
                      WHEN p_status = 'completed' THEN s.started_at ELSE NULL END,
    completed_at = CASE WHEN restore_previous THEN restored.completed_at
                        WHEN p_status = 'completed' AND s.status = 'completed' THEN s.completed_at
                        WHEN p_status = 'completed' THEN statement_timestamp() ELSE NULL END,
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
-- CREATE OR REPLACE preserves existing ownership and ACLs. Do not grant access
-- to the internal implementation or change the guarded public entry point.
-- iCal retirement: the deployed table has no revoked_at; its existing revoke
-- RPC deletes these capability rows too. Revoke existing feed URLs only. No
-- patient rows or Google Calendar push-sync data are changed. Stop retired
-- installed clients from issuing replacement tokens; function-owner/admin
-- execution is retained, and no new privileges are granted.
REVOKE EXECUTE ON FUNCTION public.rotate_calendar_feed_token() FROM PUBLIC, anon, authenticated;
DELETE FROM calendar_private.feed_tokens;
NOTIFY pgrst, 'reload schema';
COMMIT;
