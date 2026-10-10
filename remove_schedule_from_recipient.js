const fs = require('fs');
let code = fs.readFileSync('src/components/RecipientModal.tsx', 'utf-8');

const targetToRemoveStart = `<p className="text-[13px] font-black text-primary/80 tracking-tight">방문 일정</p>`;
const targetToRemoveEnd = `              ) : null}
            />
          </div>

          <div className="h-px bg-surface-muted" />`;

const startIndex = code.indexOf(targetToRemoveStart);
const endIndex = code.indexOf(targetToRemoveEnd) + targetToRemoveEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  // We need to also remove the enclosing div if necessary, or just the block.
  // Actually, I'll use regex or string replace.
  const blockToReplace = code.substring(startIndex, endIndex);
  code = code.replace(blockToReplace, '');
} else {
  console.log("Could not find the block");
}

const targetDivStart = `          <div className="flex flex-col gap-3">
            
          </div>

          <div className="h-px bg-surface-muted" />`;
code = code.replace(targetDivStart, '');

const state1 = `const [visitTime, setVisitTime] = useState('');`;
const state2 = `const [recurringDays, setRecurringDays] = useState<number[]>([]);`;
code = code.replace(state1, '');
code = code.replace(state2, '');

const init1 = `setVisitTime(recipientToEdit.visit_time || '');`;
const init2 = `setRecurringDays(recipientToEdit.recurring_weekdays ? recipientToEdit.recurring_weekdays.split(',').map(Number) : []);`;
code = code.replace(init1, '');
code = code.replace(init2, '');

const reset1 = `setVisitTime('');`;
const reset2 = `setRecurringDays([]);`;
code = code.replace(reset1, '');
code = code.replace(reset2, '');

const submit1 = `visit_time: visitTime,`;
const submit2 = `recurring_weekdays: recurringDays.length > 0 ? [...recurringDays].sort().join(',') : null,`;
// If we don't submit them, they will be set to undefined/null or not updated.
// Wait, we SHOULD preserve them if they are not being edited here!
// We should change submit payload to preserve existing values!
const newSubmit1 = `visit_time: recipientToEdit?.visit_time || null,`;
const newSubmit2 = `recurring_weekdays: recipientToEdit?.recurring_weekdays || null,`;
code = code.replace(submit1, newSubmit1);
code = code.replace(submit2, newSubmit2);

fs.writeFileSync('src/components/RecipientModal.tsx', code);
console.log("Removed schedule fields from RecipientModal");
