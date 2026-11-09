/** AuthGate must set this only after Supabase has verified the user (getUser).
 * No legacy patient key is read or migrated automatically. This is isolation,
 * not encryption; server authorization remains enforced by Supabase RLS.
 */
let accountId: string | null = null;
let revision = 0;
const listeners = new Set<() => void>();
const TOKEN_KEYS = ['google_access_token', 'google_access_token_expires'];
const prefix = (id: string) => `careroute_account_v1:${encodeURIComponent(id)}:`;

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}
function notify() { listeners.forEach(listener => listener()); }

export function getCurrentAccountId(): string | null { return accountId; }
export function getAccountStorageRevision(): number { return revision; }

/** Pass null on logout/auth failure BEFORE rendering any account's data. */
export function setCurrentAccount(userId: string | null): void {
  const next = userId?.trim() || null;
  if (next === accountId && next !== null) return;
  const previous = accountId;
  accountId = next;
  revision += 1;
  // Tokens must not survive logout/account changes. Old patient data is retained.
  try {
    const local = storage();
    for (const key of TOKEN_KEYS) {
      local?.removeItem(key);
      if (previous) local?.removeItem(prefix(previous) + key);
      if (next) local?.removeItem(prefix(next) + key);
    }
  } catch { /* Unavailable browser storage must not prevent account reset. */ }
  finally { notify(); }
}

export function subscribeAccountStorage(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

/** Capture before async work. A stale handle cannot access the next account,
 * even after switching away and back to the same user ID.
 */
export function captureAccountStorage() {
  const id = accountId;
  const version = revision;
  const isCurrent = () => !!id && id === accountId && version === revision;
  return {
    accountId: id,
    revision: version,
    isCurrent,
    getItem(key: string): string | null {
      return isCurrent() ? storage()?.getItem(prefix(id!) + key) ?? null : null;
    },
    setItem(key: string, value: string): void {
      if (!isCurrent()) return;
      storage()?.setItem(prefix(id!) + key, value);
      notify();
    },
    removeItem(key: string): void {
      if (!isCurrent()) return;
      storage()?.removeItem(prefix(id!) + key);
      notify();
    },
  };
}

export const accountStorage = {
  getItem: (key: string) => captureAccountStorage().getItem(key),
  setItem: (key: string, value: string) => captureAccountStorage().setItem(key, value),
  removeItem: (key: string) => captureAccountStorage().removeItem(key),
};
