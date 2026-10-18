'use client';

import { useEffect, useState } from 'react';
import { IconHistory, IconPrinter, IconFileDownload, IconShare2, IconCloudCheck, IconExternalLink } from '@tabler/icons-react';
import { Modal, LoadingOverlay, IconButton } from './ui';
import { fetchRecentPrintLogs, fetchRecentPrintLogsForRecipient, fetchRecentPrintLogsForDate, getPrintPdfPublicUrl, type PrintLogRow } from '@/lib/printLogs';

const METHOD_LABEL: Record<PrintLogRow['method'], string> = {
  print: '인쇄',
  pdf: 'PDF 저장',
  share: '공유',
  save: '저장(서버 보관)',
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
      <div className="px-5 sm:px-6 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] max-h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 pb-3">
          <IconHistory size={18} className="text-foreground/60" />
          <h3 className="text-[16px] font-black text-foreground tracking-tight">
            {recipientName ? `${recipientName} 어르신 출력 이력` : dateLabel ? `${dateLabel} 출력 이력` : '최근 출력 이력'}
          </h3>
        </div>
        <div className="relative flex-1 overflow-y-auto -mx-1 px-1 min-h-[160px]">
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
                        {METHOD_LABEL[log.method]} · {formatDateTime(log.created_at)}
                        {log.author_name ? ` · ${log.author_name}` : ''}
                      </p>
                    </div>
                    {log.pdf_path && (
                      <IconButton
                        onClick={() => window.open(getPrintPdfPublicUrl(log.pdf_path as string), '_blank')}
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
