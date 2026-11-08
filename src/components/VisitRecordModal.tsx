'use client';

import { useEffect, useRef, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { Modal, Button, IconButton, Spinner } from '@/components/ui';
import { fetchVisitSessionEvents, localDateKey, type VisitSession, type VisitSessionEvent, type VisitStatus } from '@/lib/visitSessions';

interface VisitRecordModalProps {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  dateKey: string;
  session: VisitSession | null;
  onTransition: (status: VisitStatus, reason: string, expectedVersion: number) => Promise<void>;
  saving: boolean;
  error: string;
}

const labels: Record<VisitStatus, string> = {
  planned: '방문 예정', in_progress: '방문 중', completed: '방문 완료', missed: '미방문', cancelled: '방문 취소',
};

function timestamp(value: string | null, fallback = '기록 없음') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '시간 확인 불가' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function VisitRecordModal(props: VisitRecordModalProps) {
  return <VisitRecordContent key={`${props.dateKey}:${props.session?.recipient_id ?? props.recipientName}`} {...props} />;
}

function VisitRecordContent({ open, onClose, recipientName, dateKey, session, onTransition, saving, error }: VisitRecordModalProps) {
  const [target, setTarget] = useState<VisitStatus | null>(null);
  const [reason, setReason] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [events, setEvents] = useState<VisitSessionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const busy = saving || pending;
  const status = session?.status ?? 'planned';
  const future = dateKey > localDateKey();

  useEffect(() => {
    if (!open || !session?.id) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return [];
      setLoading(true);
      setLoadError('');
      return fetchVisitSessionEvents(session.id);
    }).then(result => {
      if (active) setEvents([...result].sort((a, b) => b.created_at.localeCompare(a.created_at) || (b.after_state?.version || 0) - (a.after_state?.version || 0)).slice(0, 20));
    }).catch(() => {
      if (active) setLoadError('변경 이력을 불러오지 못했습니다. 다시 시도해주세요.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, session?.id, session?.version, reload]);

  const allowed = (next: VisitStatus) => next === 'planned'
    ? status !== 'planned'
    : (status === 'planned' || status === 'in_progress') && (next === 'cancelled' || (next === 'missed' && !future));
  const beginChange = (next: VisitStatus) => {
    setExpectedVersion(session?.version || 0);
    setReason('');
    setSubmitError('');
    setTarget(next);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || submitting.current || !target || !reason.trim() || !allowed(target)) return;
    submitting.current = true;
    setPending(true);
    setSubmitError('');
    try {
      await onTransition(target, reason.trim(), expectedVersion);
      setTarget(null);
      setReason('');
      setReload(value => value + 1);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : '상태 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  const close = () => { if (!busy && !submitting.current) onClose(); };
  const actionClass = 'min-w-0 whitespace-normal break-words text-base';

  return (
    <Modal open={open} onClose={close} closeOnBackdrop={!busy}>
      <div className="w-full min-w-0 break-words text-base text-foreground" aria-busy={busy}>
        <header className="flex items-start justify-between gap-3 border-b border-surface-border/60 p-6">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight text-primary">방문 기록</h2>
            <p className="mt-1 font-semibold">{recipientName} 어르신</p>
          </div>
          <IconButton onClick={close} disabled={busy} aria-label="닫기" className="shrink-0 rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]"><IconX size={20} /></IconButton>
        </header>
        <div className="flex min-w-0 flex-col gap-5 p-6">
          <dl className="flex flex-col gap-3 rounded-[22px] border border-surface-border/60 bg-foreground/[0.03] p-4">
            <div><dt className="font-bold text-foreground/70">방문 날짜</dt><dd><time dateTime={dateKey}>{dateKey}</time></dd></div>
            <div><dt className="font-bold text-foreground/70">상태</dt><dd className="font-black text-primary">{labels[status]}</dd></div>
            <div><dt className="font-bold text-foreground/70">시작 시각</dt><dd>{timestamp(session?.started_at ?? null)}</dd></div>
            <div><dt className="font-bold text-foreground/70">완료 시각</dt><dd>{timestamp(session?.completed_at ?? null, status === 'completed' ? '기존 완료 기록 · 완료 시각 알 수 없음' : '기록 없음')}</dd></div>
            <div><dt className="font-bold text-foreground/70">메모</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{session?.memo || '기록된 메모가 없습니다.'}</dd></div>
          </dl>
          <p className="text-foreground/70">방문 시작과 완료는 이 창을 닫고 방문 페이지에서 진행해주세요.</p>
          <div className="flex flex-col gap-2">
            {status === 'completed' && <Button variant="ghost" disabled={busy} onClick={() => beginChange('planned')} className={actionClass}>완료 기록 정정</Button>}
            {status === 'in_progress' && <Button variant="ghost" disabled={busy} onClick={() => beginChange('planned')} className={actionClass}>방문 시작 기록 정정</Button>}
            {(status === 'planned' || status === 'in_progress') && <>
              <Button variant="ghost" disabled={busy || future} onClick={() => beginChange('missed')} className={actionClass}>미방문으로 변경</Button>
              {future && <p className="text-foreground/70">미래 날짜는 미방문으로 변경할 수 없습니다.</p>}
              <Button variant="danger-ghost" disabled={busy} onClick={() => beginChange('cancelled')} className={actionClass}>방문 취소</Button>
            </>}
            {(status === 'missed' || status === 'cancelled') && <Button variant="ghost" disabled={busy} onClick={() => beginChange('planned')} className={actionClass}>방문 예정으로 변경</Button>}
          </div>
          {target && allowed(target) && <form onSubmit={submit} className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-surface-border p-4">
            <h3 className="font-black">{labels[target]} 상태로 변경</h3>
            <p className="text-foreground/70">기존 메모와 변경 이력은 보존됩니다. 정정 사유를 남겨주세요.</p>
            <label className="flex flex-col gap-2 font-bold">변경 사유 (필수)
              <textarea required value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={3} className="w-full min-w-0 resize-y rounded-[18px] border border-surface-border/60 bg-surface p-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <Button type="submit" disabled={busy || !reason.trim()} loading={busy} className={actionClass}>{labels[target]} 상태로 변경 확인</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setTarget(null)} className={actionClass}>변경 취소</Button>
          </form>}
          {(error || submitError) && <p role="alert" className="rounded-[18px] border border-red-500/20 bg-red-500/10 p-3 text-red-600 dark:text-red-400">{error || submitError}</p>}
          <section className="min-w-0" aria-label="방문 변경 이력">
            <h3 className="mb-3 font-black">최근 변경 이력 (최대 20건)</h3>
            {loading ? <p role="status"><Spinner /> 이력을 불러오는 중...</p> : loadError ? <div role="alert" className="flex flex-col gap-2"><p>{loadError}</p><Button variant="ghost" disabled={busy} onClick={() => setReload(value => value + 1)} className={actionClass}>이력 다시 불러오기</Button></div> : events.length ? <ol className="flex flex-col gap-3">{events.map(event => <li key={event.id} className="rounded-[18px] border border-surface-border/60 p-4 [overflow-wrap:anywhere]">
              <p className="font-bold">{event.from_status ? labels[event.from_status] : '기록 없음'} → {labels[event.to_status]}</p>
              <p className="text-foreground/70">{timestamp(event.created_at)}</p>
              <p className="mt-2 whitespace-pre-wrap">사유: {event.reason || '기록된 사유 없음'}</p>
              <p className="mt-2 whitespace-pre-wrap">변경 전 메모: {event.before_state?.memo || '기록된 메모 없음'}</p>
              {event.before_state?.status === 'completed' && <p className="mt-2">이전 완료 시각: {timestamp(event.before_state.completed_at, '기존 기록 · 완료 시각 알 수 없음')}</p>}
              <p className="mt-2 whitespace-pre-wrap">변경 후 메모: {event.after_state?.memo || '기록된 메모 없음'}</p>
            </li>)}</ol> : <p className="text-foreground/70">변경 이력이 없습니다.</p>}
          </section>
        </div>
      </div>
    </Modal>
  );
}
