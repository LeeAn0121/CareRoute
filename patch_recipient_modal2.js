const fs = require('fs');
let code = fs.readFileSync('src/components/RecipientModal.tsx', 'utf-8');

code = code.replace('const [visitTime, setVisitTime] = useState(\'\');', '');
code = code.replace('const [recurringDays, setRecurringDays] = useState<number[]>([]);', '');
code = code.replace('setVisitTime(recipientToEdit.visit_time || \'\');', '');
code = code.replace('setRecurringDays(recipientToEdit.recurring_weekdays ? recipientToEdit.recurring_weekdays.split(\',\').map(Number) : []);', '');
code = code.replace('setVisitTime(\'\');', '');
code = code.replace('setRecurringDays([]);', '');

code = code.replace('visit_time: visitTime,', 'visit_time: recipientToEdit?.visit_time || null,');
code = code.replace('recurring_weekdays: recurringDays.length > 0 ? [...recurringDays].sort().join(\',\') : null,', 'recurring_weekdays: recipientToEdit?.recurring_weekdays || null,');

fs.writeFileSync('src/components/RecipientModal.tsx', code);
