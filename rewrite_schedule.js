const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add `scheduleDate` state
const stateMarker = `const [completingRecipient, setCompletingRecipient] = useState<Recipient | null>(null);`;
page = page.replace(stateMarker, stateMarker + `\n  const [scheduleDate, setScheduleDate] = useState(new Date());`);

// 2. Replace `isScheduledToday` and `todayRoute` with `getScheduledForDate` and `scheduleRoute`
const oldLogic = /const isScheduledToday = \[\s\S]*?return false;\s*\};\s*\/\/ 오늘의 경로:[\s\S]*?return route;\s*\}, \[markers\]\);/;

// Wait, doing regex for a huge block is dangerous. Let's find exact indices.
