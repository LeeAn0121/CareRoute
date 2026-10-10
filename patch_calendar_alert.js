const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetLogic = `      // 같은 날짜로 이미 동기화한 이벤트가 있으면 지우고 새로 만들어서
      // 여러 번 눌러도 중복 생성되지 않게 한다.
      const existingRes = await fetch(
        \`https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=\${encodeURIComponent(\`careRouteDate=\${ymd}\`)}\`,
        { headers: authHeaders },
      );
      const existing = await existingRes.json();
      for (const ev of existing.items || []) {
        await fetch(\`https://www.googleapis.com/calendar/v3/calendars/primary/events/\${ev.id}\`, {
          method: 'DELETE',
          headers: authHeaders,
        });
      }`;

const newLogic = `      // 이미 동기화한 이벤트가 있는지 확인합니다.
      const existingRes = await fetch(
        \`https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=\${encodeURIComponent(\`careRouteDate=\${ymd}\`)}\`,
        { headers: authHeaders },
      );
      const existing = await existingRes.json();
      
      // 이미 일정이 존재할 경우 사용자에게 알림을 띄우고 처리 방식을 결정합니다.
      if (existing.items && existing.items.length > 0) {
        const wantsOverwrite = window.confirm('해당 날짜에 이미 동기화된 구글 캘린더 일정이 존재합니다.\\n기존 일정을 삭제하고 최신 일정으로 덮어쓰시겠습니까?\\n(취소를 누르면 중복으로 추가하지 않고 작업을 중단합니다.)');
        
        if (!wantsOverwrite) {
          setIsSyncingCalendar(false);
          return; // 사용자가 취소하면 중단 (중복 방지)
        }

        // 덮어쓰기에 동의한 경우에만 기존 이벤트 삭제 진행
        for (const ev of existing.items) {
          await fetch(\`https://www.googleapis.com/calendar/v3/calendars/primary/events/\${ev.id}\`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        }
      }`;

code = code.replace(targetLogic, newLogic);
fs.writeFileSync('src/app/page.tsx', code);
console.log("Patched duplicate calendar sync alert");
