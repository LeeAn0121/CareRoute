'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconX, IconPrinter, IconFileDownload, IconShare2, IconEye, IconEyeOff, IconHistory, IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import { Modal, IconButton, Button } from './ui';
import PrintSheet from './PrintSheet';
import PrintHistorySheet from './PrintHistorySheet';
import { captureSheetCanvas, createA4Pdf, addCanvasAsA4Page } from '@/lib/pdfExport';
import { logPrintEvent, uploadPrintPdf } from '@/lib/printLogs';

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
  completed?: boolean;
}

interface BatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Recipient[];
  dateLabel?: string;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 어르신별 건강 상태/메모는 각자 로컬 저장소에 보관해, 개별 출력 화면에서 작성한 내용을 그대로 이어서 쓴다.
function useRecipientDraft(recipient: Recipient, storageKey: 'health' | 'memo') {
  const key = `careroute_print_${storageKey}_${recipient.id}`;
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
  const [healthStatus, setHealthStatus] = useRecipientDraft(recipient, 'health');
  const [memo, setMemo] = useRecipientDraft(recipient, 'memo');

  return (
    <PrintSheet
      ref={sheetRef}
      recipient={recipient}
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

export default function BatchPrintModal({ isOpen, onClose, recipients, dateLabel }: BatchPrintModalProps) {
  const [writtenDate, setWrittenDate] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [confirmerName, setConfirmerName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgContact, setOrgContact] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingBackup, setIsSavingBackup] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const sheetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setWrittenDate(todayYMD());
      setAuthorName(localStorage.getItem('careroute_print_author_name') || '');
      setConfirmerName('');
      setOrgName(localStorage.getItem('careroute_print_org_name') || '');
      setOrgContact(localStorage.getItem('careroute_print_org_contact') || '');
      setIsPreview(false);
      setSelectedIds(new Set(recipients.map((r) => r.id)));
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
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) sheetRefs.current.set(id, el);
      else sheetRefs.current.delete(id);
    },
    []
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 완료 여부 정보가 있을 때만(일정 탭에서 넘겨줄 때만) 미완료/완료 필터 칩을 보여준다.
  const hasCompletionInfo = recipients.some((r) => r.completed !== undefined);
  const selectByFilter = (predicate: (r: Recipient) => boolean) => {
    setSelectedIds(new Set(recipients.filter(predicate).map((r) => r.id)));
  };

  const selectedRecipients = recipients.filter((r) => selectedIds.has(r.id));

  const buildPdf = async () => {
    if (selectedRecipients.length === 0) return null;
    const pdf = await createA4Pdf();
    for (let i = 0; i < selectedRecipients.length; i++) {
      const el = sheetRefs.current.get(selectedRecipients[i].id);
      if (!el) continue;
      const canvas = await captureSheetCanvas(el);
      addCanvasAsA4Page(pdf, canvas, i === 0);
    }
    return pdf;
  };

  const handleDownloadPdf = async () => {
    if (selectedRecipients.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      pdf.save(`${dateLabel ? dateLabel + '_' : ''}방문일정_어르신정보.pdf`);
      logPrintEvent({ recipientName: selectedRecipients[0].name, recipientIds: selectedRecipients.map((r) => r.id), method: 'pdf', batchCount: selectedRecipients.length, authorName });
    } catch (e) {
      console.error(e);
      alert('PDF 생성에 실패했습니다. 인쇄 버튼으로 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  // PDF를 기기에 저장하면서 동시에 서버(print-pdfs 버킷)에도 올려, 나중에 출력 이력에서
  // 다시 열어볼 수 있게 보관한다.
  const handleSaveWithBackup = async () => {
    if (selectedRecipients.length === 0) return;
    setIsSavingBackup(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      const fileNameBase = `${dateLabel ? dateLabel + '_' : ''}방문일정_어르신정보`;
      pdf.save(`${fileNameBase}.pdf`);
      const blob = pdf.output('blob') as Blob;
      const pdfPath = await uploadPrintPdf(blob, selectedRecipients[0].id, fileNameBase);
      logPrintEvent({
        recipientName: selectedRecipients[0].name,
        recipientIds: selectedRecipients.map((r) => r.id),
        method: 'save',
        batchCount: selectedRecipients.length,
        authorName,
        pdfPath,
      });
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. PDF 아이콘으로 다시 시도해주세요.');
    } finally {
      setIsSavingBackup(false);
    }
  };

  const handleShare = async () => {
    if (selectedRecipients.length === 0) return;
    if (typeof navigator === 'undefined' || !navigator.share) {
      alert('이 기기/브라우저에서는 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
      return;
    }
    setIsSharing(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      const blob = pdf.output('blob') as Blob;
      const fileName = `${dateLabel ? dateLabel + '_' : ''}방문일정_어르신정보.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        alert('이 기기/브라우저에서는 PDF 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
        return;
      }
      await navigator.share({ files: [file], title: fileName });
      logPrintEvent({ recipientName: selectedRecipients[0].name, recipientIds: selectedRecipients.map((r) => r.id), method: 'share', batchCount: selectedRecipients.length, authorName });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error(e);
      alert('공유에 실패했습니다. "PDF로 저장" 후 직접 공유해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = () => {
    if (selectedRecipients.length === 0) return;
    logPrintEvent({ recipientName: selectedRecipients[0].name, recipientIds: selectedRecipients.map((r) => r.id), method: 'print', batchCount: selectedRecipients.length, authorName });
    window.print();
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">
            {dateLabel ? `${dateLabel} 일정 일괄 출력` : '일정 일괄 출력'}
          </h2>
          <p className="text-[12px] font-bold text-foreground/50">{selectedRecipients.length}명 선택됨 (총 {recipients.length}명)</p>
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

      {/* 완료/미완료만 빠르게 선택: 방문 전 남은 인원만 출력할 때 유용 */}
      {recipients.length > 1 && hasCompletionInfo && (
        <div className="no-print px-5 sm:px-6 pb-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectByFilter(() => true)}
            className="px-3 py-1.5 rounded-full text-[11px] font-black bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] transition-colors active:scale-95"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => selectByFilter((r) => !r.completed)}
            className="px-3 py-1.5 rounded-full text-[11px] font-black bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] transition-colors active:scale-95"
          >
            미완료만
          </button>
          <button
            type="button"
            onClick={() => selectByFilter((r) => Boolean(r.completed))}
            className="px-3 py-1.5 rounded-full text-[11px] font-black bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] transition-colors active:scale-95"
          >
            완료만
          </button>
        </div>
      )}

      {/* 출력할 인원 선택: 화면에서만 보이고 인쇄/PDF에는 포함되지 않는다 */}
      {recipients.length > 1 && (
        <div className="no-print px-5 sm:px-6 pb-3 flex flex-wrap gap-1.5">
          {recipients.map((r) => {
            const checked = selectedIds.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleSelected(r.id)}
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
      )}

      <div className={`px-5 sm:px-6 py-3 flex flex-col gap-6 print-area ${isPreview ? 'print-preview-mode' : ''}`}>
        {selectedRecipients.length === 0 ? (
          <p className="no-print text-[13px] font-bold text-foreground/40 text-center py-10">출력할 어르신을 선택해주세요</p>
        ) : (
          selectedRecipients.map((r) => (
            <div key={r.id} className="batch-sheet-card flex flex-col gap-2">
              <p className="no-print text-[12px] font-black text-foreground/40 pl-1">{r.name} 어르신</p>
              <RecipientSheetCard
                recipient={r}
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
                sheetRef={setSheetRef(r.id)}
              />
            </div>
          ))
        )}
      </div>

      <div className="no-print sticky bottom-0 z-10 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-xl border-t border-surface-border/40 flex gap-2">
        <IconButton
          onClick={handleShare}
          disabled={isSharing || selectedRecipients.length === 0}
          className="shrink-0 w-[52px] h-[52px] rounded-[22px] bg-surface-muted/80 text-foreground/80 border border-surface-border/40"
          aria-label="공유하기"
        >
          {isSharing ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <IconShare2 size={19} />}
        </IconButton>
        <IconButton
          onClick={handleDownloadPdf}
          disabled={isExporting || selectedRecipients.length === 0}
          className="shrink-0 w-[52px] h-[52px] rounded-[22px] bg-surface-muted/80 text-foreground/80 border border-surface-border/40"
          aria-label="PDF로 저장"
        >
          {isExporting ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <IconFileDownload size={19} />}
        </IconButton>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          loading={isSavingBackup}
          disabled={selectedRecipients.length === 0}
          startIcon={<IconDeviceFloppy size={19} />}
          onClick={handleSaveWithBackup}
          className="whitespace-nowrap py-3.5 text-[15px] font-black rounded-[22px]"
        >
          {isSavingBackup ? '저장 중...' : '저장'}
        </Button>
        <Button
          type="button"
          fullWidth
          disabled={selectedRecipients.length === 0}
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
