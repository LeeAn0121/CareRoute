import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { version as currentVersion } from '../../package.json';

export type PlayUpdateInfo = {
  available: boolean;
  flexibleAllowed: boolean;
  versionCode: number;
  installStatus: 'idle' | 'pending' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'canceled' | 'failed';
};
export interface CareRouteUpdatesPlugin {
  getUpdateInfo(): Promise<PlayUpdateInfo>;
  startUpdate(): Promise<{ status: 'accepted' | 'canceled' | 'unavailable' }>;
  completeUpdate(): Promise<void>;
  openStore(): Promise<void>;
  addListener(event: 'updateState', listener: (info: PlayUpdateInfo) => void): Promise<PluginListenerHandle>;
  addListener(event: 'resume', listener: () => void): Promise<PluginListenerHandle>;
}
export const CareRouteUpdates = registerPlugin<CareRouteUpdatesPlugin>('CareRouteUpdates');
export type AppUpdate = {
  platform: 'android' | 'web';
  version: string;
  phase: 'available' | 'downloading' | 'downloaded' | 'store';
};
export type AppUpdateState = {
  update: AppUpdate | null;
  message: string;
  checking: boolean;
  busy: boolean;
};
const CHECK_INTERVAL = 5 * 60_000;
const CHECK_TIMEOUT = 12_000;
const DISMISS_KEY = 'careroute_update_dismissed';

/** Stable release versions only; never equate a GitHub/web release with Play availability. */
export function isNewerVersion(candidate: string, installed: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/;
  if (!pattern.test(candidate) || !pattern.test(installed)) return false;
  const next = candidate.split('.').map(Number);
  const old = installed.split('.').map(Number);
  if (![...next, ...old].every(Number.isSafeInteger)) return false;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== old[i]) return next[i] > old[i];
  }
  return false;
}

