import React, { useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface MonthCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  // If we want to show dots for scheduled days, we can pass a function or array
  hasSchedule?: (date: Date) => boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MonthCalendar({ selectedDate, onSelectDate, hasSchedule }: MonthCalendarProps) {
  // Start with the month of the selected date
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
  // Empty slots for previous month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Days of current month
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
    <div className="bg-surface rounded-[24px] shadow-sm border border-surface-border p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors active:scale-95">
            <IconChevronLeft size={20} className="text-foreground/70" />
          </button>
          
          <div className="relative">
            <input 
              type="month"
              value={`${year}-${String(month + 1).padStart(2, '0')}`}
              onChange={(e) => {
                if(e.target.value) {
                  const [y, m] = e.target.value.split('-');
                  setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
            <h2 className="text-[17px] font-black tracking-tight text-primary px-2 cursor-pointer hover:opacity-80">
              {year}년 {month + 1}월
            </h2>
          </div>

          <button onClick={nextMonth} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors active:scale-95">
            <IconChevronRight size={20} className="text-foreground/70" />
          </button>
        </div>
        
        <button 
          onClick={() => {
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            onSelectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
          }}
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-sm active:scale-95 hover:bg-primary/20 transition-colors"
        >
          오늘
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day, i) => (
          <div key={day} className={`text-center text-[11px] font-bold ${i === 0 ? 'text-red-500/80' : i === 6 ? 'text-blue-500/80' : 'text-foreground/50'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-2 gap-x-1">
        {days.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} className="h-10" />;
          
          const selected = isSelected(d);
          const today = isToday(d);
          const dateObj = new Date(year, month, d);
          const scheduled = hasSchedule ? hasSchedule(dateObj) : false;
          const isSunday = new Date(year, month, d).getDay() === 0;

          return (
            <button
              key={d}
              onClick={() => handleSelect(d)}
              className={`relative h-10 flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95
                ${selected 
                  ? 'bg-primary text-white shadow-md shadow-primary/20 font-black' 
                  : today 
                    ? 'bg-primary/10 text-primary font-black border border-primary/20' 
                    : `hover:bg-surface-muted font-bold ${isSunday ? 'text-red-500/90' : 'text-foreground/80'}`
                }`
              }
            >
              <span className="text-[15px]">{d}</span>
              {/* Schedule Indicator Dot */}
              {scheduled && !selected && (
                <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
