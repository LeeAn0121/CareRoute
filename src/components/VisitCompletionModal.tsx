'use client';

import { useId, useRef, useState } from 'react';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import { Button, IconButton, Modal } from '@/components/ui';
import type { VitalsInput } from '@/lib/vitalsLogs';

export type { VitalsInput } from '@/lib/vitalsLogs';

export interface VisitCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: string, vitals?: VitalsInput) => void | Promise<void>;
  recipientName: string;
  recipientId?: string;
  initialMemo?: string | null;
  saving?: boolean;
  saveError?: string;
  visitDateLabel?: string;
}

const VITAL_FIELDS = [
  { key: 'systolicBp', label: '수축기 혈압', unit: 'mmHg', step: '1' },
  { key: 'diastolicBp', label: '이완기 혈압', unit: 'mmHg', step: '1' },
  { key: 'bloodSugar', label: '혈당', unit: 'mg/dL', step: '1' },
  { key: 'temperature', label: '체온', unit: '℃', step: '0.1' },
] as const;

type VitalKey = typeof VITAL_FIELDS[number]['key'];

export default function VisitCompletionModal(props: VisitCompletionModalProps) {
  // Closing or switching visits creates a fresh draft; refreshes of the same visit do not.
  if (!props.isOpen) return null;
  return <CompletionDraft key={JSON.stringify([props.recipientId ?? props.recipientName, props.visitDateLabel ?? ''])} {...props} />;
}

function CompletionDraft({
  onClose, onSave, recipientName, initialMemo, saving = false, saveError = '', visitDateLabel,
}: VisitCompletionModalProps) {
  const id = useId();
  const [memo, setMemo] = useState(initialMemo ?? '');
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<VitalKey, string>>({
    systolicBp: '', diastolicBp: '', bloodSugar: '', temperature: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [callbackError, setCallbackError] = useState('');
  const submitRef = useRef(false);
  const busy = saving || submitting;
  const close = () => {
    if (!busy && !submitRef.current) onClose();
  };

  const save = async () => {
    if (busy || submitRef.current) return;
    setCallbackError('');
    const vitals: VitalsInput = {};
    for (const field of VITAL_FIELDS) {
      const raw = values[field.key].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0 || (field.step === '1' && !Number.isInteger(value))) {
        setExpanded(true);
        setCallbackError(`${field.label}에 올바른 ${field.step === '1' ? '양의 정수' : '숫자'}를 입력해주세요.`);
        return;
      }
      vitals[field.key] = value;
    }
    submitRef.current = true;
    setSubmitting(true);
    try {
      await onSave(memo, Object.keys(vitals).length ? vitals : undefined);
    } catch (error) {
      setCallbackError(error instanceof Error && error.message ? error.message : '저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={close} closeOnBackdrop={!busy}>
      <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-surface-border/60">
        <div className="min-w-0 break-words">
          <h2 className="text-xl font-black text-primary tracking-tight">방문 완료</h2>
          <p className="mt-1 text-base font-bold text-foreground break-words">{recipientName} 어르신</p>
          {visitDateLabel && <p className="mt-1 text-sm font-bold text-foreground/70 break-words">{visitDateLabel}</p>}
        </div>
        <IconButton onClick={close} disabled={busy} aria-label="닫기" className="min-h-11 min-w-11 shrink-0 rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]">
          <IconX size={20} />
        </IconButton>
      </div>

      <form
        onSubmit={(event) => { event.preventDefault(); void save(); }}
        onInvalidCapture={() => {
          setExpanded(true);
          setCallbackError('측정값을 확인해주세요. 혈압과 혈당은 양의 정수, 체온은 소수 첫째 자리까지 입력해주세요.');
        }}
      >
        <fieldset disabled={busy} aria-busy={busy} className="m-0 min-w-0 w-full border-0 p-4 sm:p-6 flex flex-col gap-4">
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-bold text-foreground/70">방문 메모 (선택)</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={5}
              placeholder="방문 중 확인한 내용을 입력해주세요."
              className="w-full min-w-0 min-h-32 resize-y rounded-[18px] border border-surface-border/60 bg-surface p-3 text-base leading-relaxed text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <div className="min-w-0 rounded-[18px] border border-surface-border/60 bg-foreground/[0.03] dark:bg-white/[0.04]">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${id}-vitals`}
              onClick={() => setExpanded((current) => !current)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[18px] p-3 text-left text-sm font-bold text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="min-w-0 break-words">혈압 · 혈당 · 체온 (선택)</span>
              <IconChevronDown size={18} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <div id={`${id}-vitals`} hidden={!expanded} className="grid min-w-0 grid-cols-1 min-[360px]:grid-cols-2 gap-3 p-3 pt-0">
              {VITAL_FIELDS.map((field) => (
                <label key={field.key} className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-bold text-foreground/70">{field.label} ({field.unit})</span>
                  <input
                    type="number"
                    inputMode={field.step === '1' ? 'numeric' : 'decimal'}
                    step={field.step}
                    min={field.step}
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="w-full min-w-0 min-h-11 rounded-[14px] border border-surface-border/60 bg-surface p-3 text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              ))}
            </div>
          </div>

          {(callbackError || saveError) && (
            <p role="alert" className="rounded-[18px] border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600 dark:text-red-400 break-words">
              {callbackError || saveError}
            </p>
          )}
          <Button type="submit" fullWidth disabled={busy} loading={busy} className="min-h-11 min-w-0 whitespace-normal break-words rounded-[18px] text-base">
            {busy ? '저장 중...' : '방문 완료하기'}
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
