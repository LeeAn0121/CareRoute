'use client';

import { useState, useEffect, useRef } from 'react';
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

interface PrintProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: Recipient | null;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PrintProfileModal({ isOpen, onClose, recipient }: PrintProfileModalProps) {
  const [healthStatus, setHealthStatus] = useState('');
  const [memo, setMemo] = useState('');
  const [writtenDate, setWrittenDate] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 어르신별로 작성 중이던 내용을 기억해뒀다가 다음에 출력할 때 이어서 쓸 수 있게 한다.
  // 작성자명은 기기 공용으로 기억해 매번 다시 입력하지 않게 하고, 작성일은 열 때마다 오늘 날짜로 기본 설정.
  useEffect(() => {
    if (isOpen && recipient && typeof window !== 'undefined') {
      setHealthStatus(localStorage.getItem(`careroute_print_health_${recipient.id}`) || '');
      setMemo(localStorage.getItem(`careroute_print_memo_${recipient.id}`) || '');
      setWrittenDate(todayYMD());
      setAuthorName(localStorage.getItem('careroute_print_author_name') || '');
    }
  }, [isOpen, recipient]);

  useEffect(() => {
    if (!recipient || typeof window === 'undefined') return;
    if (healthStatus) localStorage.setItem(`careroute_print_health_${recipient.id}`, healthStatus);
    else localStorage.removeItem(`careroute_print_health_${recipient.id}`);
  }, [healthStatus, recipient]);

  useEffect(() => {
    if (!recipient || typeof window === 'undefined') return;
    if (memo) localStorage.setItem(`careroute_print_memo_${recipient.id}`, memo);
    else localStorage.removeItem(`careroute_print_memo_${recipient.id}`);
  }, [memo, recipient]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authorName) localStorage.setItem('careroute_print_author_name', authorName);
  }, [authorName]);

  const handleDownloadPdf = async () => {
    if (!recipient || !sheetRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await captureSheetCanvas(sheetRef.current);
      const pdf = await createA4Pdf();
      addCanvasAsA4Page(pdf, canvas, true);
      pdf.save(`${recipient.name}_어르신_정보.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 생성에 실패했습니다. 인쇄 버튼으로 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">어르신 정보 출력</h2>
          <p className="text-[12px] font-bold text-foreground/50">내용을 채운 뒤 인쇄하거나 PDF로 저장하세요</p>
        </div>
        <IconButton onClick={onClose} className="shrink-0 w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={18} />
        </IconButton>
      </div>

      <div className="px-5 sm:px-6 py-3 print-area">
        <PrintSheet
          ref={sheetRef}
          recipient={recipient}
          healthStatus={healthStatus}
          onHealthStatusChange={setHealthStatus}
          memo={memo}
          onMemoChange={setMemo}
          writtenDate={writtenDate}
          onWrittenDateChange={setWrittenDate}
          authorName={authorName}
          onAuthorNameChange={setAuthorName}
        />
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
