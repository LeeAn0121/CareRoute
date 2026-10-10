const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf-8');

const targetStr = `{/* Appearance Settings */}`;
const newSettingBlock = `{/* Sync Section */}
        <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-[13px] font-black text-primary/80 uppercase tracking-wider mb-2 pl-2">데이터 동기화</h2>
          <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
            <button 
              onClick={onSyncCalendar}
              disabled={isSyncingCalendar}
              className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <IconRefresh size={18} className="text-blue-500" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-[16px] tracking-tight block">구글 캘린더 동기화</span>
                  <span className="text-[12px] text-foreground/50">선택한 날짜의 일정을 구글 캘린더로 내보냅니다</span>
                </div>
              </div>
              {isSyncingCalendar ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <IconChevronRight size={20} className="text-foreground/30" />
              )}
            </button>
          </div>
        </section>

        {/* Appearance Settings */}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newSettingBlock);
  fs.writeFileSync('src/components/SettingsView.tsx', code);
  console.log("Injected Sync Section");
} else {
  console.log("Could not find Appearance Settings");
}
