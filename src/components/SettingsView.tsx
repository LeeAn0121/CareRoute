import React, { useState, useEffect } from 'react';
import { IconPalette, IconHelp, IconShieldLock, IconChevronRight, IconCheck } from '@tabler/icons-react';

interface SettingsViewProps {
  onReplayTutorial: () => void;
}

export default function SettingsView({ onReplayTutorial }: SettingsViewProps) {
  const [theme, setTheme] = useState('light');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifPerm, setNotifPerm] = useState('확인 중...');

  useEffect(() => {
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

  const translatePerm = (status: string) => {
    if (status === 'granted') return <span className="text-emerald-500 font-bold">허용됨</span>;
    if (status === 'denied') return <span className="text-red-500 font-bold">거부됨</span>;
    if (status === 'prompt' || status === 'default') return <span className="text-slate-400 font-bold">요청 전</span>;
    return <span className="text-slate-400 font-bold">{status}</span>;
  };

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pt-[160px] pb-32 bg-[#FBFAF7]">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-[#12203D]">설정</h2>
        <p className="text-sm text-slate-500 font-semibold mt-1">앱 환경을 맞춤 설정하세요</p>
      </div>

      <div className="space-y-6">
        {/* Theme Settings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <IconPalette size={18} className="text-indigo-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-700">화면 테마</h3>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'light', label: '라이트 (기본)' },
              { id: 'dark', label: '다크 (준비 중)' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => t.id === 'light' ? setTheme(t.id) : alert('다크 모드는 곧 지원될 예정입니다!')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${
                  theme === t.id 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
              <IconShieldLock size={18} className="text-rose-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-700">사용 권한 상태</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="font-semibold text-slate-600">위치 정보 (내 위치 표시)</span>
              {translatePerm(locationPerm)}
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="font-semibold text-slate-600">알림 (방문 시간 안내)</span>
              {translatePerm(notifPerm)}
            </div>
            {(locationPerm === 'denied' || notifPerm === 'denied') && (
              <p className="text-xs text-slate-400 mt-2 px-1">
                * 거부된 권한은 브라우저 설정(사이트 설정)에서 직접 허용으로 변경해야 합니다.
              </p>
            )}
          </div>
        </div>

        {/* Tutorial */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
          <button
            onClick={onReplayTutorial}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                <IconHelp size={18} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-lg text-slate-700">가이드 투어 다시 보기</h3>
            </div>
            <IconChevronRight size={20} className="text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
