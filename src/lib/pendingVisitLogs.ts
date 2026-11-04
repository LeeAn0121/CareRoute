import { supabase } from './supabase';

const STORAGE_KEY = 'careroute_pending_visit_logs_v1';
type PendingLog = { id: string; table: 'visit_logs' | 'vitals_logs'; payload: Record<string, unknown> };
let retrying: Promise<void> | null = null;
function readPending(): PendingLog[] {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return Array.isArray(value) ? value.filter(item => item?.id && ['visit_logs', 'vitals_logs'].includes(item.table)) : [];
}

async function send(entry: PendingLog): Promise<boolean> {
  let { error } = await supabase.from(entry.table).insert({ ...entry.payload, id: entry.id });
  if (error?.code === '23503' && entry.payload.recipient_id) {
    // History tables keep the name and allow NULL links when a recipient was deleted.
    const orphan = { ...entry.payload, recipient_id: null, id: entry.id };
    const retried = await supabase.from(entry.table).insert(orphan);
    error = retried.error;
  }
  if (error && error.code !== '23505') return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readPending().filter(item => item.id !== entry.id)));
  return true;
}

export async function saveVisitLog(table: PendingLog['table'], payload: Record<string, unknown>): Promise<boolean> {
  const entry = { id: crypto.randomUUID(), table, payload };
  // Persist before sending; a retry uses the same UUID and cannot duplicate a saved record.
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...readPending(), entry])); }
  catch { console.warn('방문 이력의 기기 임시 보관 공간을 사용할 수 없습니다.'); }
  try { return await send(entry); } catch { return false; }
}

export function retryPendingVisitLogs(): Promise<void> {
  if (retrying) return retrying;
  retrying = (async () => {
    let entries: PendingLog[];
    try { entries = readPending(); } catch { return; }
    for (const entry of entries) {
      // Keep failed entries for inspection/retry, but never block unrelated records.
      try { await send(entry); } catch { /* Retain this entry and continue. */ }
    }
  })().finally(() => { retrying = null; });
  return retrying;
}
