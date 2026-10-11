'use client';
import React, { useState, useEffect } from 'react';
import { 
  IconShieldLock, IconChevronRight, IconChevronDown,
  IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, 
  IconBug, IconRefresh, IconBell, IconBellRinging, IconCheck, 
  IconAlertTriangle, IconInfoCircle, IconDeviceMobile,
  IconClock, IconBrandGoogle, IconCalendarEvent, IconUsers,
  IconUserPlus, IconMapPin, IconNavigation, IconSparkles,
  IconHelp, IconArrowRight
} from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getDetailedNotificationStatus, 
  requestNotificationPermission, 
  sendTestNotification, 
  NotificationStatus 
} from '@/lib/notifications';

export interface SettingsViewProps {
  onReplayTutorial: () => void;
  onBack: () => void;
  onSyncCalendar?: () => void;
  isSyncingCalendar?: boolean;
  onAddNewRecipient?: () => void;
  totalRecipientsCount?: number;
  todayTotalCount?: number;
  todayCompletedCount?: number;
  onNavigateTab?: (tab: 'map' | 'list' | 'route') => void;
}

const colorThemes = [
  { id: 'theme-navy', name: '블랙/화이트', color: 'bg-[#1C1C1E] dark:bg-white' },
  { id: 'theme-blue', name: '블루', color: 'bg-[#007AFF]' },
  { id: 'theme-emerald', name: '에메랄드', color: 'bg-[#34C759]' },
  { id: 'theme-rose', name: '로즈', color: 'bg-[#FF2D55]' },
  { id: 'theme-purple', name: '퍼플', color: 'bg-[#AF52DE]' },
  { id: 'theme-teal', name: '틸', color: 'bg-[#32ADE6]' },
];

