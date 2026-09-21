import React, { useState, useEffect } from 'react';
import { IconPalette, IconHelp, IconShieldLock, IconChevronRight, IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, IconBug } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion } from 'motion/react';

interface SettingsViewProps {
  onReplayTutorial: () => void;
}

const colorThemes = [
  { id: 'theme-navy', name: '블랙/화이트', color: 'bg-[#1C1C1E] dark:bg-white' },
  { id: 'theme-blue', name: '블루', color: 'bg-[#007AFF]' },
  { id: 'theme-emerald', name: '에메랄드', color: 'bg-[#34C759]' },
  { id: 'theme-rose', name: '로즈', color: 'bg-[#FF2D55]' },
  { id: 'theme-purple', name: '퍼플', color: 'bg-[#AF52DE]' },
  { id: 'theme-teal', name: '틸', color: 'bg-[#32ADE6]' },
];

export default function SettingsView({ onReplayTutorial }: SettingsViewProps) {
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
      className="absolute inset-0 overflow-y-auto px-5 pt-16 pb-32 bg-background/80 backdrop-blur-3xl text-foreground transition-colors duration-500"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-primary">설정</h2>
        <p className="text-[15px] font-semibold text-foreground/50 mt-1">앱 환경을 내 취향에 맞게 꾸며보세요.</p>
      </div>

      <div className="space-y-8">
        {/* Appearance Settings */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <IconPalette size={20} className="text-primary" />
            <h3 className="font-bold text-lg text-foreground/80">화면 및 테마</h3>
          </div>
          
          <div className="bg-surface rounded-2xl shadow-sm border border-surface-border p-5 space-y-6">
            <div>
              <p className="text-sm font-bold text-foreground/60 mb-3">모드 설정</p>
              <div className="flex p-1 bg-surface-muted rounded-xl">
                {[
                  { id: 'light', label: '라이트', icon: <IconSun size={18} /> },
                  { id: 'dark', label: '다크', icon: <IconMoonStars size={18} /> },
                  { id: 'system', label: '시스템', icon: <IconDeviceDesktop size={18} /> },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                      theme === t.id 
                        ? 'bg-surface text-primary shadow-sm' 
                        : 'text-foreground/50 hover:text-foreground/80'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-foreground/60 mb-3">전체 시스템 테마 컬러</p>
              <div className="grid grid-cols-3 gap-3">
                {colorThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleColorThemeChange(t.id)}
                    className={`relative flex flex-col items-center justify-center py-4 rounded-xl border-2 transition-all gap-2 ${
                      colorTheme === t.id ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-surface-muted'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full shadow-md border-2 border-white/50 ${t.color}`} />
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
          <div className="flex items-center gap-2.5 mb-4">
            <IconShieldLock size={20} className="text-primary" />
            <h3 className="font-bold text-lg text-foreground/80">개인정보 및 권한</h3>
          </div>
          <div className="bg-surface rounded-2xl shadow-sm border border-surface-border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <span className="font-semibold text-[15px]">위치 정보 (내 위치 표시)</span>
              {translatePerm(locationPerm)}
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="font-semibold text-[15px]">알림 (방문 시간 안내)</span>
              {translatePerm(notifPerm)}
            </div>
          </div>
          {(locationPerm === 'denied' || notifPerm === 'denied') && (
            <p className="text-[13px] text-foreground/50 mt-3 px-2 font-medium">
              * 거부된 권한은 기기의 브라우저 설정에서 직접 허용해야 합니다.
            </p>
          )}
        </section>

        {/* App Info & Github */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <IconBrandGithub size={20} className="text-primary" />
            <h3 className="font-bold text-lg text-foreground/80">앱 정보 및 고객센터</h3>
          </div>
          
          <div className="bg-surface/70 backdrop-blur-xl rounded-2xl shadow-sm border border-surface-border overflow-hidden">
            <a
              href="https://github.com/LeeAn0121/CareRoute/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-surface-muted transition-colors border-b border-surface-border"
            >
              <div className="flex flex-col">
                <span className="font-bold text-[15px]">현재 버전 (v1.0.0)</span>
                <span className="text-[12px] text-foreground/50 font-medium">업데이트 노트 확인하기</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">최신</span>
                <IconChevronRight size={18} className="text-foreground/30" />
              </div>
            </a>
            
            <a
              href="https://github.com/LeeAn0121/CareRoute/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-surface-muted transition-colors border-b border-surface-border"
            >
              <div className="flex items-center gap-3">
                <IconBug size={20} className="text-red-500" />
                <span className="font-bold text-[15px]">버그 제보 및 기능 제안</span>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </a>
            
            <button
              onClick={onReplayTutorial}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconHelp size={20} className="text-primary" />
                <span className="font-bold text-[15px]">앱 사용법 (가이드 투어) 다시 보기</span>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </button>
          </div>
        </section>

        {/* Removed redundant Support section */}
        <section className="hidden">
          <div className="bg-surface rounded-2xl shadow-sm border border-surface-border overflow-hidden">
            <button
              onClick={onReplayTutorial}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-muted transition-colors active:bg-surface-muted/80"
            >
              <div className="flex items-center gap-3">
                <IconHelp size={22} className="text-primary" />
                <span className="font-bold text-[15px]">앱 사용법 (가이드 투어) 다시 보기</span>
              </div>
              <IconChevronRight size={20} className="text-foreground/30" />
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
