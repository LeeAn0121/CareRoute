import re

path = "src/app/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("PaperProps={{ sx: { borderTopLeftRadius: 32, borderTopRightRadius: 32, p: 3, pb: 14 } }}", "sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 32, borderTopRightRadius: 32, p: 3, pb: 14 } }}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

