'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconX, IconPrinter, IconFileDownload, IconShare2, IconEye, IconEyeOff, IconHistory, IconCheck } from '@tabler/icons-react';
import { Modal, IconButton, Button } from './ui';
import PrintSheet from './PrintSheet';
import PrintHistorySheet from './PrintHistorySheet';
import { captureSheetCanvas, createA4Pdf, addCanvasAsA4Page } from '@/lib/pdfExport';
import { logPrintEvent } from '@/lib/printLogs';

interface Recipient {
  id: string;
  name: string;
  photo_url?: string | null;
  age?: number | null;
  care_grade?: string | null;
  health_tags?: string | null;
  visit_time?: string | null;
  notes?: string | null;
  door_passcode?: string | null;
  parking_memo?: string | null;
}

interface WeekDayGroup {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // "10월 20일 (월)"
  recipients: Recipient[];
}

interface WeeklyPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  days: WeekDayGroup[];
  weekLabel?: string; // 파일명/표시용, 예: "10.19~10.25"
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function entryKey(dateKey: string, recipientId: string): string {
  return `${dateKey}__${recipientId}`;
}

// 같은 어르신이 여러 날 방문 예정이어도 수기 입력 초안은 사람 기준으로 하나만 기억한다
// (개별/일괄 출력과 동일한 저장 방식).
function useRecipientDraft(recipientId: string, storageKey: 'health' | 'memo') {
  const key = `careroute_print_${storageKey}_${recipientId}`;
  const [value, setValue] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setValue(localStorage.getItem(key) || '');
  }, [key]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  }, [key, value]);
  return [value, setValue] as const;
}

function RecipientSheetCard({
  recipient,
  scheduleLabel,
  writtenDate,
  authorName,
  confirmerName,
  orgName,
  orgContact,
  onWrittenDateChange,
  onAuthorNameChange,
  onConfirmerNameChange,
  onOrgNameChange,
  onOrgContactChange,
  sheetRef,
}: {
  recipient: Recipient;
  scheduleLabel: string;
  writtenDate: string;
  authorName: string;
  confirmerName: string;
  orgName: string;
  orgContact: string;
  onWrittenDateChange: (v: string) => void;
  onAuthorNameChange: (v: string) => void;
  onConfirmerNameChange: (v: string) => void;
  onOrgNameChange: (v: string) => void;
  onOrgContactChange: (v: string) => void;
  sheetRef: (el: HTMLDivElement | null) => void;
}) {
  const [healthStatus, setHealthStatus] = useRecipientDraft(recipient.id, 'health');
  const [memo, setMemo] = useRecipientDraft(recipient.id, 'memo');

  return (
    <PrintSheet
      ref={sheetRef}
      recipient={recipient}
      scheduleLabel={scheduleLabel}
      healthStatus={healthStatus}
      onHealthStatusChange={setHealthStatus}
      memo={memo}
      onMemoChange={setMemo}
      writtenDate={writtenDate}
      onWrittenDateChange={onWrittenDateChange}
      authorName={authorName}
      onAuthorNameChange={onAuthorNameChange}
      confirmerName={confirmerName}
      onConfirmerNameChange={onConfirmerNameChange}
      orgName={orgName}
      onOrgNameChange={onOrgNameChange}
      orgContact={orgContact}
      onOrgContactChange={onOrgContactChange}
    />
  );
}