/** One provider-owned monitor. All asynchronous work is bounded and invalidated on dispose. */
export function createAppUpdateMonitor(onChange: (state: AppUpdateState) => void) {
  let state: AppUpdateState = { update: null, message: '', checking: false, busy: false };
  let disposed = false;
  let checking = false;
  let manualRequested = false;
  let candidate: AppUpdate | null = null;
  let abort: AbortController | null = null;
  let actionEpoch = 0;
  let playRevision = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const listeners: Promise<PluginListenerHandle>[] = [];
  let removeControllerListener: (() => void) | null = null;
  const dismissed = new Set<string>();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
    if (Array.isArray(stored)) stored.filter((key): key is string => typeof key === 'string').slice(-20).forEach(key => dismissed.add(key));
  } catch { /* Storage is optional (private browsing / disabled storage). */ }
  const native = Capacitor.isNativePlatform();
  const android = native && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('CareRouteUpdates');
  const key = (update: AppUpdate) => `${update.platform}:${update.version}`;
  const emit = (patch: Partial<AppUpdateState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const bounded = <T>(work: Promise<T>, ms = CHECK_TIMEOUT): Promise<T> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      reject(new Error('timeout'));
    }, ms);
    timers.add(timer);
    work.then(resolve, reject).finally(() => { clearTimeout(timer); timers.delete(timer); });
  });
  const show = (update: AppUpdate | null, manual = false) => {
    candidate = update;
    if (update && manual) dismissed.delete(key(update));
    emit({ update: update && !dismissed.has(key(update)) ? update : null });
  };
  const fromPlay = (info: PlayUpdateInfo, manual = false) => {
    if (!Number.isSafeInteger(info.versionCode) || info.versionCode <= 0) {
      show(null);
      return;
    }
    const phase = info.installStatus === 'installed' ? null : info.installStatus === 'downloaded' ? 'downloaded'
      : ['pending', 'downloading', 'installing'].includes(info.installStatus) ? 'downloading'
        : info.available ? (info.flexibleAllowed ? 'available' : 'store') : null;
    show(phase ? { platform: 'android', version: String(info.versionCode), phase } : null, manual);
    if (info.installStatus === 'failed') emit({ message: '업데이트 다운로드에 실패했습니다. 다시 시도해주세요.' });
    if (info.installStatus === 'canceled') emit({ message: '업데이트 다운로드가 취소되었습니다. 다시 시도할 수 있습니다.' });
  };
  const check = async (manual = false) => {
    if (disposed) return;
    if (manual) {
      manualRequested = true;
      if (candidate) show(candidate, true);
    }
    if (checking || state.busy) return;
    if (!manual && document.visibilityState === 'hidden') return;
    checking = true;
    emit({ checking: true, message: manual ? '업데이트를 확인하고 있습니다.' : state.message });
    try {
      if (navigator.onLine === false) throw new Error('offline');
      if (native) {
        if (!android) {
          if (manualRequested) emit({ message: '이 환경에서는 Google Play 업데이트를 확인할 수 없습니다.' });
          return;
        }
        const revision = playRevision;
        const info = await bounded(CareRouteUpdates.getUpdateInfo());
        if (disposed) return;
        emit({ message: '' });
        if (revision === playRevision) fromPlay(info, manualRequested);
        else if (candidate && manualRequested) show(candidate, true);
      } else {
        abort = new AbortController();
        const response = await bounded(fetch(`/CareRoute/version.json?check=${Date.now()}`, {
          cache: 'no-store', credentials: 'omit', signal: abort.signal,
        }).then(async response => {
          if (!response.ok) throw new Error('manifest');
          return response.json() as Promise<{ version?: unknown }>;
        }));
        if (disposed) return;
        if (typeof response.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(response.version)) throw new Error('manifest');
        emit({ message: '' });
        show(isNewerVersion(response.version, currentVersion)
          ? { platform: 'web', version: response.version, phase: 'available' } : null, manualRequested);
      }
      if (manualRequested && !candidate && !state.message) emit({ message: '현재 이용 가능한 새 업데이트가 없습니다.' });
    } catch {
      if (!disposed && manualRequested) emit({ message: navigator.onLine === false
        ? '인터넷 연결 후 업데이트를 다시 확인해주세요.'
        : native ? 'Google Play 업데이트를 확인하지 못했습니다. Play 설치 여부와 연결을 확인한 뒤 다시 시도해주세요.'
          : '새 버전을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      abort?.abort();
      abort = null;
      checking = false;
      manualRequested = false;
      emit({ checking: false });
    }
  };
  const dismiss = () => {
    if (candidate) {
      dismissed.add(key(candidate));
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed].slice(-20))); } catch { /* optional */ }
    }
    emit({ update: null, message: '' });
  };
  const apply = async () => {
    if (disposed || state.busy || checking || !state.update) return;
    if (navigator.onLine === false) {
      emit({ message: '인터넷 연결 후 업데이트를 다시 시도해주세요.' });
      return;
    }
    const update = state.update;
    const epoch = ++actionEpoch;
    let awaitingReload = false;
    emit({ busy: true, message: '' });
    try {
      if (update.platform === 'web') {
        // Main acknowledges synchronously with preventDefault(). Logged-out
        // Providers have no Main listener, so apply the same scoped fallback.
        const unhandled = window.dispatchEvent(new Event('careroute:apply-web-update', { cancelable: true }));
        if (unhandled) {
          if ('caches' in window) {
            await bounded(caches.keys().then(keys => Promise.all(keys.filter(name => name.startsWith('careroute-')).map(name => caches.delete(name)))));
          }
          const registration = 'serviceWorker' in navigator
            ? await bounded(navigator.serviceWorker.getRegistration('/CareRoute/')) : undefined;
          if (disposed) return;
          const waiting = registration?.waiting;
          if (waiting && new URL(waiting.scriptURL).pathname === '/CareRoute/sw.js') {
            await bounded(new Promise<void>(resolve => {
              const changed = () => resolve();
              navigator.serviceWorker.addEventListener('controllerchange', changed);
              removeControllerListener = () => navigator.serviceWorker.removeEventListener('controllerchange', changed);
              waiting.postMessage('SKIP_WAITING');
            }));
            removeControllerListener?.();
            removeControllerListener = null;
          }
          if (!disposed) window.location.reload();
        }
        awaitingReload = true;
        // Main applies asynchronously. Keep repeated taps from dispatching twice;
        // allow a deliberate retry if navigation never happens.
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!disposed && epoch === actionEpoch) emit({ busy: false, message: '화면이 바뀌지 않았다면 업데이트를 다시 시도해주세요.' });
        }, CHECK_TIMEOUT);
        timers.add(timer);
      } else if (update.phase === 'downloaded') {
        await bounded(CareRouteUpdates.completeUpdate());
      } else if (update.phase === 'store') {
        await bounded(CareRouteUpdates.openStore());
      } else if (update.phase === 'available') {
        const result = await bounded(CareRouteUpdates.startUpdate(), 120_000);
        if (disposed || epoch !== actionEpoch) return;
        if (result.status === 'canceled') { dismiss(); return; }
        if (result.status === 'unavailable') {
          show(null);
          emit({ message: '현재 Google Play에서 제공하는 업데이트가 없습니다.' });
        } else {
          emit({ message: '' });
          const revision = playRevision;
          const info = await bounded(CareRouteUpdates.getUpdateInfo());
          if (!disposed && revision === playRevision) fromPlay(info);
        }
      }
    } catch {
      removeControllerListener?.();
      removeControllerListener = null;
      if (!disposed && epoch === actionEpoch) emit({ message: '업데이트를 진행하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      if (!disposed && epoch === actionEpoch && !awaitingReload) emit({ busy: false });
      if (!disposed && manualRequested) void check(true);
    }
  };
  const automatic = () => { void check(); };
  const manual = () => { void check(true); };
  const interval = setInterval(automatic, CHECK_INTERVAL);
  window.addEventListener('online', automatic);
  window.addEventListener('careroute:check-update', manual);
  window.addEventListener('careroute:web-update-ready', automatic);
  document.addEventListener('visibilitychange', automatic);
  if (android) {
    listeners.push(CareRouteUpdates.addListener('resume', automatic));
    listeners.push(CareRouteUpdates.addListener('updateState', info => {
      if (disposed) return;
      ++playRevision;
      emit({ message: '' });
      fromPlay(info);
    }));
    listeners.forEach(listener => { void listener.catch(() => {}); });
  }
  void check();
  return {
    check, dismiss, apply,
    dispose() {
      disposed = true;
      ++actionEpoch;
      abort?.abort();
      removeControllerListener?.();
      removeControllerListener = null;
      timers.forEach(clearTimeout);
      timers.clear();
      clearInterval(interval);
      window.removeEventListener('online', automatic);
      window.removeEventListener('careroute:check-update', manual);
      window.removeEventListener('careroute:web-update-ready', automatic);
      document.removeEventListener('visibilitychange', automatic);
      listeners.forEach(listener => { void listener.then(handle => handle.remove()).catch(() => {}); });
    },
  };
}
