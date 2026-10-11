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
  const [isOnCurrentDate, setIsOnCurrentDate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ymd = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (recipient) {
      const parsed = parseVisitTime(recipient.visit_time, recipient.notes);
      setVisitTime(parsed.startTime);
      setVisitEndTime(parsed.endTime);
      // 기존에 해당 날짜가 명시적으로 등록되어 있거나 신규 일정 지정 시 기본 true
      const cleanDates = extractNotesWithoutTime(recipient.notes);
      const hasDate = cleanDates ? cleanDates.includes(ymd) : false;
      setIsOnCurrentDate(hasDate || true);
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

      const { error } = await supabase.from('recipients').update({
        visit_time: finalTime,
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

  const setTimePreset = (start: string, end: string) => {
    setVisitTime(start);
    setVisitEndTime(end);
  };

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">{recipient.name} 어르신 일정</h2>
          <p className="text-xs font-semibold text-foreground/50 mt-0.5">방문 예정 시간을 설정하고 일정을 관리하세요.</p>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-6 space-y-5">
        {/* Specific Date Confirmation Pill (기본 선택된 옵션) */}
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-[24px] border border-primary/10 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[18px] bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconCalendarEvent size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-foreground text-sm">선택한 날짜에 방문</p>
                <span className="text-[10px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-2xs">
                  기본 선택
                </span>
              </div>
              <p className="text-xs text-foreground/50 mt-0.5">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월 {currentDate.getDate()}일 방문 일정에 포함합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOnCurrentDate(!isOnCurrentDate)}
            className={`w-13 h-7 rounded-full transition-colors relative p-1 ${isOnCurrentDate ? 'bg-primary' : 'bg-surface-border'}`}
            title="일정 포함 여부"
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`w-5 h-5 rounded-full bg-white shadow-md ${isOnCurrentDate ? 'ml-auto' : 'mr-auto'}`}
            />
          </button>
        </div>

        {/* Visit Time Range Card - Enhanced UI */}
        <div className="bg-foreground/[0.03] dark:bg-white/[0.03] p-4.5 rounded-[24px] border border-surface-border/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-bold text-foreground/70 uppercase tracking-wider">방문 예정 시간 범위</span>
            {(visitTime || visitEndTime) && (
              <button
                type="button"
                onClick={() => { setVisitTime(''); setVisitEndTime(''); }}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
              >
                시간 초기화
              </button>
            )}
          </div>

          {/* Quick Preset Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { label: '오전 (09:00~11:00)', start: '09:00', end: '11:00' },
              { label: '점심 (11:30~13:30)', start: '11:30', end: '13:30' },
              { label: '오후 (14:00~16:00)', start: '14:00', end: '16:00' },
              { label: '저녁 (16:30~18:30)', start: '16:30', end: '18:30' },
            ].map(preset => {
              const active = visitTime === preset.start && visitEndTime === preset.end;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTimePreset(preset.start, preset.end)}
                  className={`text-[11px] font-black px-2.5 py-1.5 rounded-full border transition-all whitespace-nowrap active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-surface text-foreground/70 border-surface-border/60 hover:bg-surface-muted'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Time Picker Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <span className="block text-[11px] font-bold text-foreground/50 mb-1 pl-1">시작 시간</span>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                  <IconClock size={16} />
                </div>
                <input
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full pl-9 pr-2 py-3 bg-surface border border-surface-border/80 rounded-[18px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-center text-foreground/40 shrink-0 pt-5 px-0.5">
              <span className="font-black text-sm">~</span>
            </div>

            <div className="flex-1">
              <span className="block text-[11px] font-bold text-foreground/50 mb-1 pl-1">종료 시간</span>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                  <IconClock size={16} />
                </div>
                <input
                  type="time"
                  value={visitEndTime}
                  onChange={(e) => setVisitEndTime(e.target.value)}
                  className="w-full pl-9 pr-2 py-3 bg-surface border border-surface-border/80 rounded-[18px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground font-bold text-sm"
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-foreground/[0.02] dark:bg-white/[0.02] rounded-[16px] border border-surface-border/30">
            <p className="text-[11px] text-foreground/60 font-semibold leading-relaxed">
              {visitTime && visitEndTime
                ? `⏰ ${visitTime}부터 ${visitEndTime}까지 방문 예정입니다.`
                : visitTime
                ? `⏰ ${visitTime}에 방문 예정입니다.`
                : '💡 시간을 지정하지 않으면 타임라인에서 직접 순서를 드래그/이동하여 정렬할 수 있습니다.'}
            </p>
          </div>
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