export default function WeeklyPrintModal({ isOpen, onClose, days, weekLabel }: WeeklyPrintModalProps) {
  const [writtenDate, setWrittenDate] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [confirmerName, setConfirmerName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgContact, setOrgContact] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const sheetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const allEntries = days.flatMap((day) =>
    day.recipients.map((recipient) => ({ key: entryKey(day.dateKey, recipient.id), dateLabel: day.dateLabel, recipient }))
  );

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setWrittenDate(todayYMD());
      setAuthorName(localStorage.getItem('careroute_print_author_name') || '');
      setConfirmerName('');
      setOrgName(localStorage.getItem('careroute_print_org_name') || '');
      setOrgContact(localStorage.getItem('careroute_print_org_contact') || '');
      setIsPreview(false);
      setSelectedKeys(new Set(days.flatMap((day) => day.recipients.map((r) => entryKey(day.dateKey, r.id)))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authorName) localStorage.setItem('careroute_print_author_name', authorName);
  }, [authorName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (orgName) localStorage.setItem('careroute_print_org_name', orgName);
  }, [orgName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (orgContact) localStorage.setItem('careroute_print_org_contact', orgContact);
  }, [orgContact]);

  const setSheetRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) sheetRefs.current.set(key, el);
      else sheetRefs.current.delete(key);
    },
    []
  );

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(allEntries.map((e) => e.key)));
  const selectNone = () => setSelectedKeys(new Set());

  const selectedEntries = allEntries.filter((e) => selectedKeys.has(e.key));

  const buildPdf = async () => {
    if (selectedEntries.length === 0) return null;
    const pdf = await createA4Pdf();
    for (let i = 0; i < selectedEntries.length; i++) {
      const el = sheetRefs.current.get(selectedEntries[i].key);
      if (!el) continue;
      const canvas = await captureSheetCanvas(el);
      addCanvasAsA4Page(pdf, canvas, i === 0);
    }
    return pdf;
  };

  const logWeekly = (method: 'pdf' | 'share' | 'print') => {
    const recipientIds = Array.from(new Set(selectedEntries.map((e) => e.recipient.id)));
    logPrintEvent({
      recipientName: selectedEntries[0].recipient.name,
      recipientIds,
      method,
      batchCount: selectedEntries.length,
      authorName,
    });
  };

  const fileName = `${weekLabel ? weekLabel + '_' : ''}주간_방문일정_어르신정보.pdf`;

  const handleDownloadPdf = async () => {
    if (selectedEntries.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      pdf.save(fileName);
      logWeekly('pdf');
    } catch (e) {
      console.error(e);
      alert('PDF 생성에 실패했습니다. 인쇄 버튼으로 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (selectedEntries.length === 0) return;
    if (typeof navigator === 'undefined' || !navigator.share) {
      alert('이 기기/브라우저에서는 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
      return;
    }
    setIsSharing(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      const blob = pdf.output('blob') as Blob;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        alert('이 기기/브라우저에서는 PDF 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
        return;
      }
      await navigator.share({ files: [file], title: fileName });
      logWeekly('share');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error(e);
      alert('공유에 실패했습니다. "PDF로 저장" 후 직접 공유해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = () => {
    if (selectedEntries.length === 0) return;
    logWeekly('print');
    window.print();
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">
            {weekLabel ? `${weekLabel} 주간 출력` : '이번 주 전체 출력'}
          </h2>
          <p className="text-[12px] font-bold text-foreground/50">{selectedEntries.length}명 선택됨 (총 {allEntries.length}명)</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <IconButton onClick={() => setIsHistoryOpen(true)} className="w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="출력 이력">
            <IconHistory size={17} />
          </IconButton>
          <IconButton
            onClick={() => setIsPreview((v) => !v)}
            className={`w-9 h-9 rounded-full ${isPreview ? 'bg-primary/15 text-primary' : 'bg-foreground/[0.04] hover:bg-foreground/[0.08]'}`}
            aria-label="인쇄 미리보기"
          >
            {isPreview ? <IconEyeOff size={17} /> : <IconEye size={17} />}
          </IconButton>
          <IconButton onClick={onClose} className="w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
            <IconX size={18} />
          </IconButton>
        </div>
      </div>

      {allEntries.length === 0 ? (
        <p className="no-print px-5 sm:px-6 pb-4 text-[13px] font-bold text-foreground/40 text-center py-10">이번 주 방문 예정인 어르신이 없습니다</p>
      ) : (
        <>
          <div className="no-print px-5 sm:px-6 pb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 rounded-full text-[11px] font-black bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] transition-colors active:scale-95"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="px-3 py-1.5 rounded-full text-[11px] font-black bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] transition-colors active:scale-95"
            >
              전체 해제
            </button>
          </div>

          {/* 날짜별로 묶어서 선택: 요일별 서류 준비 흐름과 맞춘다 */}
          {days.filter((day) => day.recipients.length > 0).map((day) => (
            <div key={day.dateKey} className="no-print px-5 sm:px-6 pb-3">
              <p className="text-[11px] font-black text-foreground/40 pb-1.5 pl-1">{day.dateLabel} · {day.recipients.length}명</p>
              <div className="flex flex-wrap gap-1.5">
                {day.recipients.map((r) => {
                  const key = entryKey(day.dateKey, r.id);
                  const checked = selectedKeys.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSelected(key)}
                      className={`flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-[12px] font-black border transition-all active:scale-95 ${
                        checked
                          ? 'bg-primary text-primary-foreground border-transparent'
                          : 'bg-surface text-foreground/50 border-surface-border/60'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${checked ? 'bg-primary-foreground/20' : 'border border-foreground/25'}`}>
                        {checked && <IconCheck size={11} strokeWidth={3} />}
                      </span>
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <div className={`px-5 sm:px-6 py-3 flex flex-col gap-6 print-area ${isPreview ? 'print-preview-mode' : ''}`}>
        {selectedEntries.length === 0 ? (
          <p className="no-print text-[13px] font-bold text-foreground/40 text-center py-10">출력할 어르신을 선택해주세요</p>
        ) : (
          selectedEntries.map((entry) => (
            <div key={entry.key} className="batch-sheet-card flex flex-col gap-2">
              <p className="no-print text-[12px] font-black text-foreground/40 pl-1">{entry.dateLabel} · {entry.recipient.name} 어르신</p>
              <RecipientSheetCard
                recipient={entry.recipient}
                scheduleLabel={entry.dateLabel}
                writtenDate={writtenDate}
                authorName={authorName}
                confirmerName={confirmerName}
                orgName={orgName}
                orgContact={orgContact}
                onWrittenDateChange={setWrittenDate}
                onAuthorNameChange={setAuthorName}
                onConfirmerNameChange={setConfirmerName}
                onOrgNameChange={setOrgName}
                onOrgContactChange={setOrgContact}
                sheetRef={setSheetRef(entry.key)}
              />
            </div>
          ))
        )}
      </div>

      <div className="no-print sticky bottom-0 z-10 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-xl border-t border-surface-border/40 flex gap-2">
        <IconButton
          onClick={handleShare}
          disabled={isSharing || selectedEntries.length === 0}
          className="shrink-0 w-[52px] h-[52px] rounded-[22px] bg-surface-muted/80 text-foreground/80 border border-surface-border/40"
          aria-label="공유하기"
        >
          {isSharing ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <IconShare2 size={19} />}
        </IconButton>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          loading={isExporting}
          disabled={selectedEntries.length === 0}
          startIcon={<IconFileDownload size={19} />}
          onClick={handleDownloadPdf}
          className="whitespace-nowrap py-3.5 text-[15px] font-black rounded-[22px]"
        >
          {isExporting ? '생성 중...' : 'PDF로 저장'}
        </Button>
        <Button
          type="button"
          fullWidth
          disabled={selectedEntries.length === 0}
          startIcon={<IconPrinter size={19} />}
          onClick={handlePrint}
          className="whitespace-nowrap py-3.5 text-[15px] font-black rounded-[22px] shadow-lg shadow-primary/20"
        >
          인쇄하기
        </Button>
      </div>

      <PrintHistorySheet open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </Modal>
  );
}
