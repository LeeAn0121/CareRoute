import React, { useState, useEffect } from 'react';
import { Modal, IconButton } from '@/components/ui';
import { IconX, IconCheck, IconCalendarEvent, IconClock } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { motion } from 'motion/react';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recipient: any;
  currentDate: Date;
  onSuccess: () => void;
}

export default function ScheduleManageModal({ isOpen, onClose, recipient, currentDate, onSuccess }: Props) {
  const [visitTime, setVisitTime] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [isOnCurrentDate, setIsOnCurrentDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ymd = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (recipient) {
      setVisitTime(recipient.visit_time && recipient.visit_time !== '00:00:00' ? recipient.visit_time.substring(0, 5) : '');
      setRecurringDays(recipient.recurring_weekdays ? recipient.recurring_weekdays.split(',').map(Number) : []);
      setIsOnCurrentDate(recipient.notes && recipient.notes.includes(ymd));
    }
  }, [recipient, currentDate]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let newNotes = recipient.notes || '';
      const existingDates = newNotes ? newNotes.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      if (isOnCurrentDate && !existingDates.includes(ymd)) {
        existingDates.push(ymd);
      } else if (!isOnCurrentDate && existingDates.includes(ymd)) {
        const idx = existingDates.indexOf(ymd);
        if (idx > -1) existingDates.splice(idx, 1);
      }

      const finalNotes = existingDates.join(',');
      const finalTime = visitTime ? `${visitTime}:00` : '00:00:00';
      const finalRecurring = recurringDays.length > 0 ? [...recurringDays].sort().join(',') : null;

      const { error } = await supabase.from('recipients').update({
        visit_time: finalTime,
        recurring_weekdays: finalRecurring,
        notes: finalNotes || null
      }).eq('id', recipient.id);

      if (error) throw error;
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('일정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-surface-border">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">{recipient.name} 어르신 일정</h2>
          <p className="text-sm font-semibold text-foreground/50">방문 시간 및 요일을 설정하세요.</p>
        </div>
        <IconButton onClick={onClose} className="bg-surface-muted hover:bg-surface-border">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-5 space-y-6">
        {/* Specific Date Toggle */}
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <IconCalendarEvent size={20} />
            </div>
            <div>
              <p className="font-bold text-foreground">선택한 날짜에 방문</p>
              <p className="text-xs text-foreground/50">{currentDate.getMonth() + 1}월 {currentDate.getDate()}일 일정에 포함합니다.</p>
            </div>
          </div>
          <button
            onClick={() => setIsOnCurrentDate(!isOnCurrentDate)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isOnCurrentDate ? 'bg-primary' : 'bg-surface-border'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isOnCurrentDate ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Recurring Days */}
        <div>
          <span className="block text-sm font-bold text-foreground/70 mb-2">매주 반복 방문 (선택)</span>
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => {
              const active = recurringDays.includes(day);
              return (
                <motion.button
                  key={day}
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  disabled={isSubmitting}
                  onClick={() => {
                    setRecurringDays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                    );
                  }}
                  animate={{
                    backgroundColor: active ? 'var(--accent)' : 'var(--color-surface-muted)',
                    color: active ? 'var(--primary)' : 'var(--color-foreground)',
                  }}
                  transition={{ duration: 0.15 }}
                  className="w-10 h-10 flex-1 rounded-xl text-sm font-bold border border-surface-border/50"
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
          {recurringDays.length > 0 && (
            <p className="text-xs text-foreground/50 mt-2">매주 {recurringDays.slice().sort().map((d) => WEEKDAY_LABELS[d]).join(', ')}요일마다 자동으로 일정에 추가됩니다.</p>
          )}
        </div>

        {/* Visit Time */}
        <div>
          <span className="block text-sm font-bold text-foreground/70 mb-2">방문 예정 시간 (선택)</span>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">
              <IconClock size={18} />
            </div>
            <input
              type="time"
              value={visitTime}
              onChange={(e) => setVisitTime(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-border rounded-xl outline-none focus:border-primary transition-colors text-foreground font-bold"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : '일정 저장하기'}
        </button>
      </div>
    </Modal>
  );
}
