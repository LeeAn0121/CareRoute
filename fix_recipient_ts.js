const fs = require('fs');
let code = fs.readFileSync('src/components/RecipientModal.tsx', 'utf-8');

code = code.replace(/setVisitTime\([^\)]*\);/g, '');
code = code.replace(/visit_time: visitTime/g, 'visit_time: recipientToEdit?.visit_time || null');

fs.writeFileSync('src/components/RecipientModal.tsx', code);
