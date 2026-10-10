const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetBtn = `              <Button
                variant="ghost"
                loading={isSyncingCalendar}
                onClick={handleSyncToCalendar}
                className="py-2 text-sm whitespace-nowrap"
              >
                구글 캘린더 동기화
              </Button>`;

code = code.replace(targetBtn, '');
fs.writeFileSync('src/app/page.tsx', code);
