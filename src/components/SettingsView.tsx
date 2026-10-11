'use client';
import React, { useState, useEffect } from 'react';
import { 
  IconShieldLock, IconChevronRight, IconChevronDown,
  IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, 
  IconBug, IconRefresh, IconBell, IconBellRinging, IconCheck, 
  IconAlertTriangle, IconInfoCircle, IconDeviceMobile,
  IconClock, IconBrandGoogle, IconCalendarEvent, IconUsers,
  IconUserPlus, IconMapPin, IconNavigation, IconSparkles,
  IconHelp, IconArrowRight, IconShare, IconCompass
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
  const [showNaviPicker, setShowNaviPicker] = useState(false);

  const remainingVisits = Math.max(0, todayTotalCount - todayCompletedCount);
  const progressPercent = todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;

  // Format today's date in Korean (e.g., "10월 11일 금요일")
  const todayFormatted = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date());

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 overflow-y-auto px-4 pt-14 pb-36 bg-[#F2F2F7] dark:bg-[#000000] text-black dark:text-white transition-colors duration-300 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Pretendard',sans-serif]"
    >
      {/* iOS Navigation Bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <span className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase tracking-wider block">
            CareRoute Settings Hub
          </span>
          <h1 className="text-[34px] font-extrabold tracking-tight text-black dark:text-white leading-none mt-1">
            메뉴
          </h1>
        </div>

        {/* iOS Native "완료 (Done)" Button */}
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] text-[#007AFF] font-bold text-[15px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] active:opacity-70 transition-opacity"
        >
          완료
        </button>
      </div>

      <div className="space-y-6 max-w-xl mx-auto">
        
        {/* Apple ID Style Profile / Agency Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-[14px] bg-[#007AFF]/10 p-1 flex items-center justify-center shrink-0 border border-black/[0.05] dark:border-white/[0.1] shadow-2xs">
            <img src="/CareRoute/icon-192.png" alt="CareRoute Logo" className="w-full h-full object-cover rounded-[11px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight truncate">
                케어루트 (CareRoute)
              </h2>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-[#34C759]/15 text-[#34C759] rounded-md shrink-0">
                <IconCheck size={11} strokeWidth={3} /> 실시간
              </span>
            </div>
            <p className="text-[13px] text-[#8E8E93] dark:text-[#98989D] font-medium truncate mt-0.5">
              스마트 방문요양 & 동선 관리 플랫폼
            </p>
          </div>
          <IconChevronRight size={18} className="text-[#C7C7CC] dark:text-[#48484A] shrink-0" />
        </div>

        {/* iOS Fitness / Health Rings Style Activity Widget Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[22px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <span className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D] block">
                {todayFormatted}
              </span>
              <h3 className="text-[18px] font-bold text-black dark:text-white tracking-tight mt-0.5">
                오늘의 방문 케어 활동
              </h3>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              todayTotalCount === 0 
                ? 'bg-[#8E8E93]/15 text-[#8E8E93]' 
                : remainingVisits === 0 
                  ? 'bg-[#34C759]/15 text-[#34C759]' 
                  : 'bg-[#FF9500]/15 text-[#FF9500]'
            }`}>
              {todayTotalCount === 0 ? '일정 없음' : remainingVisits === 0 ? '모두 완료 🎉' : `${remainingVisits}건 남음`}
            </span>
          </div>

          {/* iOS 3-Column Metrics Stack */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3 rounded-[16px]">
              <span className="text-[11px] font-semibold text-[#8E8E93] dark:text-[#98989D] block">전체 어르신</span>
              <div className="flex items-baseline gap-1 mt-1">
                <strong className="text-[22px] font-extrabold text-[#007AFF] tracking-tight">{totalRecipientsCount}</strong>
                <span className="text-[12px] text-[#8E8E93] font-medium">명</span>
              </div>
            </div>

            <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3 rounded-[16px]">
              <span className="text-[11px] font-semibold text-[#8E8E93] dark:text-[#98989D] block">방문 완료</span>
              <div className="flex items-baseline gap-1 mt-1">
                <strong className="text-[22px] font-extrabold text-[#34C759] tracking-tight">{todayCompletedCount}</strong>
                <span className="text-[12px] text-[#8E8E93] font-medium">명</span>
              </div>
            </div>

            <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3 rounded-[16px]">
              <span className="text-[11px] font-semibold text-[#8E8E93] dark:text-[#98989D] block">남은 방문</span>
              <div className="flex items-baseline gap-1 mt-1">
                <strong className="text-[22px] font-extrabold text-[#FF9500] tracking-tight">{remainingVisits}</strong>
                <span className="text-[12px] text-[#8E8E93] font-medium">명</span>
              </div>
            </div>
          </div>

          {/* iOS Health Activity Progress Bar */}
          {todayTotalCount > 0 && (
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D]">
                <span>오늘의 달성률</span>
                <span className="text-[#34C759] font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#34C759] to-[#30B0C7] rounded-full shadow-xs"
                />
              </div>
            </div>
          )}

          {/* Apple Style Inline Action */}
          <button
            onClick={() => onNavigateTab ? onNavigateTab('route') : onBack()}
            className="w-full py-2.5 px-3.5 rounded-[14px] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-[#007AFF] font-bold text-[14px] flex items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <span>오늘의 방문 일정 바로보기</span>
            <IconChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Apple Control Center Style 4-Grid Quick Action Hub */}
        <div>
          <span className="text-[13px] font-semibold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            빠른 실행 (QUICK ACTIONS)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (onAddNewRecipient) onAddNewRecipient();
                else onBack();
              }}
              className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#007AFF]/30">
                <IconUserPlus size={22} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-bold text-black dark:text-white tracking-tight block truncate">어르신 등록</span>
                <span className="text-[11px] text-[#8E8E93] dark:text-[#98989D] block truncate">새 어르신 추가</span>
              </div>
            </button>

            <button
              onClick={onSyncCalendar}
              disabled={isSyncingCalendar}
              className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3 text-left active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#5856D6]/30">
                {isSyncingCalendar ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconBrandGoogle size={22} strokeWidth={2.2} />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-bold text-black dark:text-white tracking-tight block truncate">캘린더 동기화</span>
                <span className="text-[11px] text-[#8E8E93] dark:text-[#98989D] block truncate">구글 캘린더 연동</span>
              </div>
            </button>

            <button
              onClick={handleTestNotification}
              disabled={isTestingNotif}
              className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3 text-left active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#FF9500]/30">
                {isTestingNotif ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconBellRinging size={22} strokeWidth={2.2} />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-bold text-black dark:text-white tracking-tight block truncate">알림 테스트</span>
                <span className="text-[11px] text-[#8E8E93] dark:text-[#98989D] block truncate">방문 알림 발송</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab ? onNavigateTab('map') : onBack()}
              className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#34C759]/30">
                <IconMapPin size={22} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-bold text-black dark:text-white tracking-tight block truncate">지도 보기</span>
                <span className="text-[11px] text-[#8E8E93] dark:text-[#98989D] block truncate">실시간 위치 확인</span>
              </div>
            </button>
          </div>
        </div>

        {/* iOS Inset Group 1: 길안내 및 서비스 (Navigation & Service) */}
        <div>
          <span className="text-[13px] font-semibold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            길안내 및 서비스 (NAVIGATION)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* Preferred Navigation Selector Row */}
            <div>
              <button
                onClick={() => setShowNaviPicker(!showNaviPicker)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <IconNavigation size={17} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight block">기본 내비게이션</span>
                    <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">길안내 터치 시 우선 실행</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-medium text-[#8E8E93] dark:text-[#98989D]">
                    {defaultNavi === 'kakao' ? '카카오맵' : defaultNavi === 'tmap' ? '티맵 (TMAP)' : '네이버 지도'}
                  </span>
                  <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showNaviPicker ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Collapsible Picker Options */}
              <AnimatePresence>
                {showNaviPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-3 pt-1 border-t border-black/[0.04] dark:border-white/[0.05] bg-[#F9F9FB] dark:bg-[#161618]"
                  >
                    <div className="grid grid-cols-3 gap-2 mt-2">
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
                            setShowNaviPicker(false);
                          }}
                          className={`py-2.5 px-2 rounded-[14px] border transition-all flex flex-col items-center justify-center gap-1.5 ${
                            defaultNavi === item.id
                              ? 'bg-white dark:bg-[#2C2C2E] border-[#007AFF] text-[#007AFF] font-bold shadow-xs'
                              : 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] text-[#8E8E93] font-medium'
                          }`}
                        >
                          <img src={item.icon} alt="" className="w-5 h-5 rounded-[5px] object-contain" />
                          <span className="text-[12px]">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cloud Realtime Backup Status Row */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconShieldLock size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight block">클라우드 데이터 보관</span>
                  <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">모든 어르신 정보 실시간 암호화</span>
                </div>
              </div>
              <span className="text-[13px] font-bold text-[#34C759] bg-[#34C759]/15 px-2.5 py-1 rounded-full flex items-center gap-1">
                <IconCheck size={13} strokeWidth={3} /> 정상 연동
              </span>
            </div>

          </div>
        </div>

        {/* iOS Inset Group 2: 디스플레이 및 화면 (Display & Appearance) */}
        <div>
          <span className="text-[13px] font-semibold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            디스플레이 및 테마 (DISPLAY)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* iOS Native Segmented Control for Light / Dark Mode */}
            <div className="px-4 py-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#8E8E93] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconSun size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight">화면 모드</span>
              </div>

              {/* Cupertino Sliding Segmented Control */}
              <div className="flex p-1 bg-[#E3E3E8] dark:bg-[#2C2C2E] rounded-[12px]">
                {[
                  { id: 'light', label: '라이트', icon: <IconSun size={15} strokeWidth={2.5} /> },
                  { id: 'dark', label: '다크', icon: <IconMoonStars size={15} strokeWidth={2.5} /> },
                  { id: 'system', label: '자동 (시스템)', icon: <IconDeviceDesktop size={15} strokeWidth={2.5} /> },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 py-1.5 rounded-[9px] font-bold text-[13px] flex items-center justify-center gap-1 transition-all ${
                      theme === t.id 
                        ? 'bg-white dark:bg-[#636366] text-black dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]' 
                        : 'text-[#6D6D72] dark:text-[#AEAEB2] hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apple Accent Palette Chips */}
            <div className="px-4 py-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconSparkles size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight">강조 컬러 칩</span>
              </div>

              <div className="grid grid-cols-6 gap-2 pt-1">
                {colorThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleColorThemeChange(t.id)}
                    className={`flex flex-col items-center justify-center py-2 rounded-[14px] transition-all gap-1.5 ${
                      colorTheme === t.id ? 'bg-[#007AFF]/10 ring-2 ring-[#007AFF]' : 'bg-[#F2F2F7] dark:bg-[#2C2C2E]'
                    }`}
                    title={t.name}
                  >
                    <div className={`w-5 h-5 rounded-full shadow-sm border border-white/40 ${t.color}`} />
                    <span className="text-[10px] font-bold truncate max-w-[42px] text-center text-[#8E8E93] dark:text-[#98989D]">
                      {t.name.split('/')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* iOS Inset Group 3: 알림 및 개인정보 (Notifications & Privacy) */}
        <div>
          <span className="text-[13px] font-semibold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            알림 및 권한 (NOTIFICATIONS & PRIVACY)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* GPS Location Row */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#32ADE6] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconMapPin size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight block">위치 서비스 (GPS)</span>
                  <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">인근 어르신 자동 탐색 및 포커싱</span>
                </div>
              </div>
              <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${
                locationPerm === 'granted' 
                  ? 'text-[#34C759] bg-[#34C759]/15' 
                  : locationPerm === 'denied' 
                    ? 'text-[#FF3B30] bg-[#FF3B30]/15' 
                    : 'text-[#8E8E93] bg-[#8E8E93]/15'
              }`}>
                {locationPerm === 'granted' ? '허용됨' : locationPerm === 'denied' ? '차단됨' : '대기'}
              </span>
            </div>

            {/* Visit Notifications Status Row */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#FF2D55] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconBellRinging size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight block">방문 예정 알림</span>
                  <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">PC 및 모바일 시스템 푸시</span>
                </div>
              </div>

              <div>
                {currentNotifPerm === 'granted' && (
                  <span className="text-[13px] font-bold text-[#34C759] bg-[#34C759]/15 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <IconCheck size={13} strokeWidth={3} /> 허용됨
                  </span>
                )}
                {currentNotifPerm === 'denied' && (
                  <span className="text-[13px] font-bold text-[#FF3B30] bg-[#FF3B30]/15 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <IconAlertTriangle size={13} strokeWidth={3} /> 차단됨
                  </span>
                )}
                {currentNotifPerm === 'default' && (
                  <button
                    onClick={handleRequestNotification}
                    disabled={isRequestingNotif}
                    className="text-[13px] font-bold text-white bg-[#007AFF] px-3 py-1.5 rounded-full shadow-xs active:opacity-70 disabled:opacity-50"
                  >
                    {isRequestingNotif ? '요청 중...' : '권한 켜기'}
                  </button>
                )}
              </div>
            </div>

            {/* Notification Test Action Button Row */}
            {currentNotifPerm === 'granted' && (
              <button
                onClick={handleTestNotification}
                disabled={isTestingNotif}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <IconBell size={17} strokeWidth={2.5} />
                  </div>
                  <span className="text-[16px] font-semibold text-[#007AFF] tracking-tight">시스템 알림 테스트 발송</span>
                </div>
                {isTestingNotif ? (
                  <div className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
                )}
              </button>
            )}

            {/* Unblock Guide Button Row (if denied or requested) */}
            <div>
              <button
                onClick={() => setShowUnblockGuide(!showUnblockGuide)}
                className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-[#8E8E93] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <IconInfoCircle size={17} strokeWidth={2.5} />
                  </div>
                  <span className="text-[15px] font-medium text-black dark:text-white">브라우저별 알림 차단 해제 가이드</span>
                </div>
                <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showUnblockGuide ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {showUnblockGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 py-3.5 bg-[#F9F9FB] dark:bg-[#161618] border-t border-black/[0.04] dark:border-white/[0.05] text-[13px] leading-relaxed space-y-3"
                  >
                    <div>
                      <p className="font-bold text-[#007AFF]">1. 크롬 / 엣지 / 웨일</p>
                      <p className="text-[#8E8E93] dark:text-[#98989D]">상단 주소창 왼쪽 자물쇠 🔒 클릭 → [알림] 설정을 '허용'으로 변경 후 새로고침하세요.</p>
                    </div>
                    <div>
                      <p className="font-bold text-[#007AFF]">2. 맥(Mac) 사파리</p>
                      <p className="text-[#8E8E93] dark:text-[#98989D]">[Safari] → [설정] → [웹사이트] 탭 → 좌측 [알림]에서 CareRoute를 '허용'하세요.</p>
                    </div>
                    <div>
                      <p className="font-bold text-[#007AFF]">3. 아이폰 / 아이패드 (iOS Safari)</p>
                      <p className="text-[#8E8E93] dark:text-[#98989D]">애플 정책상 사파리 탭에서는 웹 알림이 제한됩니다. Safari 하단 [공유] → [홈 화면에 추가] 후 실행해야 정상 작동합니다.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* iOS Inset Group 4: 지원 및 관리 (Support & About) */}
        <div>
          <span className="text-[13px] font-semibold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            지원 및 관리 (ABOUT)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* Replay Tutorial */}
            <button
              onClick={onReplayTutorial}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#30B0C7] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconHelp size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight">앱 사용 가이드 다시 보기</span>
              </div>
              <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
            </button>

            {/* Version Info */}
            <a
              href="https://github.com/LeeAn0121/CareRoute/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#48484A] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconBrandGithub size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight">버전 정보</span>
              </div>
              <span className="text-[14px] font-medium text-[#8E8E93] dark:text-[#98989D]">v1.4.0 최신</span>
            </a>

            {/* Bug Report */}
            <a
              href="https://github.com/LeeAn0121/CareRoute/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconBug size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold text-black dark:text-white tracking-tight">버그 제보 및 기능 제안</span>
              </div>
              <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
            </a>

            {/* Clear Cache & Hard Refresh Row */}
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
              className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors text-[#FF3B30]"
            >
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconRefresh size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-semibold tracking-tight">캐시 초기화 및 강력 새로고침</span>
              </div>
              <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
            </button>

          </div>
        </div>

      </div>
    </motion.div>
  );
}
