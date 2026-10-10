const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Change state initialization
code = code.replace(
  'const [scheduleDate, setScheduleDate] = useState(new Date());',
  'const [scheduleDate, setScheduleDate] = useState<Date | null>(null);'
);

// 2. Change getScheduledForDate so it doesn't crash if date is null
// Actually it's only called when we iterate.
const oldMemo = `  const scheduleRoute = useMemo(() => {
    const todays = markers.filter(r => getScheduledForDate(r, scheduleDate));`;
const newMemo = `  const scheduleRoute = useMemo(() => {
    if (!scheduleDate) return [];
    const todays = markers.filter(r => getScheduledForDate(r, scheduleDate));`;
code = code.replace(oldMemo, newMemo);

// 3. Fix the Route UI
const oldRouteHeader = `              <div>
                <p className="text-lg font-black text-primary">
                  {scheduleDate.toDateString() === new Date().toDateString() ? '오늘의 ' : \`\${scheduleDate.getMonth() + 1}월 \${scheduleDate.getDate()}일 \`}
                  방문 일정
                </p>
                <p className="text-sm text-foreground/50 font-semibold">
                  총 {scheduleRoute.length}곳 방문 예정
                </p>
              </div>`;

const newRouteHeader = `              {scheduleDate && (
                <div>
                  <p className="text-lg font-black text-primary">
                    {scheduleDate.toDateString() === new Date().toDateString() ? '오늘의 ' : \`\${scheduleDate.getMonth() + 1}월 \${scheduleDate.getDate()}일 \`}
                    방문 일정
                  </p>
                  <p className="text-sm text-foreground/50 font-semibold">
                    총 {scheduleRoute.length}곳 방문 예정
                  </p>
                </div>
              )}`;
code = code.replace(oldRouteHeader, newRouteHeader);

// 4. Fix Empty State UI
const oldEmptyState = `            {scheduleRoute.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconCalendarEvent size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                <p className="text-sm text-foreground/40">우측 하단 + 버튼을 눌러 어르신을 추가하세요.</p>
              </div>
            ) : (`;

const newEmptyState = `            {!scheduleDate ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16 animate-fade-in-up">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconCalendarEvent size={32} className="text-primary/20" />
                </div>
                <p className="font-bold text-lg text-foreground/60 mb-1">달력에서 날짜를 선택해주세요.</p>
                <p className="text-sm text-foreground/40">해당 날짜의 방문 일정을 확인하고 관리할 수 있습니다.</p>
              </div>
            ) : scheduleRoute.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16 animate-fade-in-up">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconCalendarEvent size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                <p className="text-sm text-foreground/40">우측 하단 + 버튼을 눌러 어르신을 추가하세요.</p>
              </div>
            ) : (`;
code = code.replace(oldEmptyState, newEmptyState);

// 5. Hide the FAB if scheduleDate is null
const oldFab = `            <button
              onClick={() => setIsScheduleAddOpen(true)}
              className="fixed bottom-[100px] right-5 z-40 w-[60px] h-[60px] flex items-center justify-center rounded-[24px] shadow-[0_16px_32px_rgba(var(--primary),0.35)] bg-primary text-primary-foreground border border-white/20 transition-transform active:scale-90 backdrop-blur-[40px] saturate-200"
            >`;

const newFab = `            {scheduleDate && (
              <button
                onClick={() => setIsScheduleAddOpen(true)}
                className="fixed bottom-[100px] right-5 z-40 w-[60px] h-[60px] flex items-center justify-center rounded-[24px] shadow-[0_16px_32px_rgba(var(--primary),0.35)] bg-primary text-primary-foreground border border-white/20 transition-transform active:scale-90 backdrop-blur-[40px] saturate-200 animate-fade-in-up"
              >
                <IconPlus size={32} strokeWidth={2.5} />
              </button>
            )}`;
code = code.replace(oldFab, newFab);

fs.writeFileSync('src/app/page.tsx', code);
console.log("Patched scheduleDate initialization and UI");
