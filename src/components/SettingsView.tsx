import React, { useState, useEffect } from 'react';
import { IconPalette, IconHelp, IconShieldLock, IconChevronRight, IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, IconBug, IconRefresh } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion } from 'motion/react';

interface SettingsViewProps {
  onReplayTutorial: () => void;
  onBack: () => void;
}

const colorThemes = [
  { id: 'theme-navy', name: '블랙/화이트', color: 'bg-[#1C1C1E] dark:bg-white' },
  { id: 'theme-blue', name: '블루', color: 'bg-[#007AFF]' },
  { id: 'theme-emerald', name: '에메랄드', color: 'bg-[#34C759]' },
  { id: 'theme-rose', name: '로즈', color: 'bg-[#FF2D55]' },
  { id: 'theme-purple', name: '퍼플', color: 'bg-[#AF52DE]' },
  { id: 'theme-teal', name: '틸', color: 'bg-[#32ADE6]' },
];

export default function SettingsView({ onReplayTutorial, onBack }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifPerm, setNotifPerm] = useState('확인 중...');

  useEffect(() => {
    setMounted(true);
    const current = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    setColorTheme(current);

    if ('Notification' in window) setNotifPerm(Notification.permission);
    else setNotifPerm('지원 안 함');

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setLocationPerm(result.state);
        result.onchange = () => setLocationPerm(result.state);
      });
    } else {
      setLocationPerm('지원 안 함');
    }
  }, []);

  const handleColorThemeChange = (newTheme: string) => {
    document.documentElement.classList.remove(colorTheme);
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('careroute_color_theme', newTheme);
    setColorTheme(newTheme);
  };

  const translatePerm = (status: string) => {
    if (status === 'granted') return <span className="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-md text-xs">허용됨</span>;
    if (status === 'denied') return <span className="text-red-500 font-bold bg-red-500/10 px-2.5 py-1 rounded-md text-xs">거부됨</span>;
    if (status === 'prompt' || status === 'default') return <span className="text-foreground/50 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">요청 전</span>;
    return <span className="text-foreground/50 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">{status}</span>;
  };

  if (!mounted) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-surface-muted/50 supports-[backdrop-filter]:bg-surface-muted/30 backdrop-blur-[40px] saturate-200 text-foreground transition-colors duration-500"
    >
      <div className="flex items-center gap-4 mb-8 px-2">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 className="text-[34px] font-black tracking-tighter text-foreground">메뉴</h2>
      </div>

      <div className="space-y-8">
        {/* Appearance Settings */}
        {/* Appearance Settings */}
        <section>
          <div className="px-4 mb-2">
            <span className="text-[13px] font-bold text-foreground/50 uppercase tracking-wider">화면 및 테마</span>
          </div>
          
          <div className="bg-surface/80 supports-[backdrop-filter]:bg-surface/50 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/50 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-surface-border/50">
              <p className="text-[14px] font-bold text-foreground/70 mb-3">모드 설정</p>
              <div className="flex p-1 bg-foreground/[0.04] rounded-[18px]">
                {[
                  { id: 'light', label: '라이트', icon: <IconSun size={18} /> },
                  { id: 'dark', label: '다크', icon: <IconMoonStars size={18} /> },
                  { id: 'system', label: '시스템', icon: <IconDeviceDesktop size={18} /> },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 py-2.5 rounded-[14px] font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all ${
                      theme === t.id 
                        ? 'bg-surface text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.08)]' 
                        : 'text-foreground/50 hover:text-foreground/80'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              <p className="text-[14px] font-bold text-foreground/70 mb-3">테마 컬러</p>
              <div className="grid grid-cols-3 gap-3">
                {colorThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleColorThemeChange(t.id)}
                    className={`relative flex flex-col items-center justify-center py-4 rounded-[20px] transition-all gap-2 ${
                      colorTheme === t.id ? 'bg-primary/10 ring-2 ring-primary ring-inset' : 'bg-foreground/[0.02] hover:bg-foreground/[0.06]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full shadow-md border-2 border-white/20 ${t.color}`} />
                    <span className={`text-[13px] font-bold ${colorTheme === t.id ? 'text-primary' : 'text-foreground/70'}`}>
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Permissions */}
        <section>
          <div className="px-4 mb-2 mt-6">
            <span className="text-[13px] font-bold text-foreground/50 uppercase tracking-wider">개인정보 및 권한</span>
          </div>
          <div className="bg-surface/80 supports-[backdrop-filter]:bg-surface/50 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-surface-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><IconShieldLock size={18}/></div>
                <span className="font-bold text-[16px] tracking-tight">위치 정보</span>
              </div>
              {translatePerm(locationPerm)}
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500"><IconShieldLock size={18}/></div>
                <span className="font-bold text-[16px] tracking-tight">알림</span>
              </div>
              {translatePerm(notifPerm)}
            </div>
          </div>
        </section>

        {/* App Info & Github */}
        <section>
          <div className="px-4 mb-2 mt-6">
            <span className="text-[13px] font-bold text-foreground/50 uppercase tracking-wider">앱 정보 및 고객센터</span>
          </div>
          
          <div className="bg-surface/80 supports-[backdrop-filter]:bg-surface/50 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/50 overflow-hidden flex flex-col">
            <a
              href="https://github.com/LeeAn0121/CareRoute/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-foreground/[0.04] transition-colors border-b border-surface-border/50 active:bg-foreground/[0.08]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-foreground flex items-center justify-center text-surface"><IconBrandGithub size={18} /></div>
                <div className="flex flex-col">
                  <span className="font-bold text-[16px] tracking-tight">버전 정보 (v1.0.0)</span>
                  <span className="text-[12px] text-foreground/50 font-bold">업데이트 노트 확인</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full">최신 버전</span>
                <IconChevronRight size={18} className="text-foreground/30" />
              </div>
            </a>
            
            <a
              href="https://github.com/LeeAn0121/CareRoute/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-foreground/[0.04] transition-colors border-b border-surface-border/50 active:bg-foreground/[0.08]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-red-500/10 flex items-center justify-center text-red-500"><IconBug size={18} /></div>
                <span className="font-bold text-[16px] tracking-tight">버그 제보 및 기능 제안</span>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </a>
            
            <button
              onClick={onReplayTutorial}
              className="w-full flex items-center justify-between p-4 hover:bg-foreground/[0.04] transition-colors active:bg-foreground/[0.08] border-b border-surface-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-primary/10 flex items-center justify-center text-primary"><IconHelp size={18} /></div>
                <span className="font-bold text-[16px] tracking-tight">앱 사용 가이드 다시 보기</span>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </button>

            <button
              onClick={async () => {
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(key => caches.delete(key)));
                }
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (let reg of regs) {
                    await reg.unregister();
                  }
                }
                try { localStorage.removeItem('careroute_pwa_install_dismissed'); } catch {}
                window.location.href = window.location.pathname + '?t=' + Date.now();
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-red-500/10 transition-colors active:bg-red-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-red-500/10 flex items-center justify-center text-red-500"><IconRefresh size={18} /></div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-[16px] tracking-tight text-red-500">앱 데이터 초기화 및 강력 새로고침</span>
                  <span className="text-[12px] text-foreground/50 font-bold">지도 화면 등에서 오류가 발생할 때 사용</span>
                </div>
              </div>
            </button>

          </div>
        </section>

        
      </div>
    </motion.div>
  );
}
