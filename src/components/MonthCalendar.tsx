import React, { useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconCalendarEvent } from '@tabler/icons-react';
import { motion } from 'motion/react';

interface MonthCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  hasSchedule?: (date: Date) => boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MonthCalendar({ selectedDate, onSelectDate, hasSchedule }: MonthCalendarProps) {
  const initialDate = selectedDate || new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

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
    <div className="bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.06)] border border-white/20 dark:border-white/10 p-4 mb-4 flex-1 flex flex-col min-h-[360px] transition-all">
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
        
        {/* Today Action Pill */}
        <motion.button 
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            onSelectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
          }}
          className="px-3.5 py-2 rounded-full bg-primary/10 hover:bg-primary/15 text-primary font-black text-xs transition-colors flex items-center gap-1.5 border border-primary/20 shadow-xs"
        >
          <IconCalendarEvent size={15} />
          <span>오늘</span>
        </motion.button>
      </div>

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
      <div className="grid grid-cols-7 gap-1.5 flex-1 items-stretch">
        {days.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} className="h-full min-h-[3rem]" />;
          
          const selected = isSelected(d);
          const today = isToday(d);
          const dateObj = new Date(year, month, d);
          const scheduled = hasSchedule ? hasSchedule(dateObj) : false;
          const isSunday = new Date(year, month, d).getDay() === 0;
          const isSaturday = new Date(year, month, d).getDay() === 6;

          return (
            <motion.button
              key={d}
              whileTap={{ scale: 0.90 }}
              transition={{ type: 'spring', damping: 25, stiffness: 450 }}
              onClick={() => handleSelect(d)}
              className={`relative h-full min-h-[3.2rem] w-full flex flex-col items-center justify-center rounded-[20px] transition-all
                ${selected 
                  ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(var(--primary),0.35)] font-black scale-[1.04] z-10' 
                  : today 
                    ? 'bg-primary/10 text-primary font-black border border-primary/30 shadow-xs' 
                    : `hover:bg-foreground/[0.04] font-bold ${
                        isSunday ? 'text-red-500/90' : isSaturday ? 'text-blue-500/90' : 'text-foreground/80'
                      }`
                }`
              }
            >
              <span className="text-[15px] tracking-tight">{d}</span>
              {/* Glowing Indicator Dot for Scheduled Visits */}
              {scheduled && !selected && (
                <div className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(var(--accent),0.8)]" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
