const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldLogic = `            {!scheduleDate ? (
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

const newLogic = `            {scheduleDate && (
              scheduleRoute.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16 animate-fade-in-up">
                  <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                    <IconCalendarEvent size={32} className="text-slate-300" />
                  </div>
                  <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                  <p className="text-sm text-foreground/40">우측 하단 + 버튼을 눌러 어르신을 추가하세요.</p>
                </div>
              ) : (`;

code = code.replace(oldLogic, newLogic);

// We also need to close the wrapping `{scheduleDate && (` block.
// The list ends around line 1913
// Let's find exactly where the `)` was for the ternary, and change it to close the conditional AND the ternary (or just rewrite it).

fs.writeFileSync('src/app/page.tsx', code);
