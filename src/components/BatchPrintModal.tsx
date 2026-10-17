'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconX, IconPrinter, IconFileDownload } from '@tabler/icons-react';
import { Modal, IconButton, Button } from './ui';
import PrintSheet from './PrintSheet';
import { captureSheetCanvas, createA4Pdf, addCanvasAsA4Page } from '@/lib/pdfExport';

interface Recipient {
  id: string;
  name: string;
  photo_url?: string | null;
  age?: number | null;
  care_grade?: string | null;
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
  onWrittenDateChange,
  onAuthorNameChange,
  sheetRef,
}: {
  recipient: Recipient;
  writtenDate: string;
  authorName: string;
  onWrittenDateChange: (v: string) => void;
  onAuthorNameChange: (v: string) => void;
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
    />
  );
}

export default function BatchPrintModal({ isOpen, onClose, recipients, dateLabel }: BatchPrintModalProps) {
  const [writtenDate, setWrittenDate] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const sheetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setWrittenDate(todayYMD());
      setAuthorName(localStorage.getItem('careroute_print_author_name') || '');
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authorName) localStorage.setItem('careroute_print_author_name', authorName);
  }, [authorName]);

  const setSheetRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) sheetRefs.current.set(id, el);
      else sheetRefs.current.delete(id);
    },
    []
  );

  const handleDownloadPdf = async () => {
    if (recipients.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = await createA4Pdf();
      for (let i = 0; i < recipients.length; i++) {
        const el = sheetRefs.current.get(recipients[i].id);
        if (!el) continue;
        const canvas = await captureSheetCanvas(el);
        addCanvasAsA4Page(pdf, canvas, i === 0);
      }
      pdf.save(`${dateLabel ? dateLabel + '_' : ''}방문일정_어르신정보.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 생성에 실패했습니다. 인쇄 버튼으로 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">
            {dateLabel ? `${dateLabel} 일정 일괄 출력` : '일정 일괄 출력'}
          </h2>
          <p className="text-[12px] font-bold text-foreground/50">총 {recipients.length}명의 정보를 한 번에 인쇄/저장합니다</p>
        </div>
        <IconButton onClick={onClose} className="shrink-0 w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={18} />
        </IconButton>
      </div>

      <div className="px-5 sm:px-6 py-3 flex flex-col gap-6 print-area">
        {recipients.map((r) => (
          <div key={r.id} className="batch-sheet-card flex flex-col gap-2">
            <p className="no-print text-[12px] font-black text-foreground/40 pl-1">{r.name} 어르신</p>
            <RecipientSheetCard
              recipient={r}
              writtenDate={writtenDate}
              authorName={authorName}
              onWrittenDateChange={setWrittenDate}
              onAuthorNameChange={setAuthorName}
              sheetRef={setSheetRef(r.id)}
            />
          </div>
        ))}
      </div>

      <div className="no-print sticky bottom-0 z-10 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-xl border-t border-surface-border/40 flex gap-2.5">
        <Button
          type="button"
          variant="ghost"
          fullWidth
          loading={isExporting}
          startIcon={<IconFileDownload size={19} />}
          onClick={handleDownloadPdf}
          className="whitespace-nowrap py-3.5 text-[15px] font-black rounded-[22px]"
        >
          {isExporting ? '생성 중...' : 'PDF로 저장'}
        </Button>
        <Button
          type="button"
          fullWidth
          startIcon={<IconPrinter size={19} />}
          onClick={() => window.print()}
          className="whitespace-nowrap py-3.5 text-[15px] font-black rounded-[22px] shadow-lg shadow-primary/20"
        >
          인쇄하기
        </Button>
      </div>
    </Modal>
  );
}
