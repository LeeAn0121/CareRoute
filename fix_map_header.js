const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetHeader = `<div id="tour-header" className="flex w-full items-start gap-3">`;
const fixedHeader = `<div id="tour-header" className="flex w-full items-start gap-3 pr-[52px]">`; // 12 (w-12) + gap-3 ? Actually, the button is absolute at right-4. So padding right 52px is enough to avoid overlap.

code = code.replace(targetHeader, fixedHeader);
fs.writeFileSync('src/app/page.tsx', code);
