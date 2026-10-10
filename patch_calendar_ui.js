const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add Import
const importTarget = `import ScheduleAddModal from '@/components/ScheduleAddModal';`;
if (!page.includes('MonthCalendar')) {
  page = page.replace(importTarget, importTarget + `\nimport MonthCalendar from '@/components/MonthCalendar';`);
}

// 2. Replace UI
const startMarker = `{/* Horizontal Calendar Scroller */}`;
const endMarker = `{scheduleRoute.length === 0 ? (`;

const startIndex = page.indexOf(startMarker);
const endIndex = page.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newUI = `{/* Month Grid Calendar */}
            <MonthCalendar 
              selectedDate={scheduleDate} 
              onSelectDate={setScheduleDate} 
              hasSchedule={(d) => markers.some(r => getScheduledForDate(r, d))}
            />

            `;
  page = page.slice(0, startIndex) + newUI + page.slice(endIndex);
  fs.writeFileSync('src/app/page.tsx', page);
  console.log("Successfully patched Calendar UI.");
} else {
  console.log("Could not find markers.", startIndex, endIndex);
}
