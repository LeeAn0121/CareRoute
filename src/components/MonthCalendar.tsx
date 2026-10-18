import React, { useState, useEffect } from 'react';
import { IconChevronLeft, IconChevronRight, IconCalendarEvent, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoadingOverlay } from './ui';
import { fetchPrintedDateKeysInRange } from '@/lib/printLogs';

interface MonthCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  hasSchedule?: (date: Date) => boolean;
  // true면 달력이 보여주는 달에 한해 출력 기록이 있는 날짜에 점을 표시한다(자체적으로 조회).
  showPrintHistory?: boolean;
  // 출력 기록 점을 눌렀을 때: 날짜 선택(onSelectDate)과 별개로 그 날짜의 출력 이력을 바로 열람하게 한다.
  onPrintedDateClick?: (dateKey: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MonthCalendar({ selectedDate, onSelectDate, hasSchedule, showPrintHistory, onPrintedDateClick }: MonthCalendarProps) {
  const initialDate = selectedDate || new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [printedDateKeys, setPrintedDateKeys] = useState<Set<string>>(new Set());
  const [loadingPrintHistory, setLoadingPrintHistory] = useState(false);

  // 화면에 보이는 달이 바뀔 때마다 그 달의 출력 기록 날짜만 다시 불러온다.
  useEffect(() => {
    if (!showPrintHistory) return;
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const startKey = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(y, m + 1, 1);
    const endKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    let cancelled = false;
    setLoadingPrintHistory(true);
    fetchPrintedDateKeysInRange(startKey, endKey).then((keys) => {
      if (!cancelled) {
        setPrintedDateKeys(keys);
        setLoadingPrintHistory(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showPrintHistory, currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelect = (day: number) => {
    onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isToday = (d: number) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  return (
    <div className="bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-[28px] shadow-[0_12px_32px_rgba(0,0,0,0.05)] border border-white/20 dark:border-white/10 p-3.5 mb-3 shrink-0 transition-all">
      {/* One UI 9.0 Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        {/* Month Selector Capsule */}
        <div className="flex items-center bg-foreground/[0.04] dark:bg-white/[0.06] rounded-full p-1 border border-surface-border/40 shadow-xs">
          <motion.button 
            whileTap={{ scale: 0.88 }}
            onClick={prevMonth} 
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/[0.06] transition-colors"
            aria-label="이전 달"
          >
            <IconChevronLeft size={18} className="text-foreground/80" />
          </motion.button>
          
          <div className="relative px-2">
            <input 
              type="month"
              value={`${year}-${String(month + 1).padStart(2, '0')}`}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m] = e.target.value.split('-');
                  setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              title="월 변경"
            />
            <span className="text-[16px] font-black tracking-tight text-foreground flex items-center gap-1 cursor-pointer select-none">
              {year}년 {month + 1}월
            </span>
          </div>

          <motion.button 
            whileTap={{ scale: 0.88 }}
            onClick={nextMonth} 
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/[0.06] transition-colors"
            aria-label="다음 달"
          >
            <IconChevronRight size={18} className="text-foreground/80" />
          </motion.button>
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Today Action Pill */}
          <motion.button 
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              const today = new Date();
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
            }}
            className="px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/15 text-primary font-black text-xs transition-colors flex items-center gap-1 border border-primary/20 shadow-xs"
          >
            <IconCalendarEvent size={14} />
            <span>오늘</span>
          </motion.button>

          {/* Collapse/Expand Toggle Button */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground/60 transition-colors"
            title={isCollapsed ? '달력 펼치기' : '달력 접기'}
            aria-label={isCollapsed ? '달력 펼치기' : '달력 접기'}
          >
            {isCollapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Weekdays Bar */}
            <div className="grid grid-cols-7 mb-2 text-center">
              {WEEKDAYS.map((day, i) => (
                <div 
                  key={day} 
                  className={`py-1 text-[12px] font-black tracking-tight ${
                    i === 0 ? 'text-red-500/90' : i === 6 ? 'text-blue-500/90' : 'text-foreground/50'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* One UI Days Grid with Squircle Pebbles */}
            <div className="relative grid grid-cols-7 gap-1">
              {showPrintHistory && loadingPrintHistory && <LoadingOverlay label="" />}
              {days.map((d, i) => {
                if (d === null) return <div key={`empty-${i}`} className="aspect-square max-h-[42px]" />;

                const selected = isSelected(d);
                const today = isToday(d);
                const dateObj = new Date(year, month, d);
                const scheduled = hasSchedule ? hasSchedule(dateObj) : false;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const printed = Boolean(showPrintHistory) && printedDateKeys.has(dateKey);
                const isSunday = new Date(year, month, d).getDay() === 0;
                const isSaturday = new Date(year, month, d).getDay() === 6;

                return (
                  <motion.button
                    key={d}
                    whileTap={{ scale: 0.90 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 450 }}
                    onClick={() => handleSelect(d)}
                    className={`relative aspect-square max-h-[42px] w-full flex flex-col items-center justify-center rounded-[16px] transition-all
                      ${selected
                        ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(var(--primary),0.35)] font-black scale-[1.05] z-10'
                        : today
                          ? 'bg-primary/10 text-primary font-black border border-primary/30 shadow-xs'
                          : `hover:bg-foreground/[0.04] font-bold ${
                              isSunday ? 'text-red-500/90' : isSaturday ? 'text-blue-500/90' : 'text-foreground/80'
                            }`
                      }`
                    }
                  >
                    <span className="text-[14px] tracking-tight">{d}</span>
                    {/* Glowing Indicator Dot for Scheduled Visits */}
                    {scheduled && !selected && (
                      <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(var(--accent),0.8)]" />
                    )}
                    {/* 해당 날짜에 출력/공유 기록이 있음을 표시하는 작은 점. 날짜 선택(상위 버튼)과는
                        별개로 누르면 그 날짜의 출력 이력을 바로 열어볼 수 있다. 선택된(primary 배경)
                        칸에서도 묻히지 않게 색을 바꿔 항상 보이게 한다. */}
                    {printed && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="이 날짜 출력 이력 보기"
                        title="이 날짜에 출력 기록이 있습니다 · 눌러서 보기"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrintedDateClick?.(dateKey);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            onPrintedDateClick?.(dateKey);
                          }
                        }}
                        className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center cursor-pointer"
                      >
                        <span className={`w-[5px] h-[5px] rounded-full ${selected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