export default function SettingsView({ 
  onReplayTutorial, 
  onBack, 
  onSyncCalendar, 
  isSyncingCalendar,
  onAddNewRecipient,
  totalRecipientsCount = 0,
  todayTotalCount = 0,
  todayCompletedCount = 0,
  onNavigateTab
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);
  const [defaultNavi, setDefaultNavi] = useState('naver');

  const remainingVisits = Math.max(0, todayTotalCount - todayCompletedCount);
  const progressPercent = todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;

  const refreshNotifStatus = async () => {
    const status = await getDetailedNotificationStatus();
    setNotifStatus(status);
  };

  useEffect(() => {
    setMounted(true);
    const current = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    setColorTheme(current);
    const savedNavi = localStorage.getItem('careroute_default_navi') || 'naver';
    setDefaultNavi(savedNavi);

    refreshNotifStatus();

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

  const translateLocationPerm = (status: string) => {
    if (status === 'granted') return <span className="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-md text-xs">정상 허용됨</span>;
    if (status === 'denied') return <span className="text-red-500 font-bold bg-red-500/10 px-2.5 py-1 rounded-md text-xs">거부됨</span>;
    if (status === 'prompt' || status === 'default') return <span className="text-foreground/50 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">요청 대기</span>;
    return <span className="text-foreground/50 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">{status}</span>;
  };

  const handleRequestNotification = async () => {
    setIsRequestingNotif(true);
    setFeedbackMessage(null);
    try {
      const res = await requestNotificationPermission();
      await refreshNotifStatus();

      if (res.success) {
        setFeedbackMessage({ type: 'success', text: '알림 권한이 허용되었습니다! 방문 알림을 정상 수신합니다.' });
        await sendTestNotification();
      } else {
        if (res.permission === 'denied') {
          setFeedbackMessage({ type: 'error', text: '알림 권한이 차단되었습니다. 브라우저/기기 설정에서 허용해주세요.' });
          setShowUnblockGuide(true);
        } else {
          setFeedbackMessage({ type: 'info', text: '알림 권한 요청이 완료되지 않았습니다.' });
        }
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || '권한 요청 중 오류가 발생했습니다.' });
    } finally {
      setIsRequestingNotif(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    setFeedbackMessage(null);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: '테스트 알림을 발송했습니다! 기기 상단/잠금화면 알림을 확인해보세요.' });
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || '테스트 알림 발송에 실패했습니다.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || '알림 발송 중 오류가 발생했습니다.' });
    } finally {
      setIsTestingNotif(false);
    }
  };

  if (!mounted) return null;

  const currentNotifPerm = notifStatus?.permission || 'unsupported';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-36 bg-background text-foreground transition-colors duration-500"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 px-1">
        <div>
          <h2 className="text-[32px] font-black tracking-tight text-foreground leading-tight">전체 메뉴</h2>
          <p className="text-[13px] font-bold text-foreground/50 mt-0.5">스마트 업무 대시보드 & 환경설정</p>
        </div>
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] active:scale-95 transition-all text-foreground/70"
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="space-y-6">
        
        {/* 1. Today's Care Briefing Dashboard Card */}
        <div className="p-5 rounded-[32px] bg-gradient-to-br from-[#1A2E55] via-primary to-accent text-white shadow-xl shadow-primary/25 relative overflow-hidden border border-white/20">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[18px] bg-white/15 backdrop-blur-md p-1 border border-white/25 shrink-0 shadow-md flex items-center justify-center">
                <img src="/CareRoute/icon-192.png" alt="CareRoute Logo" className="w-full h-full object-cover rounded-[14px]" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-white/70 block">CareRoute Live Briefing</span>
                <h3 className="text-[18px] font-black tracking-tight leading-tight">오늘의 방문 케어 현황</h3>
              </div>
            </div>

            <span className="text-[11px] font-black px-2.5 py-1 bg-white/20 rounded-full border border-white/30 shrink-0">
              {todayTotalCount === 0 ? '일정 없음' : remainingVisits === 0 ? '모두 완료 🎉' : `${remainingVisits}건 남음`}
            </span>
          </div>

          {/* Stat Pill Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4 bg-black/20 p-2.5 rounded-[22px] border border-white/10 backdrop-blur-sm">
            <div className="text-center">
              <span className="text-[10px] font-bold text-white/60 block">전체</span>
              <strong className="text-[17px] font-black text-white">{totalRecipientsCount}</strong>
              <span className="text-[10px] text-white/60">명</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="text-[10px] font-bold text-white/60 block">오늘 대상</span>
              <strong className="text-[17px] font-black text-white">{todayTotalCount}</strong>
              <span className="text-[10px] text-white/60">명</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="text-[10px] font-bold text-emerald-300 block">방문 완료</span>
              <strong className="text-[17px] font-black text-emerald-300">{todayCompletedCount}</strong>
              <span className="text-[10px] text-white/60">명</span>
            </div>
            <div className="text-center border-l border-white/10">
              <span className="text-[10px] font-bold text-amber-300 block">남은 일정</span>
              <strong className="text-[17px] font-black text-amber-300">{remainingVisits}</strong>
              <span className="text-[10px] text-white/60">명</span>
            </div>
          </div>

          {/* Progress Bar */}
          {todayTotalCount > 0 && (
            <div className="mb-3.5">
              <div className="flex justify-between text-[11px] font-bold text-white/80 mb-1.5">
                <span>오늘 방문 진행률</span>
                <span>{progressPercent}% 완료</span>
              </div>
              <div className="w-full h-2.5 bg-black/25 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full shadow-xs"
                />
              </div>
            </div>
          )}

          {/* Quick Schedule Jump */}
          <button
            onClick={() => onNavigateTab ? onNavigateTab('route') : onBack()}
            className="w-full py-2.5 px-3.5 rounded-[18px] bg-white/20 hover:bg-white/30 text-white font-black text-[13px] flex items-center justify-center gap-1.5 active:scale-98 transition-all border border-white/25"
          >
            <span>오늘의 방문 일정 바로보기</span>
            <IconArrowRight size={16} />
          </button>
        </div>

        {/* 2. Quick Action Hub (4-Grid) */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[12px] font-black text-foreground/50 uppercase tracking-wider">원터치 빠른 실행</span>
            <span className="text-[11px] font-bold text-primary flex items-center gap-1"><IconSparkles size={13} /> 스마트 케어 허브</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Quick Button 1: Add New Recipient */}
            <button
              onClick={() => {
                if (onAddNewRecipient) onAddNewRecipient();
                else onBack();
              }}
              className="p-4 rounded-[26px] bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl border border-surface-border/60 hover:bg-surface shadow-[0_8px_20px_rgba(0,0,0,0.04)] text-left flex flex-col justify-between gap-3 active:scale-95 transition-all group"
            >
              <div className="w-10 h-10 rounded-[18px] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <IconUserPlus size={22} strokeWidth={2.5} />
              </div>
              <div>
                <span className="font-black text-[15px] text-foreground tracking-tight block">어르신 신규 등록</span>
                <span className="text-[11px] text-foreground/50 font-bold block mt-0.5">명단에 새 어르신 추가</span>
              </div>
            </button>

            {/* Quick Button 2: Sync to Google Calendar */}
            <button
              onClick={onSyncCalendar}
              disabled={isSyncingCalendar}
              className="p-4 rounded-[26px] bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl border border-surface-border/60 hover:bg-surface shadow-[0_8px_20px_rgba(0,0,0,0.04)] text-left flex flex-col justify-between gap-3 active:scale-95 transition-all group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-[18px] bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform">
                {isSyncingCalendar ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconBrandGoogle size={22} strokeWidth={2.5} />
                )}
              </div>
              <div>
                <span className="font-black text-[15px] text-foreground tracking-tight block">캘린더 동기화</span>
                <span className="text-[11px] text-foreground/50 font-bold block mt-0.5">구글 캘린더에 일정 저장</span>
              </div>
            </button>

            {/* Quick Button 3: Test System Notification */}
            <button
              onClick={handleTestNotification}
              disabled={isTestingNotif}
              className="p-4 rounded-[26px] bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl border border-surface-border/60 hover:bg-surface shadow-[0_8px_20px_rgba(0,0,0,0.04)] text-left flex flex-col justify-between gap-3 active:scale-95 transition-all group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-[18px] bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                {isTestingNotif ? (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconBellRinging size={22} strokeWidth={2.5} />
                )}
              </div>
              <div>
                <span className="font-black text-[15px] text-foreground tracking-tight block">알림 즉시 테스트</span>
                <span className="text-[11px] text-foreground/50 font-bold block mt-0.5">기기 알림 정상 수신 확인</span>
              </div>
            </button>

            {/* Quick Button 4: Navigate Map View */}
            <button
              onClick={() => onNavigateTab ? onNavigateTab('map') : onBack()}
              className="p-4 rounded-[26px] bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl border border-surface-border/60 hover:bg-surface shadow-[0_8px_20px_rgba(0,0,0,0.04)] text-left flex flex-col justify-between gap-3 active:scale-95 transition-all group"
            >
              <div className="w-10 h-10 rounded-[18px] bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <IconMapPin size={22} strokeWidth={2.5} />
              </div>
              <div>
                <span className="font-black text-[15px] text-foreground tracking-tight block">지도 전체 보기</span>
                <span className="text-[11px] text-foreground/50 font-bold block mt-0.5">내 위치 및 어르신 핀</span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Service & Navigation Settings Group */}
        <section>
          <div className="px-3 mb-2">
            <span className="text-[12px] font-black text-foreground/50 uppercase tracking-wider">서비스 & 내비게이션</span>
          </div>

          <div className="bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl rounded-[30px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/60 overflow-hidden flex flex-col">
            
            {/* Preferred Navi App Selector */}
            <div className="p-4.5 border-b border-surface-border/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[15px] font-black text-foreground tracking-tight block">기본 내비게이션 앱</span>
                  <span className="text-[12px] text-foreground/50 font-bold">길안내 버튼 터치 시 우선 실행할 앱</span>
                </div>
                <span className="text-[11px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                  {defaultNavi === 'kakao' ? '카카오맵' : defaultNavi === 'tmap' ? '티맵 (TMAP)' : '네이버 지도'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'naver', name: '네이버 지도', icon: 'https://ssl.pstatic.net/static/maps/assets/icons/favicon.ico' },
                  { id: 'kakao', name: '카카오맵', icon: 'https://map.kakao.com/favicon.ico' },
                  { id: 'tmap', name: '티맵 (TMAP)', icon: 'https://www.tmapmobility.com/favicon.ico' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      localStorage.setItem('careroute_default_navi', item.id);
                      setDefaultNavi(item.id);
                    }}
                    className={`py-3 px-2 rounded-[20px] border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      defaultNavi === item.id
                        ? 'bg-primary/10 border-primary text-primary font-black shadow-xs ring-1 ring-primary'
                        : 'bg-foreground/[0.02] border-surface-border/60 hover:bg-foreground/[0.05] text-foreground/70 font-bold'
                    }`}
                  >
                    <img src={item.icon} alt="" className="w-5 h-5 rounded-[6px] object-contain" />
                    <span className="text-xs">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cloud Realtime Sync State */}
            <div className="p-4.5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <IconShieldLock size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[15px] tracking-tight">클라우드 데이터 보관</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">실시간 연동</span>
                  </div>
                  <span className="text-[12px] text-foreground/50 font-bold">어르신 명단, 방문 일지, 메모가 실시간 암호화 보관됩니다</span>
                </div>
              </div>
              <IconCheck size={18} className="text-emerald-500" strokeWidth={3} />
            </div>
          </div>
        </section>

        {/* 4. Display & Personalization Settings Group */}
        <section>
          <div className="px-3 mb-2">
            <span className="text-[12px] font-black text-foreground/50 uppercase tracking-wider">화면 및 테마 개인화</span>
          </div>

          <div className="bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl rounded-[30px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/60 overflow-hidden flex flex-col">
            {/* Theme Mode Segmented Switcher */}
            <div className="p-4.5 border-b border-surface-border/50">
              <span className="text-[14px] font-black text-foreground tracking-tight block mb-3">화면 모드</span>
              <div className="flex p-1 bg-foreground/[0.04] dark:bg-white/[0.06] rounded-[20px] border border-surface-border/40">
                {[
                  { id: 'light', label: '라이트', icon: <IconSun size={17} strokeWidth={2.5} /> },
                  { id: 'dark', label: '다크', icon: <IconMoonStars size={17} strokeWidth={2.5} /> },
                  { id: 'system', label: '시스템', icon: <IconDeviceDesktop size={17} strokeWidth={2.5} /> },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 py-2.5 rounded-[16px] font-black text-[13px] flex items-center justify-center gap-1.5 transition-all ${
                      theme === t.id 
                        ? 'bg-surface text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                        : 'text-foreground/50 hover:text-foreground/80 font-bold'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* One UI 9.0 Accent Color Palettes */}
            <div className="p-4.5">
              <span className="text-[14px] font-black text-foreground tracking-tight block mb-3">테마 컬러 칩</span>
              <div className="grid grid-cols-3 gap-2.5">
                {colorThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleColorThemeChange(t.id)}
                    className={`relative flex flex-col items-center justify-center py-3.5 rounded-[22px] transition-all gap-1.5 ${
                      colorTheme === t.id 
                        ? 'bg-primary/10 ring-2 ring-primary ring-inset' 
                        : 'bg-foreground/[0.02] hover:bg-foreground/[0.06] border border-surface-border/40'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full shadow-md border-2 border-white/30 ${t.color}`} />
                    <span className={`text-[12px] font-black ${colorTheme === t.id ? 'text-primary' : 'text-foreground/70'}`}>
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Smart Notifications & System Permissions Center */}
        <section>
          <div className="px-3 mb-2">
            <span className="text-[12px] font-black text-foreground/50 uppercase tracking-wider">스마트 알림 & 센서 권한</span>
          </div>

          <div className="bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl rounded-[30px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/60 overflow-hidden flex flex-col">
            
            {/* GPS Location Status */}
            <div className="flex items-center justify-between p-4.5 border-b border-surface-border/50">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-2xs">
                  <IconMapPin size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-black text-[15px] tracking-tight block">GPS 위치 권한</span>
                  <span className="text-[12px] text-foreground/50 font-bold">현재 위치 자동 감지 및 인근 어르신 탐색</span>
                </div>
              </div>
              {translateLocationPerm(locationPerm)}
            </div>

            {/* Visit Reminder Notification Status */}
            <div className="p-4.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-[14px] bg-purple-500/10 flex items-center justify-center text-purple-600 shadow-2xs">
                    <IconBellRinging size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="font-black text-[15px] tracking-tight block">방문 예정 알림 (PC/모바일)</span>
                    <span className="text-[12px] text-foreground/50 font-bold">
                      {currentNotifPerm === 'granted' 
                        ? '노트북 및 모바일 브라우저 알림 수신 준비 완료' 
                        : currentNotifPerm === 'denied'
                          ? '알림이 차단되어 있습니다'
                          : '방문 시간 자동 알림을 받으려면 권한이 필요합니다'}
                    </span>
                  </div>
                </div>

                <div>
                  {currentNotifPerm === 'granted' && (
                    <span className="text-primary font-black bg-primary/10 px-2.5 py-1 rounded-full text-xs flex items-center gap-1 border border-primary/20">
                      <IconCheck size={14} strokeWidth={3} /> 정상 허용
                    </span>
                  )}
                  {currentNotifPerm === 'denied' && (
                    <span className="text-red-500 font-black bg-red-500/10 px-2.5 py-1 rounded-full text-xs flex items-center gap-1 border border-red-500/20">
                      <IconAlertTriangle size={14} strokeWidth={3} /> 차단됨
                    </span>
                  )}
                  {currentNotifPerm === 'default' && (
                    <span className="text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-full text-xs border border-amber-500/20">
                      요청 대기
                    </span>
                  )}
                  {currentNotifPerm === 'unsupported' && (
                    <span className="text-foreground/40 font-black bg-surface-muted px-2.5 py-1 rounded-full text-xs">
                      미지원
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback Message */}
              <AnimatePresence>
                {feedbackMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3.5 rounded-[18px] text-xs font-black flex items-center gap-2 ${
                      feedbackMessage.type === 'success' ? 'bg-primary/10 text-primary border border-primary/20' :
                      feedbackMessage.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      'bg-surface-muted text-foreground/80 border border-surface-border'
                    }`}
                  >
                    <IconInfoCircle size={16} className="shrink-0" />
                    <span>{feedbackMessage.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons for Notification */}
              <div className="pt-1 flex flex-col gap-2">
                {currentNotifPerm === 'granted' && (
                  <button
                    onClick={handleTestNotification}
                    disabled={isTestingNotif}
                    className="w-full py-3 px-4 bg-primary/10 hover:bg-primary/15 text-primary rounded-[18px] font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60 border border-primary/20 shadow-xs"
                  >
                    <IconBell size={18} strokeWidth={2.5} />
                    {isTestingNotif ? '테스트 알림 발송 중...' : '🔔 시스템 알림 테스트 보내기'}
                  </button>
                )}

                {currentNotifPerm === 'default' && (
                  <button
                    onClick={handleRequestNotification}
                    disabled={isRequestingNotif}
                    className="w-full py-3.5 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded-[18px] font-black text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-60"
                  >
                    <IconBellRinging size={18} strokeWidth={2.5} />
                    {isRequestingNotif ? '권한 요청 진행 중...' : '🔔 방문 알림 권한 켜기'}
                  </button>
                )}

                {currentNotifPerm === 'denied' && (
                  <button
                    onClick={() => setShowUnblockGuide(!showUnblockGuide)}
                    className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/15 text-red-600 rounded-[18px] font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-98 border border-red-500/20"
                  >
                    <IconInfoCircle size={18} strokeWidth={2.5} />
                    {showUnblockGuide ? '알림 차단 해제 방법 닫기' : '💡 알림 차단 해제 가이드 열기'}
                  </button>
                )}
              </div>

              {/* Unblock Guide Details */}
              <AnimatePresence>
                {showUnblockGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-4 rounded-[22px] bg-foreground/[0.03] border border-surface-border text-xs leading-relaxed space-y-3"
                  >
                    <p className="font-black text-[13px] text-foreground">브라우저별 알림 차단 해제 안내</p>
                    
                    <div className="space-y-1">
                      <p className="font-black text-primary">1. 크롬 / 엣지 / 네이버 웨일</p>
                      <p className="text-foreground/70 font-semibold">상단 주소창 왼쪽의 자물쇠(또는 사이트 설정 슬라이더) 아이콘 클릭 → [알림] 설정을 '허용'으로 변경한 후 페이지를 새로고침하세요.</p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-black text-primary">2. 맥(Mac) 사파리(Safari)</p>
                      <p className="text-foreground/70 font-semibold">메뉴바 [Safari] → [설정] → [웹사이트] 탭 → 좌측 [알림] 선택 → CareRoute 항목을 '허용'으로 변경하세요.</p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-black text-primary">3. 아이폰 / 아이패드 (iOS)</p>
                      <p className="text-foreground/70 font-semibold">애플 정책상 사파리 브라우저 창에서는 웹 알림이 제한됩니다. Safari 하단 [공유] → [홈 화면에 추가] 후 홈 화면 아이콘으로 앱을 실행해주세요.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* 6. Support & App Management Group */}
        <section>
          <div className="px-3 mb-2">
            <span className="text-[12px] font-black text-foreground/50 uppercase tracking-wider">지원 및 앱 관리</span>
          </div>

          <div className="bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl rounded-[30px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/60 overflow-hidden flex flex-col">
            
            {/* Replay Tutorial */}
            <button
              onClick={onReplayTutorial}
              className="w-full flex items-center justify-between p-4.5 hover:bg-foreground/[0.04] transition-colors active:bg-foreground/[0.08] border-b border-surface-border/50 text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-primary/10 flex items-center justify-center text-primary shadow-2xs">
                  <IconHelp size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-black text-[15px] tracking-tight block">앱 사용 가이드 다시 보기</span>
                  <span className="text-[12px] text-foreground/50 font-bold">주요 화면별 기능 안내 튜토리얼을 다시 실행합니다</span>
                </div>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </button>

            {/* Version Information */}
            <a
              href="https://github.com/LeeAn0121/CareRoute/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4.5 hover:bg-foreground/[0.04] transition-colors border-b border-surface-border/50 active:bg-foreground/[0.08]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-foreground flex items-center justify-center text-background shadow-2xs">
                  <IconBrandGithub size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-black text-[15px] tracking-tight block">케어루트 버전 정보 (v1.4.0)</span>
                  <span className="text-[12px] text-foreground/50 font-bold">오픈소스 릴리즈 및 업데이트 내역 확인</span>
                </div>
              </div>
              <span className="text-[11px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                최신 버전
              </span>
            </a>

            {/* Bug Report */}
            <a
              href="https://github.com/LeeAn0121/CareRoute/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4.5 hover:bg-foreground/[0.04] transition-colors border-b border-surface-border/50 active:bg-foreground/[0.08]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-red-500/10 flex items-center justify-center text-red-500 shadow-2xs">
                  <IconBug size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-black text-[15px] tracking-tight block">버그 제보 및 기능 제안</span>
                  <span className="text-[12px] text-foreground/50 font-bold">현장 건의사항 및 문제점을 개발팀에 전달합니다</span>
                </div>
              </div>
              <IconChevronRight size={18} className="text-foreground/30" />
            </a>

            {/* Clear Cache & Hard Refresh */}
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
              className="w-full flex items-center justify-between p-4.5 hover:bg-red-500/10 transition-colors active:bg-red-500/20 text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[14px] bg-red-500/10 flex items-center justify-center text-red-500 shadow-2xs">
                  <IconRefresh size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-black text-[15px] tracking-tight text-red-500 block">앱 캐시 초기화 및 강력 새로고침</span>
                  <span className="text-[12px] text-foreground/50 font-bold">지도 화면이나 알림이 비정상일 때 최신 데이터로 리셋</span>
                </div>
              </div>
            </button>
          </div>
        </section>

      </div>
    </motion.div>
  );
}
