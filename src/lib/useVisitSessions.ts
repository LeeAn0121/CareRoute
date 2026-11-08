'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVisitSessions, localDateKey, sessionKey, type VisitSession } from './visitSessions';

export function useVisitDay() {
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setToday(localDateKey());
      const next = new Date(); next.setHours(24, 0, 0, 80);
      timer = setTimeout(update, Math.max(80, next.getTime() - Date.now()));
    };
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);
  return today;
}

export function useVisitSessions(today: string, selected: string) {
  const [sessions, setSessions] = useState<Record<string, VisitSession>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const dates = new Set([today, selected]);
      for (const anchor of [today, selected]) {
        for (let offset = -6; offset <= 7; offset++) {
          const date = new Date(`${anchor}T12:00:00`); date.setDate(date.getDate() + offset);
          dates.add(localDateKey(date));
        }
      }
      const rows = await fetchVisitSessions([...dates]);
      if (request !== generation.current) return;
      setSessions(previous => {
        const next = Object.fromEntries(Object.entries(previous).filter(([, value]) => !dates.has(value.visit_date)));
        for (const row of rows) next[sessionKey(row.recipient_id, row.visit_date)] = row;
        return next;
      });
      setError('');
    } catch { if (request === generation.current) setError('방문 기록을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [today, selected]);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', onVisible);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, 60_000);
    return () => { ++generation.current; clearInterval(timer); window.removeEventListener('online', onVisible); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  const apply = (row: VisitSession) => {
    ++generation.current;
    setLoading(false);
    setSessions(previous => ({ ...previous, [sessionKey(row.recipient_id, row.visit_date)]: row }));
  };
  return { sessions, error, loading, refresh, apply };
}
