'use client';

import { useEffect, useState } from 'react';
import { IconActivity } from '@tabler/icons-react';
import { Modal, LoadingOverlay } from './ui';
import { fetchRecentVitalsForRecipient, type VitalsLogRow } from '@/lib/vitalsLogs';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function VitalsHistorySheet({
  open,
  onClose,
  recipientId,
  recipientName,
}: {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
}) {
  const [logs, setLogs] = useState<VitalsLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchRecentVitalsForRecipient(recipientId, 30)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [open, recipientId]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="px-5 sm:px-6 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] max-h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 pb-3">
          <IconActivity size={18} className="text-foreground/60" />
          <h3 className="text-[16px] font-black text-foreground tracking-tight">{recipientName} 어르신 활력징후 추이</h3>
        </div>
        <div className="relative flex-1 overflow-y-auto -mx-1 px-1 min-h-[160px]">
          {loading && <LoadingOverlay />}
          {logs.length === 0 && !loading ? (
            <p className="text-[13px] font-bold text-foreground/40 py-6 text-center">기록된 활력징후가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {logs.map((log) => (
                <div key={log.id} className="p-3 rounded-[16px] bg-surface-muted/60">
                  <p className="text-[11px] font-bold text-foreground/45 mb-1">{formatDateTime(log.recorded_at)}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] font-black text-foreground">
                    {(log.systolic_bp != null || log.diastolic_bp != null) && (
                      <span>혈압 {log.systolic_bp ?? '-'}/{log.diastolic_bp ?? '-'} <span className="text-[11px] font-bold text-foreground/40">mmHg</span></span>
                    )}
                    {log.blood_sugar != null && (
                      <span>혈당 {log.blood_sugar} <span className="text-[11px] font-bold text-foreground/40">mg/dL</span></span>
                    )}
                    {log.temperature != null && (
                      <span>체온 {log.temperature} <span className="text-[11px] font-bold text-foreground/40">℃</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
