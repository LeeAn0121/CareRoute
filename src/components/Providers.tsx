'use client';

import { useEffect, useState } from 'react';
import { NavermapsProvider } from 'react-naver-maps';
import { ThemeProvider, useTheme } from 'next-themes';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { CareRouteDevice, installNativeSharing } from '@/lib/native';

const navermapsOptions = {
  ncpKeyId: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || 'f9sp6e02ix',
  submodules: ['geocoder'],
};

function NativeSystemBarTheme() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !resolvedTheme) return;
    let active = true;
    const dark = resolvedTheme === 'dark';
    void CareRouteDevice.setWindowBackground({ dark })
      .then(() => { if (active) return SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }); })
      .catch(() => { console.warn('시스템 표시줄 스타일을 적용하지 못했습니다.'); });
    return () => { active = false; };
  }, [resolvedTheme]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout>;
    const keepFieldVisible = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const field = document.activeElement;
        if (!(field instanceof HTMLElement) || !field.matches('input, textarea, select')) return;
        const modal = field.closest<HTMLElement>('.modal-scroll-area');
        if (!modal) return;
        const bounds = modal.getBoundingClientRect();
        const rect = field.getBoundingClientRect();
        const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
        const footer = modal.querySelector<HTMLElement>('.sticky.bottom-0');
        const footerHeight = footer && getComputedStyle(footer).position === 'sticky' ? footer.getBoundingClientRect().height : 0;
        const visibleTop = Math.max(bounds.top, window.visualViewport?.offsetTop ?? 0) + 72;
        const visibleBottom = Math.min(bounds.bottom, viewportBottom) - footerHeight - 16;
        if (rect.top < visibleTop || rect.bottom > visibleBottom) {
          const targetTop = visibleTop + Math.max(0, (visibleBottom - visibleTop - rect.height) / 2);
          modal.scrollBy({ top: rect.top - targetTop, behavior: 'smooth' });
        }
      }, 180);
    };
    document.addEventListener('focusin', keepFieldVisible);
    window.addEventListener('resize', keepFieldVisible);
    window.visualViewport?.addEventListener('resize', keepFieldVisible);
    return () => {
      clearTimeout(pending);
      document.removeEventListener('focusin', keepFieldVisible);
      window.removeEventListener('resize', keepFieldVisible);
      window.visualViewport?.removeEventListener('resize', keepFieldVisible);
    };
  }, []);

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
    document.documentElement.classList.toggle('large-font-mode', localStorage.getItem('careroute_large_font') === 'true');
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
      <NativeSystemBarTheme />
      <NavermapsProvider {...navermapsOptions}>
        {children}
      </NavermapsProvider>
    </ThemeProvider>
  );
}
