'use client';

import { useEffect, useState } from 'react';
import { IconPill, IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal, IconButton, Button, LoadingOverlay } from './ui';
import { fetchMedicationsForRecipient, addMedication, deleteMedication, type MedicationRow } from '@/lib/medications';

export default function MedicationModal({
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
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [timesOfDay, setTimesOfDay] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchMedicationsForRecipient(recipientId)
      .then(setMeds)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    reload();
    setDrugName('');
    setDose('');
    setTimesOfDay('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipientId]);

  const handleAdd = async () => {
    if (!drugName.trim()) return;
    setIsSaving(true);
    const ok = await addMedication({
      recipientId,
      drugName: drugName.trim(),
      dose: dose.trim() || null,
      timesOfDay: timesOfDay.trim() || null,
    });
    setIsSaving(false);
    if (ok) {
      setDrugName('');
      setDose('');
      setTimesOfDay('');
      reload();
    } else {
      alert('약 등록에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 복약 항목을 삭제하시겠습니까?')) return;
    const ok = await deleteMedication(id);
    if (ok) setMeds((prev) => prev.filter((m) => m.id !== id));
    else alert('삭제에 실패했습니다. 다시 시도해주세요.');
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[14px] bg-primary/10 text-primary flex items-center justify-center">
            <IconPill size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">복약 시간표</h2>
            <p className="text-xs font-semibold text-foreground/50">{recipientName} 어르신</p>
          </div>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
        {/* 등록 폼 */}
        <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-4 rounded-[22px] border border-surface-border/40 flex flex-col gap-2.5">
          <input
            type="text"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder="약 이름 (예: 혈압약)"
            className="w-full p-3 bg-surface border border-surface-border/60 rounded-[16px] text-[14px] font-bold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-foreground/35"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="용량 (선택, 예: 1정)"
              className="flex-1 p-3 bg-surface border border-surface-border/60 rounded-[16px] text-[14px] font-bold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-foreground/35"
            />
            <input
              type="text"
              value={timesOfDay}
              onChange={(e) => setTimesOfDay(e.target.value)}
              placeholder="시간 (선택, 예: 08:00,20:00)"
              className="flex-1 p-3 bg-surface border border-surface-border/60 rounded-[16px] text-[14px] font-bold outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-foreground/35"
            />
          </div>
          <Button type="button" onClick={handleAdd} loading={isSaving} disabled={!drugName.trim()} startIcon={<IconPlus size={16} />} className="py-2.5 rounded-[16px] font-black text-[13px]">
            복약 항목 추가
          </Button>
        </div>

        {/* 목록 */}
        <div className="relative min-h-[80px]">
          {loading && <LoadingOverlay />}
          {!loading && meds.length === 0 ? (
            <p className="text-[13px] font-bold text-foreground/40 text-center py-6">등록된 복약 항목이 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {meds.map((med) => (
                <div key={med.id} className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black text-foreground truncate">
                      {med.drug_name}
                      {med.dose ? ` · ${med.dose}` : ''}
                    </p>
                    {med.times_of_day && (
                      <p className="text-[12px] font-bold text-foreground/50">{med.times_of_day.split(',').join(' / ')}</p>
                    )}
                  </div>
                  <IconButton
                    onClick={() => handleDelete(med.id)}
                    className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 shrink-0"
                    aria-label="삭제"
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
