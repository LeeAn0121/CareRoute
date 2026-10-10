const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const stateMarker = `const [completingRecipient, setCompletingRecipient] = useState<Recipient | null>(null);`;
if(!page.includes('const [scheduleDate, setScheduleDate] = useState(new Date());')) {
    page = page.replace(stateMarker, stateMarker + `\n  const [scheduleDate, setScheduleDate] = useState(new Date());\n  const [isScheduleAddOpen, setIsScheduleAddOpen] = useState(false);`);
}

const oldLogic = `  const isScheduledToday = (r: Recipient) => {
    const now = new Date();
    const ymd = todayYMD();
    if (r.notes === ymd) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(now.getDay());
    }
    return false;
  };`;

const newLogic = `  const getScheduledForDate = (r: Recipient, date: Date) => {
    const ymd = \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`;
    if (r.notes && r.notes.includes(ymd)) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(date.getDay());
    }
    return false;
  };`;

page = page.replace(oldLogic, newLogic);

const oldRouteMemoStart = `  const todayRoute = useMemo(() => {
    const todays = markers.filter(isScheduledToday);`;
const newRouteMemoStart = `  const scheduleRoute = useMemo(() => {
    const todays = markers.filter(r => getScheduledForDate(r, scheduleDate));`;

page = page.replace(oldRouteMemoStart, newRouteMemoStart);

const oldRouteMemoEnd = `    return route;
  }, [markers, mapCenter]);`;
const newRouteMemoEnd = `    return route;
  }, [markers, mapCenter, scheduleDate]);`;

page = page.replace(oldRouteMemoEnd, newRouteMemoEnd);

fs.writeFileSync('src/app/page.tsx', page);
console.log("Patched schedule logic!");
