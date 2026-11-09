import { supabase } from './supabase';
import { captureAccountStorage, subscribeAccountStorage } from './accountStorage';

export const PRIVATE_STORAGE_TTL_SECONDS = 300;
type PrivateBucket = 'recipient-photos' | 'print-pdfs';
const cache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string>>();
let cacheRevision: number | undefined;
subscribeAccountStorage(() => {
  const current = captureAccountStorage().revision;
  if (current !== cacheRevision) {
    cache.clear();
    pending.clear();
    cacheRevision = current;
  }
});

/** Accept canonical paths and this project's legacy public/signed URLs only.
 * Never persist the resolved signed URL back into the recipient/cache record.
 */
export function getStorageObjectPath(bucket: PrivateBucket, value: string): string {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    if (url.origin !== project.origin) throw new Error('Unexpected storage origin');
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match || match[1] !== bucket) throw new Error('Unexpected storage bucket');
    path = match[2].split('/').map(segment => decodeURIComponent(segment)).join('/');
  }
  if (!path || path.startsWith('/') || /[\\?#\u0000-\u001f]/.test(path) || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid storage path');
  }
  return path;
}

/** Stable DB reference, compatible with the server's legacy photo-reference
 * guard. getPublicUrl only formats a URL; the private bucket still denies reads.
 */
export function getRecipientPhotoCanonicalUrl(value: string): string {
  const path = getStorageObjectPath('recipient-photos', value);
  return supabase.storage.from('recipient-photos').getPublicUrl(path).data.publicUrl;
}

export async function requireVerifiedStorageAccount() {
  const scope = captureAccountStorage();
  if (!scope.isCurrent()) throw new Error('로그인이 필요합니다.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== scope.accountId || !scope.isCurrent()) {
    throw new Error('로그인 계정을 다시 확인해주세요.');
  }
  return scope;
}

/** Invalidate only the active account's cached URL (e.g. after image failure). */
export function invalidatePrivateStorageUrl(bucket: PrivateBucket, value: string): void {
  const scope = captureAccountStorage();
  if (!scope.isCurrent()) return;
  const path = getStorageObjectPath(bucket, value);
  cache.delete(`${scope.revision}:${scope.accountId}:${bucket}:${path}`);
}

export async function getPrivateStorageSignedUrl(bucket: PrivateBucket, value: string): Promise<string> {
  const scope = captureAccountStorage();
  if (!scope.isCurrent()) throw new Error('로그인이 필요합니다.');
  const path = getStorageObjectPath(bucket, value);
  const key = `${scope.revision}:${scope.accountId}:${bucket}:${path}`;
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now() + 30_000) return existing.url;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = (async () => {
    await requireVerifiedStorageAccount();
    if (!scope.isCurrent()) throw new Error('계정이 변경되었습니다.');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, PRIVATE_STORAGE_TTL_SECONDS);
    if (error || !data?.signedUrl) throw error || new Error('파일을 열 수 없습니다.');
    if (!scope.isCurrent()) throw new Error('계정이 변경되었습니다.');
    cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + PRIVATE_STORAGE_TTL_SECONDS * 1000 });
    return data.signedUrl;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

/** Call again before TTL expiry (or on image error) to refresh. Failures are
 * intentionally surfaced so callers can show a placeholder, never a public URL.
 */
export async function resolveRecipientPhotoUrl(value?: string | null): Promise<string | null> {
  return value ? getPrivateStorageSignedUrl('recipient-photos', value) : null;
}

/** New upload/delete targets must always be inside the current user's prefix.
 * Reads of historical paths are decided by the server's legacy ACL policies.
 */
export async function removeOwnedStorageObject(bucket: PrivateBucket, value: string): Promise<void> {
  const scope = await requireVerifiedStorageAccount();
  const path = getStorageObjectPath(bucket, value);
  if (!path.startsWith(`${scope.accountId}/`)) throw new Error('다른 계정의 파일은 삭제할 수 없습니다.');
  if (!scope.isCurrent()) throw new Error('계정이 변경되었습니다.');
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
