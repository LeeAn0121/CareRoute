'use client';

import { useEffect, useState } from 'react';
import { captureAccountStorage } from '@/lib/accountStorage';
import { IconHistory, IconPrinter, IconFileDownload, IconShare2, IconCloudCheck, IconExternalLink } from '@tabler/icons-react';
import { Modal, LoadingOverlay, IconButton } from './ui';
import { fetchRecentPrintLogs, fetchRecentPrintLogsForRecipient, fetchRecentPrintLogsForDate, getPrintPdfPublicUrl, type PrintLogRow } from '@/lib/printLogs';

const METHOD_LABEL: Record<PrintLogRow['method'], string> = {
  print: '인쇄 요청',
  pdf: 'PDF 저장',
  share: '공유 요청',
  save: 'PDF 저장',
};
const METHOD_ICON: Record<PrintLogRow['method'], typeof IconPrinter> = {
  print: IconPrinter,
  pdf: IconFileDownload,
  share: IconShare2,
  save: IconCloudCheck,
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PrintHistorySheet({
  open,
  onClose,
  recipientId,
  recipientName,
  dateKey,
  dateLabel,
}: {
  open: boolean;
  onClose: () => void;
  recipientId?: string;
  recipientName?: string;
  // 캘린더에서 특정 날짜의 출력 기록 점을 눌렀을 때: 그 날짜(YYYY-MM-DD)만 필터링해서 보여준다.
  dateKey?: string;
  dateLabel?: string;
}) {
  const [logs, setLogs] = useState<PrintLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const openPdf = async (path: string) => {
    const scope = captureAccountStorage();
    // Open synchronously to retain the user gesture for popup blockers.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await getPrintPdfPublicUrl(path);
      if (!scope.isCurrent()) throw new Error('Account changed');
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    } catch {
      tab?.close();
      alert('저장된 PDF를 열 수 없습니다. 로그인과 파일 접근 권한을 확인해주세요.');
    }
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fetchLogs = recipientId
      ? fetchRecentPrintLogsForRecipient(recipientId, 20)
      : dateKey
        ? fetchRecentPrintLogsForDate(dateKey, 20)
        : fetchRecentPrintLogs(20);
    fetchLogs
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [open, recipientId, dateKey]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="px-5 sm:px-6 pt-2 pb-[calc(var(--app-safe-bottom)+1.5rem)] flex flex-col">
        <div className="flex items-center gap-2 pb-3">
          <IconHistory size={18} className="text-foreground/60" />
          <h3 className="text-[16px] font-black text-foreground tracking-tight">
            {recipientName ? `${recipientName} 어르신 출력 이력` : dateLabel ? `${dateLabel} 출력 이력` : '최근 출력 이력'}
          </h3>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-foreground/70">문서 작업을 수행한 날짜 기준입니다. 인쇄·공유 요청은 실제 출력·전달 완료를 뜻하지 않으며, 서버에 보관된 PDF만 다시 열 수 있습니다.</p>
        <div className="relative min-w-0 -mx-1 px-1">
          {loading && <LoadingOverlay />}
          {logs.length === 0 && !loading ? (
            <p className="text-[13px] font-bold text-foreground/40 py-6 text-center">
              {recipientId ? '이 어르신의 출력 이력이 없습니다' : dateKey ? '이 날짜에는 출력 이력이 없습니다' : '출력 이력이 없습니다'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {logs.map((log) => {
                const Icon = METHOD_ICON[log.method];
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-muted/60">
                    <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0 border border-surface-border/50">
                      <Icon size={16} className="text-foreground/60" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-foreground truncate">
                        {recipientId && recipientName ? recipientName : log.recipient_name}
                        {log.batch_count && log.batch_count > 1 ? ` 외 ${log.batch_count - 1}명 (일괄)` : ''}
                      </p>
                      <p className="text-[11px] font-bold text-foreground/45">
                        {METHOD_LABEL[log.method]}{log.method === 'save' ? (log.pdf_path ? ' · 서버 보관됨' : ' · 서버 보관 확인 안 됨') : ''} · {formatDateTime(log.created_at)}
                        {log.author_name ? ` · ${log.author_name}` : ''}
                      </p>
                    </div>
                    {log.pdf_path && (
                      <IconButton
                        onClick={() => void openPdf(log.pdf_path as string)}
                        className="w-8 h-8 rounded-full bg-surface text-foreground/60 hover:bg-surface-border/60 border border-surface-border/50 shrink-0"
                        aria-label="저장된 PDF 다시 열기"
                      >
                        <IconExternalLink size={14} />
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
