const fs = require('fs');
let code = fs.readFileSync('src/components/MonthCalendar.tsx', 'utf-8');

// Add "Today" button and Native Month Picker logic
const headerOld = `      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={prevMonth} className="p-2 hover:bg-surface-muted rounded-xl transition-colors active:scale-95">
          <IconChevronLeft size={20} className="text-foreground/70" />
        </button>
        <h2 className="text-[17px] font-black tracking-tight text-primary">
          {year}년 {month + 1}월
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-surface-muted rounded-xl transition-colors active:scale-95">
          <IconChevronRight size={20} className="text-foreground/70" />
        </button>
      </div>`;

const headerNew = `      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors active:scale-95">
            <IconChevronLeft size={20} className="text-foreground/70" />
          </button>
          
          <div className="relative">
            <input 
              type="month"
              value={\`\${year}-\${String(month + 1).padStart(2, '0')}\`}
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
      </div>`;

code = code.replace(headerOld, headerNew);
fs.writeFileSync('src/components/MonthCalendar.tsx', code);
