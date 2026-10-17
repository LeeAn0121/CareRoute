'use client';

import { useState, useEffect, useRef } from 'react';
import { IconX, IconPrinter, IconFileDownload, IconShare2, IconEye, IconEyeOff, IconHistory } from '@tabler/icons-react';
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
  const [confirmerName, setConfirmerName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgContact, setOrgContact] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 어르신별로 작성 중이던 내용을 기억해뒀다가 다음에 출력할 때 이어서 쓸 수 있게 한다.
  // 작성자명/기관 정보는 기기 공용으로 기억해 매번 다시 입력하지 않게 하고,
  // 작성일/확인자는 열 때마다 초기화한다(확인자는 방문마다 달라질 수 있어 비워 둠).
  useEffect(() => {
    if (isOpen && recipient && typeof window !== 'undefined') {
      setHealthStatus(localStorage.getItem(`careroute_print_health_${recipient.id}`) || '');
      setMemo(localStorage.getItem(`careroute_print_memo_${recipient.id}`) || '');
      setWrittenDate(todayYMD());
      setAuthorName(localStorage.getItem('careroute_print_author_name') || '');
      setConfirmerName('');
      setOrgName(localStorage.getItem('careroute_print_org_name') || '');
      setOrgContact(localStorage.getItem('careroute_print_org_contact') || '');
      setIsPreview(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (orgName) localStorage.setItem('careroute_print_org_name', orgName);
  }, [orgName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (orgContact) localStorage.setItem('careroute_print_org_contact', orgContact);
  }, [orgContact]);

  const buildPdf = async () => {
    if (!sheetRef.current) return null;
    const canvas = await captureSheetCanvas(sheetRef.current);
    const pdf = await createA4Pdf();
    addCanvasAsA4Page(pdf, canvas, true);
    return pdf;
  };

  const handleDownloadPdf = async () => {
    if (!recipient) return;
    setIsExporting(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      pdf.save(`${recipient.name}_어르신_정보.pdf`);
      logPrintEvent({ recipientId: recipient.id, recipientName: recipient.name, method: 'pdf', authorName });
    } catch (e) {
      console.error(e);
      alert('PDF 생성에 실패했습니다. 인쇄 버튼으로 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!recipient) return;
    if (typeof navigator === 'undefined' || !navigator.share) {
      alert('이 기기/브라우저에서는 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
      return;
    }
    setIsSharing(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      const blob = pdf.output('blob') as Blob;
      const file = new File([blob], `${recipient.name}_어르신_정보.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        alert('이 기기/브라우저에서는 PDF 공유를 지원하지 않습니다. "PDF로 저장" 후 직접 공유해주세요.');
        return;
      }
      await navigator.share({ files: [file], title: `${recipient.name} 어르신 정보` });
      logPrintEvent({ recipientId: recipient.id, recipientName: recipient.name, method: 'share', authorName });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error(e);
      alert('공유에 실패했습니다. "PDF로 저장" 후 직접 공유해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = () => {
    if (!recipient) return;
    logPrintEvent({ recipientId: recipient.id, recipientName: recipient.name, method: 'print', authorName });
    window.print();
  };

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">어르신 정보 출력</h2>
          <p className="text-[12px] font-bold text-foreground/50">내용을 채운 뒤 인쇄하거나 PDF로 저장하세요</p>
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

      <div className={`px-5 sm:px-6 py-3 print-area ${isPreview ? 'print-preview-mode' : ''}`}>
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
          confirmerName={confirmerName}
          onConfirmerNameChange={setConfirmerName}
          orgName={orgName}
          onOrgNameChange={setOrgName}
          orgContact={orgContact}
          onOrgContactChange={setOrgContact}
        />
      </div>

      <div className="no-print sticky bottom-0 z-10 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-xl border-t border-surface-border/40 flex gap-2">
        <IconButton
          onClick={handleShare}
          disabled={isSharing}
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
