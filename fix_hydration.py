import re

path = "src/app/layout.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("<html\n      lang=\"ko\"", "<html\n      lang=\"ko\"\n      suppressHydrationWarning")
content = content.replace("<body className=\"min-h-full flex flex-col bg-gray-50\">", "<body className=\"min-h-full flex flex-col bg-gray-50\" suppressHydrationWarning>")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Hydration fixed")
