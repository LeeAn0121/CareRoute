'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { abortSensitiveRequests, supabase } from '@/lib/supabase';
import { CareRouteDevice, clearCareRouteNotifications } from '@/lib/native';
import { getCurrentAccountId, setCurrentAccount } from '@/lib/accountStorage';

type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: { theme: string; size: string; text: string }): void;
  disableAutoSelect(): void;
};
const googleIdentity = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
let googleScript: Promise<void> | undefined;
function loadGoogleIdentity() {
  if (googleIdentity()) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); googleScript = undefined; reject(new Error('Google 로그인 화면을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.')); };
    document.head.appendChild(script);
  });
  return googleScript;
}
async function createNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}

async function clearAccountNotifications() {
  await clearCareRouteNotifications();
  if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active || registration.waiting || registration.installing;
    if (!worker || new URL(worker.scriptURL).pathname !== '/CareRoute/sw.js') continue;
    const subscription = await registration.pushManager?.getSubscription();
    if (subscription && !await subscription.unsubscribe()) throw new Error('이전 계정의 알림 구독을 해제하지 못했습니다.');
    const visible = await registration.getNotifications();
    visible.forEach(notification => notification.close());
  }
}

export default function AuthGate({ children }: { children: (user: User, signOut: () => Promise<void>) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const signingOut = useRef(false);
  const scopeCleanup = useRef<Promise<void>>(Promise.resolve());
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const clearScope = useCallback(() => {
    abortSensitiveRequests();
    setCurrentAccount(null);
    setUser(null);
    // Serialize cleanup so a late cancellation cannot erase the next account's alerts.
    const cleanup = scopeCleanup.current.catch(() => {}).then(clearAccountNotifications);
    scopeCleanup.current = cleanup;
    return cleanup;
  }, []);

  const validate = useCallback(async () => {
    const current = ++generation.current;
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        if (current === generation.current) { await clearScope(); setChecking(false); }
        return;
      }
      const { data, error: validationError } = await supabase.auth.getUser();
      if (validationError || !data.user) throw validationError || new Error('사용자를 확인하지 못했습니다.');
      // Match public.is_verified_google_user(): confirmed email and Google identity.
      if (!data.user.email_confirmed_at || !data.user.identities?.some(identity => identity.provider === 'google')) {
        throw new Error('이메일이 확인된 Google 계정으로 로그인해주세요.');
      }
      if (current !== generation.current || signingOut.current) return;
      if (getCurrentAccountId() !== data.user.id) await clearScope();
      else await scopeCleanup.current;
      if (current === generation.current && !signingOut.current) {
        setCurrentAccount(data.user.id);
        setUser(data.user);
        setError('');
      }
    } catch (cause) {
      if (current === generation.current) {
        await clearScope().catch(() => {});
        if (current === generation.current) setError(cause instanceof Error && cause.message === '이메일이 확인된 Google 계정으로 로그인해주세요.' ? cause.message : '로그인 상태 또는 이전 알림 정리를 확인하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
      }
    } finally {
      if (current === generation.current) setChecking(false);
    }
  }, [clearScope]);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) { ++generation.current; void clearScope().catch(() => setError('이전 계정의 알림 정리에 실패했습니다. 다시 시도해주세요.')); setChecking(false); return; }
      if (getCurrentAccountId() !== session.user.id) {
        ++generation.current;
        void clearScope().catch(() => setError('이전 계정의 알림 정리에 실패했습니다. 다시 시도해주세요.'));
      }
      setUser(previous => previous?.id === session.user.id ? previous : null);
      // Auth API calls must run after the auth event releases its session lock.
      window.setTimeout(() => { if (active && !signingOut.current) void validate(); }, 0);
    });
    void validate();
    return () => { active = false; ++generation.current; subscription.unsubscribe(); void clearScope().catch(() => {}); };
  }, [validate, clearScope]);

  const exchange = useCallback(async (token: string, nonce: string) => {
    setBusy(true); setError('');
    signingOut.current = false;
    try {
      const { error: signInError } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce });
      if (signInError) throw signInError;
      await validate();
    } catch (cause) {
      setError(`Google 로그인에 실패했습니다. ${cause instanceof Error ? cause.message : '다시 시도해주세요.'}`);
    } finally { setBusy(false); }
  }, [validate]);

  useEffect(() => {
    if (checking || user || Capacitor.isNativePlatform()) return;
    let active = true;
    if (!clientId) { setError('Google 로그인 설정이 필요합니다. 관리자에게 문의해주세요.'); return; }
    void (async () => {
      try {
        const [, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()]);
        if (!active || !buttonRef.current) return;
        const identity = googleIdentity();
        if (!identity) throw new Error('Google 로그인 서비스를 사용할 수 없습니다.');
        identity.initialize({ client_id: clientId, nonce: nonce.hashed, auto_select: false, callback: (response: { credential: string }) => { if (active) void exchange(response.credential, nonce.raw); } });
        buttonRef.current.replaceChildren();
        identity.renderButton(buttonRef.current, { theme: 'outline', size: 'large', text: 'signin_with' });
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Google 로그인을 준비하지 못했습니다.'); }
    })();
    return () => { active = false; };
  }, [checking, user, clientId, exchange, attempt]);

  const nativeSignIn = async () => {
    setBusy(true); setError('');
    try {
      if (!clientId) throw new Error('Google 로그인 설정이 필요합니다. 관리자에게 문의해주세요.');
      const nonce = await createNonce();
      const { idToken } = await CareRouteDevice.signInGoogle({ clientId, nonce: nonce.hashed });
      await exchange(idToken, nonce.raw);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Google 로그인에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    signingOut.current = true; ++generation.current;
    const cleanup = clearScope();
    void cleanup.catch(() => {});
    setUser(null); setChecking(true); setError('');
    googleIdentity()?.disableAutoSelect();
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      await cleanup;
      await scopeCleanup.current;
    } catch { setError('로그아웃을 완료하지 못했습니다. 다시 시도해주세요.'); }
    finally { setChecking(false); }
  };

  if (user && !checking) return children(user, signOut);
  return <main className="auth-shell min-h-dvh flex items-center justify-center bg-background text-foreground px-5 py-12">
    <section className="w-full max-w-sm rounded-3xl border border-surface-border bg-surface p-6 space-y-4" aria-labelledby="auth-title">
      <h1 id="auth-title" className="text-2xl font-bold">케어루트 로그인</h1>
      <p className="text-sm leading-relaxed text-foreground/80">Google 계정으로 로그인해 내 계정에 허용된 수급자와 방문 기록을 확인하세요.</p>
      {checking ? <p role="status">로그인 상태 확인 중…</p> : <>
        {Capacitor.isNativePlatform()
          ? <button type="button" disabled={busy} onClick={() => void nativeSignIn()} className="w-full min-h-11 rounded-xl bg-primary text-primary-foreground px-4 py-3 font-bold disabled:opacity-50">Google 계정으로 로그인</button>
          : <div ref={buttonRef} aria-label="Google 계정 로그인" className={busy ? 'pointer-events-none opacity-50' : ''} />}
        {busy && <p role="status" className="text-sm">로그인 확인 중…</p>}
      </>}
      {error && <div className="space-y-2"><p role="alert" className="text-sm leading-relaxed">{error}</p><button type="button" disabled={busy || checking} className="min-h-11 rounded-xl border border-surface-border px-3 text-sm font-bold" onClick={() => { if (signingOut.current) { void signOut(); return; } setError(''); setAttempt(value => value + 1); setChecking(true); void validate(); }}>다시 시도</button></div>}
    </section>
  </main>;
}
