import re

layout_path = "src/app/layout.tsx"
with open(layout_path, "r", encoding="utf-8") as f:
    content = f.read()

old_meta = """export const metadata: Metadata = {
  title: "CareRoute",
  description: "어르신 방문 요양 서비스",
  manifest: "/CareRoute/manifest.json",
  themeColor: "#0d9488",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "케어루트",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover",
};"""

new_meta = """import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d9488',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "CareRoute",
  description: "어르신 방문 요양 경로 안내 서비스",
  manifest: "/CareRoute/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "케어루트",
  },
};"""

content = re.sub(r"export const metadata: Metadata = \{.*?\};", new_meta, content, flags=re.DOTALL)

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(content)

