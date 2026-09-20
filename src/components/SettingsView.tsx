import React, { useState, useEffect } from 'react';
import { IconPalette, IconHelp, IconShieldLock, IconChevronRight, IconMoonStars, IconSun, IconDeviceDesktop } from '@tabler/icons-react';
import { useTheme } from 'next-themes';

interface SettingsViewProps {
  onReplayTutorial: () => void;
}

const colorThemes = [
  { id: 'theme-navy', name: '네이비', color: 'bg-[#12203D]' },
  { id: 'theme-blue', name: '블루', color: 'bg-blue-600' },
  { id: 'theme-emerald', name: '에메랄드', color: 'bg-emerald-600' },
  { id: 'theme-rose', name: '로즈', color: 'bg-rose-600' },
  { id: 'theme-purple', name: '퍼플', color: 'bg-purple-600' },
  { id: 'theme-teal', name: '틸', color: 'bg-teal-600' },
];

export default function SettingsView({ onReplayTutorial }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifPerm, setNotifPerm] = useState('확인 중...');

  useEffect(() => {
    setMounted(true);
    
    // Load current color theme
    const current = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    setColorTheme(current);

    // Check Notification Permission
    if ('Notification' in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm('지원 안 함');
    }

    // Check Geolocation Permission
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
    if (status === 'granted') return <span className="text-emerald-500 font-bold">허용됨</span>;
    if (status === 'denied') return <span className="text-red-500 font-bold">거부됨</span>;
    if (status === 'prompt' || status === 'default') return <span className="text-slate-400 font-bold">요청 전</span>;
    return <span className="text-slate-400 font-bold">{status}</span>;
  };

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pt-[160px] pb-32 bg-surface text-foreground transition-colors duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-black">설정</h2>
        <p className="text-sm font-semibold opacity-60 mt-1">앱 환경을 맞춤 설정하세요</p>
      </div>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <div className="bg-surface-muted rounded-2xl p-5 shadow-sm border border-surface-border transition-colors duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <IconPalette size={18} className="text-primary" />
            </div>
            <h3 className="font-bold text-lg">화면 테마</h3>
          </div>
          
          <div className="flex gap-2 mb-6">
            {[
              { id: 'light', label: '라이트', icon: <IconSun size={18} /> },
              { id: 'dark', label: '다크', icon: <IconMoonStars size={18} /> },
              { id: 'system', label: '시스템', icon: <IconDeviceDesktop size={18} /> },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 py-3 px-2 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all border-2 ${
                  theme === t.id 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-surface-border bg-surface text-foreground/60 hover:bg-surface-muted'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-extrabold opacity-60">색 테마 (포인트 컬러)</h4>
            <div className="grid grid-cols-3 gap-3">
              {colorThemes.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleColorThemeChange(t.id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all gap-2 ${
                    colorTheme === t.id ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full shadow-sm ${t.color}`} />
                  <span className={`text-xs font-bold ${colorTheme === t.id ? 'text-primary' : 'text-foreground/70'}`}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-surface-muted rounded-2xl p-5 shadow-sm border border-surface-border transition-colors duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <IconShieldLock size={18} className="text-rose-500" />
            </div>
            <h3 className="font-bold text-lg">사용 권한 상태</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-border">
              <span className="font-semibold text-foreground/80">위치 정보 (내 위치 표시)</span>
              {translatePerm(locationPerm)}
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-border">
              <span className="font-semibold text-foreground/80">알림 (방문 시간 안내)</span>
              {translatePerm(notifPerm)}
            </div>
            {(locationPerm === 'denied' || notifPerm === 'denied') && (
              <p className="text-xs text-foreground/50 mt-2 px-1">
                * 거부된 권한은 브라우저 설정(사이트 설정)에서 직접 허용으로 변경해야 합니다.
              </p>
            )}
          </div>
        </div>

        {/* Tutorial */}
        <div className="bg-surface-muted rounded-2xl p-2 shadow-sm border border-surface-border transition-colors duration-300">
          <button
            onClick={onReplayTutorial}
            className="w-full flex items-center justify-between p-3 bg-transparent hover:bg-surface rounded-xl transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <IconHelp size={18} className="text-accent" />
              </div>
              <h3 className="font-bold text-lg">가이드 투어 다시 보기</h3>
            </div>
            <IconChevronRight size={20} className="text-foreground/40" />
          </button>
        </div>
      </div>
    </div>
  );
}
