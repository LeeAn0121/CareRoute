import React, { useState, useEffect } from 'react';
import { Modal, IconButton } from '@/components/ui';
import { IconX, IconCheck, IconCalendarEvent, IconClock, IconArrowRight } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { motion } from 'motion/react';
import { parseVisitTime, composeNotesWithTime, extractNotesWithoutTime } from '@/lib/visitTime';

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
  const [visitEndTime, setVisitEndTime] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [isOnCurrentDate, setIsOnCurrentDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ymd = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (recipient) {
      const parsed = parseVisitTime(recipient.visit_time, recipient.notes);
      setVisitTime(parsed.startTime);
      setVisitEndTime(parsed.endTime);
      setRecurringDays(recipient.recurring_weekdays ? recipient.recurring_weekdays.split(',').map(Number) : []);
      setIsOnCurrentDate(recipient.notes && recipient.notes.includes(ymd));
    }
  }, [recipient, currentDate]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const cleanDates = extractNotesWithoutTime(recipient.notes);
      const existingDates = cleanDates ? cleanDates.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      if (isOnCurrentDate && !existingDates.includes(ymd)) {
        existingDates.push(ymd);
      } else if (!isOnCurrentDate && existingDates.includes(ymd)) {
        const idx = existingDates.indexOf(ymd);
        if (idx > -1) existingDates.splice(idx, 1);
      }

      const finalNotes = composeNotesWithTime(existingDates.join(','), visitTime, visitEndTime);
      const finalTime = visitTime ? `${visitTime}:00` : '00:00:00';
      const finalRecurring = recurringDays.length > 0 ? [...recurringDays].sort().join(',') : null;

      const { error } = await supabase.from('recipients').update({
        visit_time: finalTime,
        recurring_weekdays: finalRecurring,
        notes: finalNotes
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
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">{recipient.name} 어르신 일정</h2>
          <p className="text-xs font-semibold text-foreground/50 mt-0.5">방문 시간 및 요일을 설정하세요.</p>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-6 space-y-6">
        {/* Specific Date Toggle */}
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-[24px] border border-primary/10 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[18px] bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconCalendarEvent size={22} />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">선택한 날짜에 방문</p>
              <p className="text-xs text-foreground/50">{currentDate.getMonth() + 1}월 {currentDate.getDate()}일 일정에 포함합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOnCurrentDate(!isOnCurrentDate)}
            className={`w-13 h-7 rounded-full transition-colors relative p-1 ${isOnCurrentDate ? 'bg-primary' : 'bg-surface-border'}`}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`w-5 h-5 rounded-full bg-white shadow-md ${isOnCurrentDate ? 'ml-auto' : 'mr-auto'}`}
            />
          </button>
        </div>

        {/* Recurring Days */}
        <div className="bg-foreground/[0.03] dark:bg-white/[0.03] p-4.5 rounded-[24px] border border-surface-border/40 space-y-3">
          <span className="block text-xs font-bold text-foreground/70 uppercase tracking-wider">매주 반복 방문 (선택)</span>
          <div className="flex gap-2">
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
                  className={`flex-1 h-11 rounded-[18px] text-sm font-bold border transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-surface text-foreground border-surface-border/60 hover:bg-surface-muted'
                  }`}
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
          {recurringDays.length > 0 && (
            <p className="text-xs text-foreground/50 font-medium">매주 {recurringDays.slice().sort().map((d) => WEEKDAY_LABELS[d]).join(', ')}요일마다 자동으로 일정에 추가됩니다.</p>
          )}
        </div>

        {/* Visit Time Range */}
        <div className="bg-foreground/[0.03] dark:bg-white/[0.03] p-4.5 rounded-[24px] border border-surface-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-bold text-foreground/70 uppercase tracking-wider">방문 예정 시간 범위 (선택)</span>
            {(visitTime || visitEndTime) && (
              <button
                type="button"
                onClick={() => { setVisitTime(''); setVisitEndTime(''); }}
                className="text-[11px] font-bold text-foreground/40 hover:text-rose-500 transition-colors"
              >
                시간 초기화
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                <IconClock size={17} />
              </div>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full pl-10 pr-2 py-3 bg-surface border border-surface-border/80 rounded-[18px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground font-bold text-sm"
              />
            </div>

            <div className="flex items-center justify-center text-foreground/40 shrink-0 px-1">
              <span className="font-black text-sm">~</span>
            </div>

            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                <IconClock size={17} />
              </div>
              <input
                type="time"
                value={visitEndTime}
                onChange={(e) => setVisitEndTime(e.target.value)}
                className="w-full pl-10 pr-2 py-3 bg-surface border border-surface-border/80 rounded-[18px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground font-bold text-sm"
              />
            </div>
          </div>

          <p className="text-[11px] text-foreground/50 font-medium">
            {visitTime && visitEndTime
              ? `${visitTime}부터 ${visitEndTime}까지 방문 예정입니다.`
              : visitTime
              ? `${visitTime}에 방문 예정입니다.`
              : '시간을 설정하지 않으면 순서가 유동적으로 자동 정렬됩니다.'}
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={isSubmitting}
          className="w-full py-4 rounded-[22px] bg-primary text-primary-foreground font-black text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : '일정 저장하기'}
        </motion.button>
      </div>
    </Modal>
  );
}
