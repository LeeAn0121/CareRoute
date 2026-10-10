const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetStr = `          onSuccess={() => {
            fetchMarkers(); // refresh data
            setIsScheduleAddOpen(false);
          }}
        />`;

const newStr = `          onSuccess={() => {
            fetchMarkers();
            setIsScheduleAddOpen(false);
          }}
          onSelectRecipient={(r) => {
            setManagingScheduleRecipient(r);
          }}
        />`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/app/page.tsx', code);
