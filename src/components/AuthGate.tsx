'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { abortSensitiveRequests, supabase } from '@/lib/supabase';
import { CareRouteDevice, clearCareRouteNotifications } from '@/lib/native';
import { getCurrentAccountId, setCurrentAccount } from '@/lib/accountStorage';
import { Spinner } from '@/components/ui';
import { IconShieldCheck } from '@tabler/icons-react';

type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: { theme: string; size: string; text: string }): void;
  disableAutoSelect(): void;
};
const googleIdentity = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
let googleScript: Promise<void> | undefined;
const GOOGLE_LOAD_TIMEOUT_MS = 15000;
function loadGoogleIdentity() {
  if (googleIdentity()) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      script.remove();
      googleScript = undefined;
      reject(new Error('Google 로그인 준비가 지연되고 있습니다. 연결을 확인하고 다시 시도해주세요.'));
    };
    const timeout = window.setTimeout(fail, GOOGLE_LOAD_TIMEOUT_MS);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = fail;
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
  const [googleReady, setGoogleReady] = useState(false);
  const [loginPhase, setLoginPhase] = useState<'selecting' | 'exchanging'>('exchanging');
  const [notice, setNotice] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
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
    setBusy(true); setLoginPhase('exchanging'); setError(''); setNotice('');
    signingOut.current = false;
    setIsSigningOut(false);
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
    let observer: MutationObserver | undefined;
    let buttonTimeout: number | undefined;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setGoogleReady(false);
      if (!clientId) { setError('Google 로그인 설정이 필요합니다. 관리자에게 문의해주세요.'); return; }
      try {
        const [, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()]);
        if (!active || !buttonRef.current) return;
        const identity = googleIdentity();
        if (!identity) throw new Error('Google 로그인 서비스를 사용할 수 없습니다.');
        identity.initialize({ client_id: clientId, nonce: nonce.hashed, auto_select: false, callback: (response: { credential: string }) => { if (active) void exchange(response.credential, nonce.raw); } });
        buttonRef.current.replaceChildren();
        const button = buttonRef.current;
        const markReady = () => {
          if (!active || !button.hasChildNodes()) return;
          setGoogleReady(true);
          observer?.disconnect();
          window.clearTimeout(buttonTimeout);
        };
        observer = new MutationObserver(markReady);
        observer.observe(button, { childList: true, subtree: true });
        buttonTimeout = window.setTimeout(() => {
          if (active) {
            observer?.disconnect();
            setError('Google 로그인 버튼을 표시하지 못했습니다. 연결 또는 브라우저 설정을 확인하고 다시 시도해주세요.');
          }
        }, GOOGLE_LOAD_TIMEOUT_MS);
        identity.renderButton(buttonRef.current, { theme: 'outline', size: 'large', text: 'signin_with' });
        markReady();
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Google 로그인을 준비하지 못했습니다.'); }
    })();
    return () => { active = false; observer?.disconnect(); window.clearTimeout(buttonTimeout); };
  }, [checking, user, clientId, exchange, attempt]);

  const nativeSignIn = async () => {
    setBusy(true); setLoginPhase('selecting'); setError(''); setNotice('');
    try {
      if (!clientId) throw new Error('Google 로그인 설정이 필요합니다. 관리자에게 문의해주세요.');
      const nonce = await createNonce();
      const { idToken } = await CareRouteDevice.signInGoogle({ clientId, nonce: nonce.hashed });
      await exchange(idToken, nonce.raw);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Google 로그인에 실패했습니다.';
      if (message.includes('취소')) setNotice('로그인을 취소했습니다. 준비되면 다시 계정을 선택해주세요.');
      else setError(message);
    }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    signingOut.current = true; ++generation.current;
    setIsSigningOut(true);
    const cleanup = clearScope();
    void cleanup.catch(() => {});
    setUser(null); setChecking(true); setError(''); setNotice('');
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
  const native = Capacitor.isNativePlatform();
  const statusLabel = checking
    ? isSigningOut ? '로그아웃하고 이전 계정의 알림을 정리하고 있어요.' : '저장된 로그인 상태를 확인하고 있어요.'
    : busy
      ? loginPhase === 'selecting' ? 'Google 화면에서 계정을 선택해주세요.' : '계정을 확인하고 내 기록을 준비하고 있어요.'
      : !native && !googleReady && !error ? 'Google 로그인 버튼을 준비하고 있어요.' : '';

  return <main className="auth-shell min-h-dvh flex items-center justify-center bg-background text-foreground px-4 py-8 sm:px-6 sm:py-12">
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-center justify-center gap-3">
        <img src="/CareRoute/logo.svg" width={48} height={48} alt="" className="h-12 w-12 rounded-2xl" />
        <div><p className="text-lg font-black tracking-tight">CareRoute</p><p className="text-sm text-foreground/70">어르신 방문 케어를 한곳에서</p></div>
      </div>

      <section className="rounded-3xl border border-surface-border bg-surface p-5 shadow-sm sm:p-8" aria-labelledby="auth-title" aria-describedby="auth-description">
        <header className="mb-6 space-y-2">
          <h1 id="auth-title" className="text-2xl font-black tracking-tight">케어루트 로그인</h1>
          <p id="auth-description" className="text-sm leading-relaxed text-foreground/75">Google 계정으로 방문 일정과 케어 기록을 이어가세요.</p>
        </header>

        <div className="rounded-2xl border border-surface-border bg-surface-muted p-4 mb-6 flex items-start gap-3">
          <IconShieldCheck size={22} className="shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold">내 계정에 허용된 기록만</h2>
            <p className="text-sm leading-relaxed text-foreground/75">다른 계정의 비공개 기록은 표시되지 않아요. 함께 관리하는 기록은 접근 권한이 있는 계정에서만 확인할 수 있어요.</p>
          </div>
        </div>

        <div className="space-y-3" aria-busy={checking || busy || (!native && !googleReady && !error)}>
          {!checking && (native
            ? <button type="button" disabled={busy} onClick={() => void nativeSignIn()} className="w-full min-h-11 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{busy ? 'Google 로그인 진행 중…' : 'Google 계정으로 로그인'}</button>
            : <div ref={buttonRef} aria-label="Google 계정 로그인" inert={busy || !googleReady} className={`min-h-11 flex justify-center overflow-x-auto ${busy ? 'pointer-events-none opacity-50' : ''}`} />)}
          {statusLabel && <div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-xl bg-surface-muted p-3 text-sm leading-relaxed text-foreground/80"><Spinner size={18} className="shrink-0 mt-0.5 text-primary motion-reduce:animate-none" /><span>{statusLabel}</span></div>}
          {!checking && !busy && !error && (native || googleReady) && <p className="text-center text-sm leading-relaxed text-foreground/70">Google 화면에서 사용할 계정을 선택하세요.</p>}
          {busy && loginPhase === 'selecting' && <p className="text-sm leading-relaxed text-foreground/70">취소하려면 Google 화면을 닫거나 기기의 뒤로 가기를 사용하세요.</p>}
        </div>

        {notice && <p role="status" className="mt-4 rounded-xl bg-surface-muted p-3 text-sm leading-relaxed text-foreground/80">{notice}</p>}
        {error && <div className="mt-4 space-y-3 rounded-2xl border border-surface-border bg-surface-muted p-4">
          <div role="alert" className="space-y-1"><p className="text-sm font-bold">{isSigningOut ? '로그아웃을 완료하지 못했어요' : '로그인을 완료하지 못했어요'}</p><p className="text-sm leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">{error}</p></div>
          <button type="button" disabled={busy || checking} className="min-h-11 w-full rounded-xl border border-surface-border bg-surface px-4 py-2 text-sm font-bold hover:bg-surface-border disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { if (signingOut.current) { void signOut(); return; } setError(''); setNotice(''); setAttempt(value => value + 1); setChecking(true); void validate(); }}>다시 시도</button>
        </div>}

        <p className="mt-6 border-t border-surface-border pt-4 text-sm leading-relaxed text-foreground/70">로그인 상태는 유지됩니다. 공용 기기에서는 사용 후 설정에서 로그아웃해주세요.</p>
      </section>

      <p className="px-2 text-center text-sm leading-relaxed text-foreground/70">다른 계정으로 이용하려면 설정에서 로그아웃한 뒤<br className="hidden sm:block" /> Google 로그인 화면에서 계정을 다시 선택하세요.</p>
    </div>
  </main>;
}
