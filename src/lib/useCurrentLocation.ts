'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type CurrentPosition = {
  lat: number;
  lng: number;
  heading?: number | null;
  accuracy: number;
  source: 'quick' | 'watch' | 'fallback';
};

const QUICK_TIMEOUT = 5_000;
const WARMUP_TIMEOUT = 15_000;
const MAX_AGE = 60_000;

const locationError = (code?: number): string => {
  if (code === 1) return '위치 권한이 차단되어 있습니다. 기기 또는 브라우저 설정에서 위치 권한을 허용한 뒤 다시 시도해주세요.';
  if (code === 3) return '위치를 확인하는 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  return '현재 위치를 확인할 수 없습니다. 기기의 위치 서비스(GPS)를 켜고 다시 시도해주세요.';
};

/** Mount in the authenticated app; no map or onboarding lifecycle is required. */
export function useCurrentLocation(): {
  position: CurrentPosition | null;
  locating: boolean;
  error: string;
  refresh: () => void;
} {
  const [position, setPosition] = useState<CurrentPosition | null>(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const acquiring = useRef(false);
  const active = useRef<(() => void) | null>(null);
  const best = useRef<{
    position: CurrentPosition;
    timestamp: number;
  } | null>(null);

  const refresh = useCallback(() => {
    if (!mounted.current || acquiring.current) return;
    active.current?.();
    setError('');
    setLocating(true);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('이 기기 또는 브라우저에서는 현재 위치를 지원하지 않습니다.');
      setLocating(false);
      return;
    }

    const gps = navigator.geolocation;
    acquiring.current = true;
    let live = true;
    let watchId: number | null = null;
    let receivedFix = false;
    let quickFailed = false;
    let warming = true;
    let fallbackStarted = false;
    let lastError = locationError(3);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const current = () => live && mounted.current;
    const stopWatch = () => {
      if (watchId !== null) {
        gps.clearWatch(watchId);
        watchId = null;
      }
    };
    const cancel = () => {
      live = false;
      stopWatch();
      timers.forEach(clearTimeout);
      timers.clear();
      if (active.current === cancel) {
        active.current = null;
        acquiring.current = false;
      }
    };
    active.current = cancel;
    const finish = () => {
      if (!current()) return;
      acquiring.current = false;
      setLocating(false);
      timers.forEach(clearTimeout);
      timers.clear();
      if (!receivedFix) {
        setError(lastError);
        cancel();
      }
    };
    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (current()) callback();
      }, delay);
      timers.add(timer);
    };
    const accept = (fix: GeolocationPosition, source: 'quick' | 'watch' | 'fallback'): boolean => {
      if (!current()) return false;
      const coords = fix?.coords;
      const timestamp = fix?.timestamp;
      if (!coords || !Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90
        || !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180
        || !Number.isFinite(coords.accuracy) || coords.accuracy < 0
        || !Number.isFinite(timestamp) || timestamp <= 0
        || timestamp > Date.now() + QUICK_TIMEOUT || Date.now() - timestamp > MAX_AGE) {
        lastError = locationError();
        return false;
      }
      receivedFix = true;
      const previous = best.current;
      // Live fixes must follow movement even when accuracy worsens. Only single
      // requests are accuracy-gated to avoid a late coarse result undoing GPS.
      const replace = !previous || (timestamp >= previous.timestamp
        && ((source === 'watch' && timestamp > previous.timestamp)
          || coords.accuracy <= previous.position.accuracy
          || timestamp - previous.timestamp > MAX_AGE));
      if (replace) {
        const next: CurrentPosition = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          source,
          heading: typeof coords.heading === 'number' && Number.isFinite(coords.heading)
            && coords.heading >= 0 && coords.heading < 360 ? coords.heading : null,
        };
        best.current = { position: next, timestamp };
        setPosition(next);
      }
      setError('');
      finish();
      return true;
    };
    const failed = (failure?: GeolocationPositionError) => {
      if (!current()) return;
      lastError = locationError(failure?.code);
      if (!receivedFix) setError(lastError);
      if (failure?.code === 1) {
        // Never automatically retry a permission denial. A later refresh may retry.
        setError(lastError);
        setLocating(false);
        cancel();
      }
    };
    const maybeFallback = () => {
      if (!current() || !acquiring.current || warming) return;
      if (receivedFix) {
        finish();
        return;
      }
      if (!quickFailed || fallbackStarted) return;
      fallbackStarted = true;
      schedule(finish, WARMUP_TIMEOUT);
      try {
        gps.getCurrentPosition(
          fix => { if (current()) { accept(fix, 'fallback'); finish(); } },
          failure => { failed(failure); finish(); },
          { enableHighAccuracy: true, maximumAge: 0, timeout: WARMUP_TIMEOUT },
        );
      } catch {
        lastError = locationError();
        finish();
      }
    };

    // Own deadlines also cover browsers that never invoke an error callback.
    schedule(() => { quickFailed = true; maybeFallback(); }, QUICK_TIMEOUT);
    schedule(() => {
      warming = false;
      maybeFallback();
    }, WARMUP_TIMEOUT);
    try {
      gps.getCurrentPosition(
        fix => {
          if (!current()) return;
          if (!accept(fix, 'quick')) quickFailed = true;
          maybeFallback();
        },
        failure => { failed(failure); quickFailed = true; maybeFallback(); },
        { enableHighAccuracy: false, maximumAge: MAX_AGE, timeout: QUICK_TIMEOUT },
      );
    } catch {
      quickFailed = true;
      lastError = locationError();
    }
    if (!current()) return;
    try {
      const id = gps.watchPosition(
        fix => { accept(fix, 'watch'); },
        failure => { failed(failure); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: WARMUP_TIMEOUT },
      );
      // Also handle synchronous callbacks from embedded implementations/mocks.
      if (current()) watchId = id;
      else gps.clearWatch(id);
    } catch {
      lastError = locationError();
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Synchronize with the external GPS subscription immediately on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return () => {
      mounted.current = false;
      active.current?.();
    };
  }, [refresh]);

  return { position, locating, error, refresh };
}
