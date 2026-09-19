import re

path = "src/components/RecipientModal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add visitDate state
state_search = "const [visitTime, setVisitTime] = useState('');"
state_replace = "const [visitTime, setVisitTime] = useState('');\n  const [visitDate, setVisitDate] = useState('');"
content = content.replace(state_search, state_replace)

# Initialize visitDate
init_search = """setBcode(recipientToEdit.dong);
        setVisitTime(recipientToEdit.visit_time.substring(0, 5));"""
init_replace = """setBcode(recipientToEdit.dong);
        setVisitTime(recipientToEdit.visit_time.substring(0, 5));
        setVisitDate(recipientToEdit.notes || '');"""
content = content.replace(init_search, init_replace)

reset_search = """setBcode('');
        setVisitTime('');"""
reset_replace = """setBcode('');
        setVisitTime('');
        setVisitDate('');"""
content = content.replace(reset_search, reset_replace)

# Validate visitDate
val_search = "if (!name || !address || !bcode || !visitTime) {"
val_replace = "if (!name || !address || !bcode || !visitDate || !visitTime) {"
content = content.replace(val_search, val_replace)

# Save visitDate to notes
save_search = "visit_time: visitTime + ':00'"
save_replace = "visit_time: visitTime + ':00',\n        notes: visitDate"
content = content.replace(save_search, save_replace)

# Add Date input to form
form_search = """<TextField
            label="방문 예정 시간"
            type="time"
            variant="outlined"
            fullWidth
            required
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />"""
form_replace = """<Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="방문 예정 일자"
              type="date"
              variant="outlined"
              fullWidth
              required
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={isSubmitting}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="방문 예정 시간"
              type="time"
              variant="outlined"
              fullWidth
              required
              value={visitTime}
              onChange={(e) => setVisitTime(e.target.value)}
              disabled={isSubmitting}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>"""
content = content.replace(form_search, form_replace)

# Also update the Recipient interface in the modal
interface_search = "visit_time: string;"
interface_replace = "visit_time: string;\n  notes?: string | null;"
content = content.replace(interface_search, interface_replace)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modal date updated")
