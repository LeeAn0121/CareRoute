import re

path = "src/components/RecipientModal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix Dialog PaperProps
content = content.replace("PaperProps={{ sx: { borderRadius: 4, p: 1 } }}", "sx={{ '& .MuiDialog-paper': { borderRadius: 4, p: 1 } }}")

# Fix Typography fontWeight
content = content.replace("fontWeight={800}", "sx={{ fontWeight: 800 }}")

# Fix TextField InputProps
content = re.sub(r"InputProps=\{\{ sx: \{ borderRadius: 3(?:, bgcolor: '#f8fafc')? \} \}\}", "", content)
content = content.replace("InputLabelProps={{ shrink: true }}", "slotProps={{ inputLabel: { shrink: true } }}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modal fixed")
