'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { createAppUpdateMonitor, type AppUpdateState } from '@/lib/appUpdates';

const controlClass = 'min-h-11 whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function AppUpdateNotice() {
  const [state, setState] = useState<AppUpdateState>({ update: null, message: '', checking: false, busy: false });
  const [confirm, setConfirm] = useState(false);
  const confirmationActive = useRef(false);
  const monitor = useRef<ReturnType<typeof createAppUpdateMonitor> | null>(null);
  useEffect(() => {
    const instance = createAppUpdateMonitor(setState);
    monitor.current = instance;
    return () => {
      instance.dispose();
      if (monitor.current === instance) monitor.current = null;
    };
  }, []);

  const { update, message, checking, busy } = state;
  if (!update && !message) return null;
  const restarting = update?.platform === 'web' || update?.phase === 'downloaded';
  const downloading = update?.phase === 'downloading';
  const title = update?.phase === 'downloaded' ? '업데이트 설치 준비가 끝났습니다.'
    : downloading ? '업데이트를 다운로드하고 있습니다.'
      : update ? '새 버전을 사용할 수 있습니다.' : '업데이트 확인';
  const actionLabel = restarting ? (update?.platform === 'web' ? '새 버전 적용' : '설치하고 다시 시작')
    : update?.phase === 'store' ? 'Google Play 열기' : '업데이트 다운로드';
  const apply = () => {
    if (restarting) { confirmationActive.current = true; setConfirm(true); }
    else void monitor.current?.apply();
  };
  const closeConfirmation = () => {
    confirmationActive.current = false;
    setConfirm(false);
  };
  return (
    <>
      <aside aria-label="앱 업데이트" className="no-print fixed inset-x-3 z-[90] mx-auto max-w-md rounded-2xl border border-surface-border bg-surface p-4 text-foreground shadow-lg [overflow-wrap:anywhere]" style={{ top: 'calc(var(--app-safe-top) + 0.75rem)' }}>
        <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0 space-y-2">
          <p className="text-sm font-bold">{title}</p>
          {update && <p className="text-sm leading-relaxed text-foreground/70">{update.platform === 'web' ? `웹 버전 ${update.version}` : 'Google Play 업데이트'} · {downloading ? '계속 앱을 이용할 수 있습니다.' : '입력 중인 내용을 저장한 뒤 진행해주세요.'}</p>}
          {message && <p className="text-sm leading-relaxed">{message}</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {update && !downloading && <Button onClick={apply} loading={busy} disabled={checking} className={`${controlClass} grow`}>{actionLabel}</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => { closeConfirmation(); monitor.current?.dismiss(); }} className={`${controlClass} grow`}>{update ? '나중에' : '닫기'}</Button>
        </div>
      </aside>
      <Modal open={confirm && !!update} onClose={() => { if (!busy) closeConfirmation(); }} closeOnBackdrop={!busy}>
        <div className="min-w-0 space-y-4 px-5 py-5 pb-[calc(var(--app-safe-bottom)+1.25rem)] text-foreground [overflow-wrap:anywhere]" aria-busy={busy}>
          <h2 className="text-lg font-bold">새 버전을 적용할까요?</h2>
          <p className="text-sm leading-relaxed text-foreground/70">앱 화면이 다시 열립니다. 저장하지 않은 입력이 있다면 먼저 저장해주세요.</p>
          {message && <p role="alert" className="text-sm leading-relaxed">{message}</p>}
          <div className="flex flex-col gap-2">
            <Button variant="ghost" fullWidth disabled={busy} onClick={closeConfirmation} className={controlClass}>취소</Button>
            <Button fullWidth loading={busy} disabled={checking} onClick={() => {
              // AnimatePresence retains exiting dialog buttons briefly after cancel.
              if (!confirmationActive.current) return;
              closeConfirmation();
              void monitor.current?.apply();
            }} className={controlClass}>{actionLabel}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
