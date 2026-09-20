'use client';

import { useEffect, useState } from 'react';
import { NavermapsProvider, preloadNavermaps } from 'react-naver-maps';
import { ThemeProvider } from 'next-themes';

const navermapsOptions = {
  ncpKeyId: 'f9sp6e02ix',
  submodules: ['geocoder'],
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    preloadNavermaps(navermapsOptions);
    // Load saved color theme
    const savedColorTheme = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    document.documentElement.classList.add(savedColorTheme);
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NavermapsProvider {...navermapsOptions}>
        {children}
      </NavermapsProvider>
    </ThemeProvider>
  );
}
