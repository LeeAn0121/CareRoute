const fs = require('fs');
const page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const startIndex = page.indexOf("{activeTab === 'route' && (");
const endIndex = page.indexOf("{activeTab === 'settings' && (");
console.log(startIndex, endIndex);
fs.writeFileSync('route_tab_backup.tsx', page.slice(startIndex, endIndex));
