const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetMenuBtn = `          {/* Top-Right User Menu / Settings Button */}
          <button 
            id="tour-user-menu"
            onClick={() => setActiveTab('settings')}
            className="pointer-events-auto flex-shrink-0 w-12 h-12 flex items-center justify-center bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 hover:bg-foreground/[0.04] transition-all active:scale-90"
          >
            <IconMenu2 size={24} className="text-foreground/80" strokeWidth={2.5} />
          </button>`;

code = code.replace(targetMenuBtn, '');

// Insert it as a global floating button, but only if activeTab !== 'settings'
const globalMenuBtn = `      {/* Global Top-Right User Menu Button */}
      {activeTab !== 'settings' && (
        <button 
          id="tour-user-menu"
          onClick={() => setActiveTab('settings')}
          className="absolute top-[calc(env(safe-area-inset-top,0px)+12px)] right-4 z-50 flex-shrink-0 w-12 h-12 flex items-center justify-center bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 hover:bg-foreground/[0.04] transition-all active:scale-90 animate-fade-in-down"
        >
          <IconMenu2 size={24} className="text-foreground/80" strokeWidth={2.5} />
        </button>
      )}`;

// We should inject this right before the `activeTab === 'map'` floating header block.
const insertTarget = `      {/* iOS / One UI 6 Styled Floating Header */}`;
code = code.replace(insertTarget, globalMenuBtn + '\n\n' + insertTarget);

fs.writeFileSync('src/app/page.tsx', code);
