'use client';

import { useEffect, useState } from 'react';
import { NavermapsProvider } from 'react-naver-maps';
import { ThemeProvider } from 'next-themes';
import { installNativeSharing } from '@/lib/native';

const navermapsOptions = {
  ncpKeyId: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || 'f9sp6e02ix',
  submodules: ['geocoder'],
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    installNativeSharing();
    const reportFailure = () => window.dispatchEvent(new Event('careroute:map-error'));
    const globals = window as Window & { navermap_authFailure?: () => void; careRouteNaverReady?: () => void };
    const previousAuthFailure = globals.navermap_authFailure;
    const previousReady = globals.careRouteNaverReady;
    globals.navermap_authFailure = reportFailure;
    // The SDK sets jsContentLoaded only when its completion callback exists.
    // Without callback=..., polling that flag before mounting the map deadlocks.
    globals.careRouteNaverReady = () => window.dispatchEvent(new Event('careroute:map-ready'));
    let script = document.querySelector<HTMLScriptElement>('script[data-careroute-map]');
    if (!script && !window.naver?.maps?.Map) {
      script = document.createElement('script');
      script.dataset.carerouteMap = 'true';
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(navermapsOptions.ncpKeyId)}&submodules=geocoder&callback=careRouteNaverReady`;
      script.async = true;
      document.head.appendChild(script);
    }
    script?.addEventListener('error', reportFailure);
    // Load saved color theme
    const savedColorTheme = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    document.documentElement.classList.add(savedColorTheme);
    setMounted(true);
    return () => {
      script?.removeEventListener('error', reportFailure);
      globals.navermap_authFailure = previousAuthFailure;
      globals.careRouteNaverReady = previousReady;
    };
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
