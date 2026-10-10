const fs = require('fs');
let code = fs.readFileSync('src/components/RecipientModal.tsx', 'utf-8');

const targetInput = `            <TextField
              label="방문 예정일 (선택)"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={isSubmitting}
              endAdornment={visitDate ? (
                <IconButton onClick={() => setVisitDate('')} aria-label="방문 예정일 지우기">
                  <IconX size={16} />
                </IconButton>
              ) : null}
            />`;

code = code.replace(targetInput, '');

const submitLogicOld = `notes: visitDate,`;
const submitLogicNew = `notes: recipientToEdit?.notes || null, // Preserve existing specific dates`;
code = code.replace(submitLogicOld, submitLogicNew);

fs.writeFileSync('src/components/RecipientModal.tsx', code);
