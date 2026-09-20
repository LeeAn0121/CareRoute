import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeRegistry from './ThemeRegistry';
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#12203D',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "CareRoute",
  description: "어르신 방문 요양 경로 안내 서비스",
  manifest: "/CareRoute/manifest.json",
  icons: {
    icon: [
      { url: "/CareRoute/favicon.svg", type: "image/svg+xml" },
      { url: "/CareRoute/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/CareRoute/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/CareRoute/favicon.ico",
    apple: "/CareRoute/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "케어루트",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="referrer" content="origin" />
        
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  </head>
      <body className="min-h-full flex flex-col bg-gray-50" suppressHydrationWarning>
        <Providers>
          <ThemeRegistry>{children}</ThemeRegistry>
        </Providers>
      </body>
    </html>
  );
}
