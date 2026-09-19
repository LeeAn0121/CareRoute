import re

layout_path = "src/app/layout.tsx"
with open(layout_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import ThemeRegistry
content = content.replace("import \"./globals.css\";", "import \"./globals.css\";\nimport ThemeRegistry from './ThemeRegistry';")

# Add Pretendard CDN
head_tag_search = "</head>"
head_tag_replace = """  <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  </head>"""
content = content.replace(head_tag_search, head_tag_replace)

# Wrap children with ThemeRegistry
body_search = "{children}"
body_replace = "<ThemeRegistry>{children}</ThemeRegistry>"
content = content.replace(body_search, body_replace)

# Modify class name for body to use font-pretendard if we want, but MUI CssBaseline handles it
content = content.replace("className={`${geistSans.variable} ${geistMono.variable} antialiased`}", "className=\"antialiased\"")

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(content)

