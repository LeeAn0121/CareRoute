import { supabase } from './supabase';
import { captureAccountStorage } from './accountStorage';

const STORAGE_KEY = 'careroute_pending_visit_logs_v1';
type PendingLog = { id: string; table: 'visit_logs' | 'vitals_logs'; payload: Record<string, unknown> };
type Scope = ReturnType<typeof captureAccountStorage>;
const retries = new Map<number, Promise<void>>();

function readPending(scope: Scope): PendingLog[] {
  const value = JSON.parse(scope.getItem(STORAGE_KEY) || '[]');
  return Array.isArray(value) ? value.filter(item => item?.id && ['visit_logs', 'vitals_logs'].includes(item.table) && item.payload && typeof item.payload === 'object') : [];
}

async function verifyScope(scope: Scope): Promise<boolean> {
  if (!scope.isCurrent()) return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id === scope.accountId && scope.isCurrent();
}

async function send(entry: PendingLog, scope: Scope): Promise<boolean> {
  if (!await verifyScope(scope)) return false;
  const payload = { ...entry.payload };
  delete payload.owner_id; // Ownership is derived by the server, including shared legacy parents.
  let { error } = await supabase.from(entry.table).insert({ ...payload, id: entry.id });
  if (!scope.isCurrent()) return false;
  if (error?.code === '23503' && entry.payload.recipient_id) {
    // History tables keep the name and allow NULL links when a recipient was deleted.
    if (!await verifyScope(scope)) return false;
    const orphan = { ...payload, recipient_id: null, id: entry.id };
    const retried = await supabase.from(entry.table).insert(orphan);
    error = retried.error;
  }
  if (!scope.isCurrent() || (error && error.code !== '23505')) return false;
  scope.setItem(STORAGE_KEY, JSON.stringify(readPending(scope).filter(item => item.id !== entry.id)));
  return true;
}

export async function saveVisitLog(table: PendingLog['table'], payload: Record<string, unknown>): Promise<boolean> {
  const scope = captureAccountStorage();
  if (!scope.isCurrent()) return false;
  const storedPayload = { ...payload };
  delete storedPayload.owner_id;
  const entry = { id: crypto.randomUUID(), table, payload: storedPayload };
  // Queue only under the captured account, never the account active after an await.
  try { scope.setItem(STORAGE_KEY, JSON.stringify([...readPending(scope), entry])); }
  catch { console.warn('방문 이력의 기기 임시 보관 공간을 사용할 수 없습니다.'); }
  try { return await send(entry, scope); } catch { return false; }
}

export function retryPendingVisitLogs(): Promise<void> {
  const scope = captureAccountStorage();
  if (!scope.isCurrent()) return Promise.resolve();
  const existing = retries.get(scope.revision);
  if (existing) return existing;
  const retry = (async () => {
    let entries: PendingLog[];
    try { entries = readPending(scope); } catch { return; }
    for (const entry of entries) {
      if (!scope.isCurrent()) break;
      try { await send(entry, scope); } catch { /* Retain this account's entry. */ }
    }
  })().finally(() => { retries.delete(scope.revision); });
  retries.set(scope.revision, retry);
  return retry;
}
