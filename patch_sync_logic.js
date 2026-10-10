const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldLogic = `  const handleSyncToCalendar = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    if (scheduleRoute.length === 0) {
      alert('선택한 날짜에 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.');
      return;
    }

    setIsSyncingCalendar(true);
    try {
      await loadGoogleScript();`;

const newLogic = `  const handleSyncToCalendar = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    
    let targetRoute = scheduleRoute;
    let syncDate = scheduleDate;
    
    if (!syncDate) {
      syncDate = new Date();
      targetRoute = markers.filter(r => getScheduledForDate(r, syncDate));
    }
    
    if (targetRoute.length === 0) {
      alert(scheduleDate ? '선택한 날짜에 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.' : '오늘 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.');
      return;
    }

    setIsSyncingCalendar(true);
    try {
      await loadGoogleScript();`;

code = code.replace(oldLogic, newLogic);

// Then replace `scheduleRoute` with `targetRoute` inside the sync function
const oldLoop = `for (const marker of scheduleRoute) {`;
const newLoop = `for (const marker of targetRoute) {`;
code = code.replace(oldLoop, newLoop);

const oldYmd = `const ymd = todayYMD();`;
const newYmd = `const ymd = \`\${syncDate.getFullYear()}-\${String(syncDate.getMonth() + 1).padStart(2, '0')}-\${String(syncDate.getDate()).padStart(2, '0')}\`;`;
code = code.replace(oldYmd, newYmd);

const oldAlert = `alert(\`오늘의 경로 \${scheduleRoute.length}건을 구글 캘린더에 동기화했습니다.\`);`;
const newAlert = `alert(\`\${syncDate.getMonth()+1}월 \${syncDate.getDate()}일 방문 일정 \${targetRoute.length}건을 구글 캘린더에 동기화했습니다.\`);`;
code = code.replace(oldAlert, newAlert);

fs.writeFileSync('src/app/page.tsx', code);
