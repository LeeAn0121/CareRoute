const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldCompleted = `const isCompletedToday = (r: Recipient) => r.last_completed_key === todayYMD();`;
const newCompleted = `const isCompletedForDate = (r: Recipient, date: Date) => {
    const ymd = \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`;
    return r.last_completed_key === ymd;
  };
  const isCompletedToday = (r: Recipient) => r.last_completed_key === todayYMD();`;

page = page.replace(oldCompleted, newCompleted);
fs.writeFileSync('src/app/page.tsx', page);
console.log("Patched completed logic");
