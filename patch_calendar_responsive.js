const fs = require('fs');

// 1. Update page.tsx to select Today by default
let pageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');
pageCode = pageCode.replace('const [scheduleDate, setScheduleDate] = useState<Date | null>(null);', 'const [scheduleDate, setScheduleDate] = useState<Date | null>(new Date());');
fs.writeFileSync('src/app/page.tsx', pageCode);

// 2. Update MonthCalendar.tsx to be responsive and stretch
let calCode = fs.readFileSync('src/components/MonthCalendar.tsx', 'utf-8');

// Container
const oldContainer = `className="bg-surface rounded-[24px] shadow-sm border border-surface-border p-4 mb-4"`;
const newContainer = `className="bg-surface rounded-[24px] shadow-sm border border-surface-border p-3 mb-4 flex-1 flex flex-col min-h-[350px]"`;
calCode = calCode.replace(oldContainer, newContainer);

// Grid container
const oldGrid = `className="grid grid-cols-7 gap-y-2 gap-x-1"`;
const newGrid = `className="grid grid-cols-7 gap-y-1 gap-x-1 flex-1"`;
calCode = calCode.replace(oldGrid, newGrid);

// Empty slot
const oldEmpty = `className="h-10"`;
const newEmpty = `className="h-full min-h-[3rem]"`;
calCode = calCode.replace(oldEmpty, newEmpty);

// Day button
const oldButton = `className={\`relative h-10 flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95`;
const newButton = `className={\`relative h-full min-h-[3rem] w-full flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95`;
calCode = calCode.replace(oldButton, newButton);

fs.writeFileSync('src/components/MonthCalendar.tsx', calCode);
console.log("Patched Calendar Responsive UI");
