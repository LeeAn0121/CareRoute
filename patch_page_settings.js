const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

code = code.replace(
  '<SettingsView onReplayTutorial={() => {',
  '<SettingsView \n          onSyncCalendar={handleSyncToCalendar}\n          isSyncingCalendar={isSyncingCalendar}\n          onReplayTutorial={() => {'
);

fs.writeFileSync('src/app/page.tsx', code);
