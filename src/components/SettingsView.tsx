'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  IconShieldLock, IconChevronRight, IconChevronDown,
  IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, 
  IconBug, IconRefresh, IconBell, IconBellRinging, IconCheck, 
  IconAlertTriangle, IconInfoCircle, IconDeviceMobile,
  IconClock, IconBrandGoogle, IconCalendarEvent, IconUsers,
  IconUserPlus, IconMapPin, IconNavigation, IconSparkles,
  IconHelp, IconArrowRight, IconPhoneCall, IconAmbulance,
  IconClipboardCheck, IconHeartbeat, IconPill, IconSalad,
  IconEye, IconMoodSmile, IconFirstAidKit, IconBuildingHospital,
  IconExternalLink, IconAlertCircle, IconStethoscope, IconActivity,
  IconSearch, IconX, IconMicrophone, IconShare, IconFileText
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
  totalRecipientsCount?: number;
  todayTotalCount?: number;
  todayCompletedCount?: number;
  onNavigateTab?: (tab: 'map' | 'list' | 'route') => void;
  onOpenAddRecipient?: () => void;
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
  totalRecipientsCount = 0,
  todayTotalCount = 0,
  todayCompletedCount = 0,
  onNavigateTab,
  onOpenAddRecipient,
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // 메뉴 실시간 검색
  const [searchQuery, setSearchQuery] = useState('');

  // 아코디언 토글 상태
  const [showChecklistGuide, setShowChecklistGuide] = useState(false);
  const [showFirstAidGuide, setShowFirstAidGuide] = useState(false);
  const [showRfidGuide, setShowRfidGuide] = useState(false);
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);
  const [showNaviPicker, setShowNaviPicker] = useState(false);
  const [defaultNavi, setDefaultNavi] = useState('naver');

  const remainingVisits = Math.max(0, todayTotalCount - todayCompletedCount);
  const progressPercent = todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;

  const todayFormatted = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
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

  // 8대 핵심 퀵 서비스 그리드 (Toss / Kakao T 벤토 스타일)
  const quickServices = [
    {
      id: 'quick-map',
      title: '지도 동선',
      desc: '위치·경로',
      icon: IconMapPin,
      color: 'bg-[#007AFF] text-white',
      action: () => onNavigateTab ? onNavigateTab('map') : onBack(),
    },
    {
      id: 'quick-recipient-add',
      title: '수급자 등록',
      desc: '새 어르신',
      icon: IconUserPlus,
      color: 'bg-[#34C759] text-white',
      action: () => onOpenAddRecipient ? onOpenAddRecipient() : (onNavigateTab ? onNavigateTab('list') : onBack()),
    },
    {
      id: 'quick-schedule',
      title: '방문 일정',
      desc: `${todayTotalCount}건 배정`,
      icon: IconCalendarEvent,
      color: 'bg-[#FF9500] text-white',
      action: () => onNavigateTab ? onNavigateTab('route') : onBack(),
    },
    {
      id: 'quick-voice-memo',
      title: '음성 일지',
      desc: '원터치 기록',
      icon: IconMicrophone,
      color: 'bg-[#5856D6] text-white',
      action: () => onNavigateTab ? onNavigateTab('list') : onBack(),
    },
    {
      id: 'quick-navi',
      title: '길안내 앱',
      desc: defaultNavi === 'kakao' ? '카카오맵' : defaultNavi === 'tmap' ? '티맵' : '네이버지도',
      icon: IconNavigation,
      color: 'bg-[#30B0C7] text-white',
      action: () => setShowNaviPicker(true),
    },
    {
      id: 'quick-vital',
      title: '바이탈 수칙',
      desc: '표준 기준치',
      icon: IconHeartbeat,
      color: 'bg-[#FF2D55] text-white',
      action: () => setShowChecklistGuide(prev => !prev),
    },
    {
      id: 'quick-first-aid',
      title: '응급 매뉴얼',
      desc: '하임리히·낙상',
      icon: IconFirstAidKit,
      color: 'bg-[#FF3B30] text-white',
      action: () => setShowFirstAidGuide(prev => !prev),
    },
    {
      id: 'quick-call-119',
      title: '119 긴급',
      desc: '즉시 연결',
      icon: IconAmbulance,
      color: 'bg-[#D70015] text-white',
      href: 'tel:119',
    },
  ];

  // 전체 검색 가능한 메뉴 데이터베이스
  const searchableMenuItems = useMemo(() => [
    { title: '지도 동선 보기', category: '수급자 및 방문 관리', desc: '현재 GPS 위치 및 어르신 댁 위치 지도 확인', action: () => onNavigateTab ? onNavigateTab('map') : onBack(), icon: IconMapPin, iconColor: 'bg-[#007AFF]' },
    { title: '새 수급자 어르신 등록', category: '수급자 및 방문 관리', desc: '주소, 건강 특이사항, 공동현관 비번 등록', action: () => onOpenAddRecipient ? onOpenAddRecipient() : (onNavigateTab ? onNavigateTab('list') : onBack()), icon: IconUserPlus, iconColor: 'bg-[#34C759]' },
    { title: '수급자 어르신 명단 관리', category: '수급자 및 방문 관리', desc: '전체 등록 어르신 목록 및 연락처 검색', action: () => onNavigateTab ? onNavigateTab('list') : onBack(), icon: IconUsers, iconColor: 'bg-[#007AFF]' },
    { title: '오늘의 방문 일정 및 순서', category: '수급자 및 방문 관리', desc: '시간대별 방문 순서 확인 및 최적화', action: () => onNavigateTab ? onNavigateTab('route') : onBack(), icon: IconCalendarEvent, iconColor: 'bg-[#FF9500]' },
    { title: '구글 캘린더 일정 동기화', category: '공단 롱텀 행정 & 연동', desc: '스마트폰 구글 캘린더로 일정 내보내기', action: onSyncCalendar, icon: IconBrandGoogle, iconColor: 'bg-[#5856D6]' },
    { title: '급여제공 5대 필수 점검표', category: '현장 건강 바이탈 & 응급', desc: '체온, 혈압, 맥박, 복약, 식사, 낙상 안전 수칙', action: () => setShowChecklistGuide(true), icon: IconClipboardCheck, iconColor: 'bg-[#5856D6]' },
    { title: '현장 응급상황 대처 프로토콜', category: '현장 건강 바이탈 & 응급', desc: '낙상, 기도폐쇄(하임리히), 저혈당 쇼크 조치 요령', action: () => setShowFirstAidGuide(true), icon: IconFirstAidKit, iconColor: 'bg-[#FF3B30]' },
    { title: '119 응급구조 즉시 연결', category: '24시 긴급 핫라인', desc: '119 응급구조대 및 안전신고 직통 통화', href: 'tel:119', icon: IconAmbulance, iconColor: 'bg-[#FF3B30]' },
    { title: '국민건강보험공단 고객센터', category: '24시 긴급 핫라인', desc: '1577-1000 노인장기요양보험 수가 및 전산 문의', href: 'tel:1577-1000', icon: IconPhoneCall, iconColor: 'bg-[#007AFF]' },
    { title: '독거노인종합지원센터', category: '24시 긴급 핫라인', desc: '1661-2129 홀몸 어르신 안심망 및 위기 지원', href: 'tel:1661-2129', icon: IconPhoneCall, iconColor: 'bg-[#34C759]' },
    { title: '노인장기요양보험 포털 (롱텀)', category: '공단 롱텀 행정 & 연동', desc: 'longtermcare.or.kr 국민건강보험 공식 사이트', href: 'https://www.longtermcare.or.kr', external: true, icon: IconBuildingHospital, iconColor: 'bg-[#AF52DE]' },
    { title: '스마트장기요양 NFC 태그 오류 가이드', category: '공단 롱텀 행정 & 연동', desc: '현장 태그 미인식 시 기본모드 점검 및 조치', action: () => setShowRfidGuide(true), icon: IconAlertCircle, iconColor: 'bg-[#FF9500]' },
    { title: '기본 내비게이션 앱 변경', category: '길안내 및 모빌리티', desc: '네이버 지도, 카카오맵, 티맵 선택', action: () => setShowNaviPicker(true), icon: IconNavigation, iconColor: 'bg-[#007AFF]' },
    { title: '방문 예정 시간 스마트 푸시 알림', category: '알림 및 디스플레이', desc: 'PC 데스크톱 및 모바일 방문 시간 사전 리마인더', action: handleRequestNotification, icon: IconBellRinging, iconColor: 'bg-[#FF2D55]' },
    { title: '시스템 알림 테스트 발송', category: '알림 및 디스플레이', desc: '지금 즉시 알림 수신 여부 진단 테스트', action: handleTestNotification, icon: IconBell, iconColor: 'bg-[#FF9500]' },
    { title: '화면 테마 모드 (라이트/다크)', category: '알림 및 디스플레이', desc: '라이트, 다크, 시스템 자동 화면 전환', action: () => {}, icon: IconSun, iconColor: 'bg-[#8E8E93]' },
    { title: '앱 사용법 가이드 튜토리얼', category: '고객지원 및 시스템', desc: '핵심 기능 사용법 온보딩 다시 보기', action: onReplayTutorial, icon: IconHelp, iconColor: 'bg-[#30B0C7]' },
    { title: '전체 캐시 초기화 및 강력 새로고침', category: '고객지원 및 시스템', desc: '오프라인 캐시 및 브라우저 데이터 완전 갱신', action: async () => {
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
    }, icon: IconRefresh, iconColor: 'bg-[#FF3B30]' },
  ], [defaultNavi, onBack, onNavigateTab, onOpenAddRecipient, onReplayTutorial, onSyncCalendar]);

  // 검색 필터링된 결과
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableMenuItems.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [searchQuery, searchableMenuItems]);

  if (!mounted) return null;

  const currentNotifPerm = notifStatus?.permission || 'unsupported';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 overflow-y-auto px-4 pt-14 pb-36 bg-[#F2F2F7] dark:bg-[#000000] text-black dark:text-white transition-colors duration-300 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Pretendard',sans-serif]"
    >
      {/* Top Header: iOS / Toss / Kakao T Inspired Full Menu Header */}
      <div className="flex items-center justify-between mb-3 px-1 max-w-xl mx-auto">
        <div>
          <span className="text-[12px] font-black text-[#007AFF] uppercase tracking-wider block">
            CARE ROUTE MEGA WORKSPACE
          </span>
          <h1 className="text-[32px] font-extrabold tracking-tight text-black dark:text-white leading-none mt-1">
            전체 메뉴
          </h1>
        </div>

        {/* Done / Close Button */}
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] text-[#007AFF] font-bold text-[15px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] active:opacity-70 transition-opacity"
        >
          닫기
        </button>
      </div>

      <div className="space-y-5 max-w-xl mx-auto">

        {/* 1. Global In-Menu Search Capsule (토스/카카오T 스타일 즉시 검색) */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="메뉴나 기능을 검색하세요 (예: 등록, 119, 바이탈, 내비...)"
            className="w-full bg-white dark:bg-[#1C1C1E] rounded-[22px] py-3.5 pl-11 pr-10 text-[15px] font-bold text-black dark:text-white placeholder:text-[#8E8E93] border border-black/[0.05] dark:border-white/[0.08] shadow-xs outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
          />
          <IconSearch size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[#8E8E93] hover:text-black dark:hover:text-white transition-colors"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* 검색 결과가 있을 때: 실시간 검색 결과 리스트 */}
        {searchQuery.trim() !== '' ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 shadow-sm border border-black/[0.04] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            <div className="pb-2.5 px-1 flex items-center justify-between">
              <span className="text-xs font-bold text-[#8E8E93]">검색 결과 ({searchResults.length}건)</span>
              <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-[#007AFF]">전체 보기</button>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-12 text-center text-[#8E8E93]">
                <IconSearch size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-sm">일치하는 메뉴가 없습니다.</p>
                <p className="text-xs mt-1 text-[#8E8E93]/70">다른 검색어로 검색해보세요.</p>
              </div>
            ) : (
              searchResults.map((item, idx) => {
                const ItemIcon = item.icon;
                if (item.href) {
                  return (
                    <a
                      key={idx}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="py-3 px-1 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-[10px] ${item.iconColor} text-white flex items-center justify-center shrink-0`}>
                          <ItemIcon size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-black dark:text-white">{item.title}</p>
                          <p className="text-[12px] text-[#8E8E93]">{item.desc}</p>
                        </div>
                      </div>
                      <IconChevronRight size={16} className="text-[#C7C7CC]" />
                    </a>
                  );
                }

                return (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="w-full text-left py-3 px-1 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-[10px] ${item.iconColor} text-white flex items-center justify-center shrink-0`}>
                        <ItemIcon size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-black dark:text-white">{item.title}</p>
                        <p className="text-[12px] text-[#8E8E93]">{item.desc}</p>
                      </div>
                    </div>
                    <IconChevronRight size={16} className="text-[#C7C7CC]" />
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <>
            {/* 2. Today's Care Insights & Live Dashboard Card (실시간 급여제공 진행률) */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.08]">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <span className="text-[12px] font-bold text-[#8E8E93] dark:text-[#98989D] block">
                    {todayFormatted}
                  </span>
                  <h3 className="text-[19px] font-black text-black dark:text-white tracking-tight mt-0.5">
                    오늘의 급여제공 업무 현황
                  </h3>
                </div>
                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${
                  todayTotalCount === 0 
                    ? 'bg-[#8E8E93]/15 text-[#8E8E93]' 
                    : remainingVisits === 0 
                      ? 'bg-[#34C759]/15 text-[#34C759]' 
                      : 'bg-[#FF9500]/15 text-[#FF9500]'
                }`}>
                  {todayTotalCount === 0 ? '일정 없음' : remainingVisits === 0 ? '전체 완료 🎉' : `${remainingVisits}건 진행 중`}
                </span>
              </div>

              {/* 3-Column Metrics Stack */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3.5 rounded-[18px]">
                  <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#98989D] block">전체 수급자</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <strong className="text-[22px] font-black text-[#007AFF] tracking-tight">{totalRecipientsCount}</strong>
                    <span className="text-[12px] text-[#8E8E93] font-bold">명</span>
                  </div>
                </div>

                <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3.5 rounded-[18px]">
                  <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#98989D] block">오늘 완료</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <strong className="text-[22px] font-black text-[#34C759] tracking-tight">{todayCompletedCount}</strong>
                    <span className="text-[12px] text-[#8E8E93] font-bold">명</span>
                  </div>
                </div>

                <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] p-3.5 rounded-[18px]">
                  <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#98989D] block">남은 미방문</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <strong className="text-[22px] font-black text-[#FF9500] tracking-tight">{remainingVisits}</strong>
                    <span className="text-[12px] text-[#8E8E93] font-bold">명</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {todayTotalCount > 0 && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-[12px] font-bold text-[#8E8E93] dark:text-[#98989D]">
                    <span>오늘 방문 달성률</span>
                    <span className="text-[#34C759] font-black">{progressPercent}%</span>
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

              {/* Quick Action Navigation Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('route') : onBack()}
                  className="py-2.5 px-3 rounded-[16px] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-[#007AFF] text-[13px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <IconCalendarEvent size={16} strokeWidth={2.5} />
                  <span>오늘 일정 바로가기</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('list') : onBack()}
                  className="py-2.5 px-3 rounded-[16px] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-black dark:text-white text-[13px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <IconUsers size={16} strokeWidth={2.5} />
                  <span>수급자 명단 관리</span>
                </button>
              </div>
            </div>

            {/* 3. 8대 핵심 퀵 서비스 그리드 (토스/카카오T 벤토 Bento Grid) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2.5 block">
                핵심 퀵 서비스 (QUICK LAUNCH)
              </span>

              <div className="grid grid-cols-4 gap-2.5">
                {quickServices.map((service) => {
                  const SvgIcon = service.icon;
                  if (service.href) {
                    return (
                      <a
                        key={service.id}
                        href={service.href}
                        className="bg-white dark:bg-[#1C1C1E] p-3 rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all"
                      >
                        <div className={`w-10 h-10 rounded-[14px] ${service.color} flex items-center justify-center shadow-xs`}>
                          <SvgIcon size={20} strokeWidth={2.5} />
                        </div>
                        <span className="text-[12px] font-black text-black dark:text-white truncate max-w-full block">{service.title}</span>
                        <span className="text-[10px] text-[#8E8E93] truncate max-w-full block">{service.desc}</span>
                      </a>
                    );
                  }

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={service.action}
                      className="bg-white dark:bg-[#1C1C1E] p-3 rounded-[20px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-[14px] ${service.color} flex items-center justify-center shadow-xs`}>
                        <SvgIcon size={20} strokeWidth={2.5} />
                      </div>
                      <span className="text-[12px] font-black text-black dark:text-white truncate max-w-full block">{service.title}</span>
                      <span className="text-[10px] text-[#8E8E93] truncate max-w-full block">{service.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. 카테고리 1: 수급자 및 방문 관리 (CARE SERVICES) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                수급자 및 급여제공 관리
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                <button
                  onClick={() => onNavigateTab ? onNavigateTab('list') : onBack()}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0">
                      <IconUsers size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">전체 수급자 명단</span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">등록된 {totalRecipientsCount}명의 어르신 관리 및 검색</span>
                    </div>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>

                <button
                  onClick={() => onOpenAddRecipient ? onOpenAddRecipient() : (onNavigateTab ? onNavigateTab('list') : onBack())}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#34C759] text-white flex items-center justify-center shrink-0">
                      <IconUserPlus size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">신규 수급자 등록</span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">성함, 도로명 주소, 현관비번, 질환 정보 추가</span>
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 rounded-full">+ 등록</span>
                </button>

                <button
                  onClick={() => onNavigateTab ? onNavigateTab('route') : onBack()}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0">
                      <IconCalendarEvent size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">방문 일정 및 최적 경로</span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">월간 캘린더 및 일자별 방문 순서 지정</span>
                    </div>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>
              </div>
            </div>

            {/* 5. 카테고리 2: 건강 바이탈 & 응급 안전 (HEALTH & SAFETY) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                현장 건강 바이탈 및 응급 안전
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 급여제공 5대 필수 점검 및 바이탈 기준 */}
                <div>
                  <button
                    onClick={() => setShowChecklistGuide(!showChecklistGuide)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconClipboardCheck size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                          급여제공 5대 필수 점검 및 바이탈 기준
                        </span>
                        <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                          신체·인지·식사·낙상·정서 표준 체크리스트
                        </span>
                      </div>
                    </div>
                    <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showChecklistGuide ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showChecklistGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 py-3 bg-[#F9F9FB] dark:bg-[#161618] border-t border-black/[0.04] dark:border-white/[0.05] space-y-2.5 text-[13px]"
                      >
                        <div className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-white dark:bg-[#202022] border border-black/[0.03] dark:border-white/[0.05]">
                          <IconHeartbeat size={18} className="text-[#FF2D55] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-black dark:text-white font-bold block">1. 활력징후(바이탈) 표준 기준</strong>
                            <span className="text-[#8E8E93] dark:text-[#98989D] leading-relaxed block mt-0.5">
                              체온: 36.5℃ ± 0.5 · 혈압: 수축기 120 미만 / 이완기 80 미만 · 맥박: 분당 60~100회
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-white dark:bg-[#202022] border border-black/[0.03] dark:border-white/[0.05]">
                          <IconPill size={18} className="text-[#007AFF] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-black dark:text-white font-bold block">2. 정시 복약 상태 확인</strong>
                            <span className="text-[#8E8E93] dark:text-[#98989D] leading-relaxed block mt-0.5">
                              혈압약, 당뇨약 등 약포지 날짜/시간 일치 확인 및 식전·식후 구분 복약 지도
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-white dark:bg-[#202022] border border-black/[0.03] dark:border-white/[0.05]">
                          <IconSalad size={18} className="text-[#34C759] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-black dark:text-white font-bold block">3. 식사 섭취 및 수분 보충</strong>
                            <span className="text-[#8E8E93] dark:text-[#98989D] leading-relaxed block mt-0.5">
                              틀니 착용 상태, 연하(삼킴) 곤란 유무 확인, 1일 권장 수분 섭취(약 1L 권장)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-white dark:bg-[#202022] border border-black/[0.03] dark:border-white/[0.05]">
                          <IconEye size={18} className="text-[#FF9500] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-black dark:text-white font-bold block">4. 실내 낙상 위험 환경 예방</strong>
                            <span className="text-[#8E8E93] dark:text-[#98989D] leading-relaxed block mt-0.5">
                              화장실 바닥 물기 제거, 문턱 안전, 보행기(워커) 브레이크 이상 유무, 야간 조명 확보
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-white dark:bg-[#202022] border border-black/[0.03] dark:border-white/[0.05]">
                          <IconMoodSmile size={18} className="text-[#AF52DE] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-black dark:text-white font-bold block">5. 정서 지원 및 인지 자극</strong>
                            <span className="text-[#8E8E93] dark:text-[#98989D] leading-relaxed block mt-0.5">
                              오늘의 날짜·계절(지남력) 질문, 일상 말벗 대화 및 표정·인지 반응 관찰
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 어르신 응급상황 대처 프로토콜 */}
                <div>
                  <button
                    onClick={() => setShowFirstAidGuide(!showFirstAidGuide)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconFirstAidKit size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                          현장 응급상황 대처 프로토콜
                        </span>
                        <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                          낙상·기도폐쇄(하임리히)·저혈당 쇼크 조치법
                        </span>
                      </div>
                    </div>
                    <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showFirstAidGuide ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showFirstAidGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 py-3 bg-[#F9F9FB] dark:bg-[#161618] border-t border-black/[0.04] dark:border-white/[0.05] space-y-2.5 text-[13px]"
                      >
                        <div className="p-3 rounded-[14px] bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
                          <strong className="font-black block mb-1">🚨 낙상 발생 시</strong>
                          <p className="leading-relaxed">
                            무리하게 일으켜 세우지 마세요! 먼저 어르신의 의식과 호흡을 확인하고, 골절 의심 부위를 함부로 만지지 마신 후 119 및 센터장에게 즉각 보고하세요.
                          </p>
                        </div>

                        <div className="p-3 rounded-[14px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                          <strong className="font-black block mb-1">⚠️ 기도 폐쇄 (음식물 걸림) - 하임리히법</strong>
                          <p className="leading-relaxed">
                            말을 못 하고 목을 감싸 쥐면 즉시 119 신고 후 어르신 뒤에 서서 배꼽과 명치 사이에 주먹을 쥐고 다른 손으로 감싸 안으로 위쪽으로 빠르고 강하게 밀쳐 올립니다.
                          </p>
                        </div>

                        <div className="p-3 rounded-[14px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200">
                          <strong className="font-black block mb-1">💧 저혈당 쇼크 의심 시</strong>
                          <p className="leading-relaxed">
                            식은땀, 떨림, 어지럼증 호소 시: 의식이 있으면 사탕이나 과일주스(단물)를 섭취시킵니다. 의식이 없을 때는 질식 위험이 있으므로 절대 입에 아무것도 넣지 말고 즉시 119를 부르세요.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 119 Emergency Call */}
                <a
                  href="tel:119"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconAmbulance size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        119 응급구조 / 구급차 즉시 통화
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        어르신 낙상, 심정지, 의식저하 등 응급상황
                      </span>
                    </div>
                  </div>
                  <span className="text-[13px] font-black text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-1 rounded-full flex items-center gap-1">
                    <IconPhoneCall size={13} strokeWidth={2.5} /> 즉시 통화
                  </span>
                </a>

                {/* NHIS 1577-1000 */}
                <a
                  href="tel:1577-1000"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconPhoneCall size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        국민건강보험공단 (1577-1000)
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        노인장기요양보험 수가 및 전산 시스템 문의
                      </span>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-3 py-1 rounded-full flex items-center gap-1">
                    통화
                  </span>
                </a>

                {/* 독거노인종합지원센터 1661-2129 */}
                <a
                  href="tel:1661-2129"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconPhoneCall size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        독거노인종합지원센터 (1661-2129)
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        홀몸 어르신 위기 지원 및 돌봄망 상담
                      </span>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[#34C759] bg-[#34C759]/10 px-3 py-1 rounded-full flex items-center gap-1">
                    통화
                  </span>
                </a>
              </div>
            </div>

            {/* 6. 카테고리 3: 공단 롱텀 행정 & 캘린더 연동 (LONG-TERM CARE ADMIN) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                공단 롱텀 행정 및 캘린더 연동
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 롱텀 포털 링크 */}
                <a
                  href="https://www.longtermcare.or.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBuildingHospital size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        노인장기요양보험 포털 (공단 롱텀)
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        longtermcare.or.kr 바로가기
                      </span>
                    </div>
                  </div>
                  <IconExternalLink size={17} className="text-[#8E8E93]" />
                </a>

                {/* 구글 캘린더 동기화 */}
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBrandGoogle size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        구글 캘린더 방문 일정 동기화
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        스마트폰 캘린더로 방문 일정 내보내기
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onSyncCalendar}
                    disabled={isSyncingCalendar}
                    className="px-3.5 py-1.5 rounded-full bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] font-black text-[13px] active:opacity-70 disabled:opacity-50 transition-opacity flex items-center gap-1"
                  >
                    {isSyncingCalendar ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>동기화 실행</span>
                    )}
                  </button>
                </div>

                {/* 스마트장기요양 태그 가이드 */}
                <div>
                  <button
                    onClick={() => setShowRfidGuide(!showRfidGuide)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconAlertCircle size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                          스마트장기요양 태그(NFC) 오류 대처법
                        </span>
                        <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                          현장 태그 미인식 시 응급 조치 가이드
                        </span>
                      </div>
                    </div>
                    <IconChevronRight size={17} className={`text-[#C7C7CC] transition-transform ${showRfidGuide ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showRfidGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 py-3 bg-[#F9F9FB] dark:bg-[#161618] border-t border-black/[0.04] dark:border-white/[0.05] text-[13px] leading-relaxed space-y-2"
                      >
                        <p className="font-bold text-[#007AFF]">1. 스마트폰 NFC 설정 모드 확인</p>
                        <p className="text-[#8E8E93] dark:text-[#98989D]">
                          '카드 모드'가 아닌 반드시 <strong>'기본 모드'</strong>로 켜져 있어야 리더기 인식이 원활합니다.
                        </p>
                        <p className="font-bold text-[#007AFF] pt-1">2. 케이스 분리 후 3초간 밀착</p>
                        <p className="text-[#8E8E93] dark:text-[#98989D]">
                          신용카드나 금속이 포함된 두꺼운 케이스는 분리하고, 태그 중심에 기기 뒷면을 3초간 접촉하세요.
                        </p>
                        <p className="font-bold text-[#007AFF] pt-1">3. 태그 파손 시 즉시 센터 보고</p>
                        <p className="text-[#8E8E93] dark:text-[#98989D]">
                          인식이 계속 실패하면 현장 수기 기록지를 작성하고 센터에 즉시 통보하여 공단 예외 등록을 요청하세요.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* 7. 카테고리 4: 길안내 및 모빌리티 (NAVIGATION & MOBILITY) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                길안내 및 모빌리티 설정
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* Preferred Navigation Selector Row */}
                <div>
                  <button
                    onClick={() => setShowNaviPicker(!showNaviPicker)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconNavigation size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                          기본 내비게이션 앱
                        </span>
                        <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                          길안내 시작 시 즉시 연결
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-[#007AFF]">
                        {defaultNavi === 'kakao' ? '카카오맵' : defaultNavi === 'tmap' ? '티맵 (TMAP)' : '네이버 지도'}
                      </span>
                      <IconChevronRight size={17} className={`text-[#C7C7CC] transition-transform ${showNaviPicker ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {showNaviPicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-3.5 pt-1 border-t border-black/[0.04] dark:border-white/[0.05] bg-[#F9F9FB] dark:bg-[#161618]"
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
                              className={`py-3 px-2 rounded-[16px] border transition-all flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                                defaultNavi === item.id
                                  ? 'bg-white dark:bg-[#2C2C2E] border-[#007AFF] text-[#007AFF] font-black shadow-xs ring-2 ring-[#007AFF]/20'
                                  : 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] text-[#8E8E93] font-bold'
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

                {/* GPS Location Row */}
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#32ADE6] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconMapPin size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        위치 서비스 (GPS) 정밀도
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        인근 수급자 자동 탐색 및 동선 안내
                      </span>
                    </div>
                  </div>
                  <span className={`text-[13px] font-black px-2.5 py-1 rounded-full ${
                    locationPerm === 'granted' 
                      ? 'text-[#34C759] bg-[#34C759]/15' 
                      : locationPerm === 'denied' 
                        ? 'text-[#FF3B30] bg-[#FF3B30]/15' 
                        : 'text-[#8E8E93] bg-[#8E8E93]/15'
                  }`}>
                    {locationPerm === 'granted' ? '정상 허용됨 ✓' : locationPerm === 'denied' ? '차단됨 ⚠️' : '대기'}
                  </span>
                </div>
              </div>
            </div>

            {/* 8. 카테고리 5: 알림 및 화면 디스플레이 (PREFERENCES) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                알림 및 화면 디스플레이
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* Push Notifications Row */}
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF2D55] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBellRinging size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        방문 예정 시간 스마트 푸시
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        PC 및 모바일 시스템 푸시 알림
                      </span>
                    </div>
                  </div>

                  <div>
                    {currentNotifPerm === 'granted' && (
                      <span className="text-[13px] font-black text-[#34C759] bg-[#34C759]/15 px-3 py-1 rounded-full flex items-center gap-1">
                        <IconCheck size={13} strokeWidth={3} /> 정상 작동
                      </span>
                    )}
                    {currentNotifPerm === 'denied' && (
                      <span className="text-[13px] font-black text-[#FF3B30] bg-[#FF3B30]/15 px-3 py-1 rounded-full flex items-center gap-1">
                        <IconAlertTriangle size={13} strokeWidth={3} /> 차단됨
                      </span>
                    )}
                    {currentNotifPerm === 'default' && (
                      <button
                        onClick={handleRequestNotification}
                        disabled={isRequestingNotif}
                        className="text-[13px] font-black text-white bg-[#007AFF] px-3.5 py-1.5 rounded-full shadow-xs active:opacity-70 disabled:opacity-50"
                      >
                        {isRequestingNotif ? '요청 중...' : '권한 켜기'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Notification Row */}
                {currentNotifPerm === 'granted' && (
                  <button
                    onClick={handleTestNotification}
                    disabled={isTestingNotif}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconBell size={18} strokeWidth={2.5} />
                      </div>
                      <span className="text-[16px] font-bold text-[#007AFF] tracking-tight">
                        시스템 알림 즉시 테스트 발송
                      </span>
                    </div>
                    {isTestingNotif ? (
                      <div className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IconChevronRight size={17} className="text-[#C7C7CC]" />
                    )}
                  </button>
                )}

                {/* Screen Theme Mode */}
                <div className="px-4 py-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#8E8E93] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconSun size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">화면 모드 (테마)</span>
                  </div>

                  <div className="flex p-1 bg-[#E3E3E8] dark:bg-[#2C2C2E] rounded-[14px]">
                    {[
                      { id: 'light', label: '라이트', icon: <IconSun size={15} strokeWidth={2.5} /> },
                      { id: 'dark', label: '다크', icon: <IconMoonStars size={15} strokeWidth={2.5} /> },
                      { id: 'system', label: '자동 (시스템)', icon: <IconDeviceDesktop size={15} strokeWidth={2.5} /> },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex-1 py-2 rounded-[11px] font-black text-[13px] flex items-center justify-center gap-1.5 transition-all ${
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

                {/* Color Themes */}
                <div className="px-4 py-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconSparkles size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">강조 컬러 선택</span>
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

            {/* 9. 카테고리 6: 고객지원 및 시스템 관리 (SUPPORT & SYSTEM) */}
            <div>
              <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                고객지원 및 시스템 관리
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 튜토리얼 다시보기 */}
                <button
                  onClick={onReplayTutorial}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#30B0C7] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconHelp size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">
                      앱 사용법 가이드 다시 보기
                    </span>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>

                {/* 버전 정보 */}
                <a
                  href="https://github.com/LeeAn0121/CareRoute/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#48484A] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBrandGithub size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">버전 정보</span>
                  </div>
                  <span className="text-[14px] font-black text-[#007AFF]">v1.4.0 최신 배포본</span>
                </a>

                {/* 기능 제안 및 버그 제보 */}
                <a
                  href="https://github.com/LeeAn0121/CareRoute/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBug size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">현장 건의 및 기능 제안</span>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </a>

                {/* 캐시 초기화 및 강력 새로고침 */}
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
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconRefresh size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold tracking-tight">전체 캐시 초기화 및 강력 새로고침</span>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </motion.div>
  );
}
