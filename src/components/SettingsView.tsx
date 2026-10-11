'use client';
import React, { useState, useEffect } from 'react';
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
  IconExternalLink, IconAlertCircle, IconStethoscope, IconActivity
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

  if (!mounted) return null;

  const currentNotifPerm = notifStatus?.permission || 'unsupported';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 overflow-y-auto px-4 pt-14 pb-36 bg-[#F2F2F7] dark:bg-[#000000] text-black dark:text-white transition-colors duration-300 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Pretendard',sans-serif]"
    >
      {/* iOS Large Title Header with Care Hub Identity */}
      <div className="flex items-center justify-between mb-4 px-1 max-w-xl mx-auto">
        <div>
          <span className="text-[12px] font-bold text-[#007AFF] uppercase tracking-wider block">
            EASYCARE · LONGTERMCARE WORKSPACE
          </span>
          <h1 className="text-[32px] font-extrabold tracking-tight text-black dark:text-white leading-none mt-1">
            케어허브
          </h1>
        </div>

        {/* Done / Close Button */}
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] text-[#007AFF] font-bold text-[15px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] active:opacity-70 transition-opacity"
        >
          완료
        </button>
      </div>

      <div className="space-y-6 max-w-xl mx-auto">
        
        {/* 1. Official Agency Identity Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4.5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.08] flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-[18px] bg-[#007AFF]/10 p-1 flex items-center justify-center shrink-0 border border-black/[0.05] dark:border-white/[0.1] shadow-2xs">
            <img src="/CareRoute/icon-192.png" alt="CareRoute Logo" className="w-full h-full object-cover rounded-[14px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-black text-black dark:text-white tracking-tight truncate">
                케어루트 장기요양 포털
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-[#34C759]/15 text-[#34C759] rounded-full shrink-0">
                <IconCheck size={11} strokeWidth={3} /> 공단 지침 연계
              </span>
            </div>
            <p className="text-[13px] text-[#8E8E93] dark:text-[#98989D] font-medium truncate mt-0.5">
              이지케어 · 롱텀케어 기반 현장 급여제공 업무 지원 센터
            </p>
          </div>
        </div>

        {/* 2. Today's Care Insights & Live Dashboard Card (이지케어 실시간 진도율) */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <span className="text-[12px] font-bold text-[#8E8E93] dark:text-[#98989D] block">
                {todayFormatted}
              </span>
              <h3 className="text-[19px] font-extrabold text-black dark:text-white tracking-tight mt-0.5">
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
              <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#98989D] block">오늘 케어 완료</span>
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
              <span>오늘 일정 확인</span>
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

        {/* 3. 이지케어 특화: 현장 급여제공 기록 & 케어 지원 (FIELD CARE TOOLS) */}
        <div>
          <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            현장 케어 및 기록 지원 (EASYCARE TOOLS)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* 3-1. 급여제공 5대 필수 점검 및 바이탈 표준 가이드 */}
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

            {/* 3-2. 어르신 응급상황 대처 프로토콜 */}
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

            {/* 3-3. 구글 캘린더 동기화 */}
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
                    어르신 일정표를 스마트폰 캘린더로 내보내기
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

          </div>
        </div>

        {/* 4. 롱텀케어 특화: 공단 및 긴급 핫라인 센터 (LONG-TERM CARE CENTER) */}
        <div>
          <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            공단 연계 및 긴급 핫라인 (LONG-TERM CARE CENTER)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* 119 Emergency */}
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
                    119 응급구조 / 119안전센터
                  </span>
                  <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                    어르신 낙상, 심정지, 의식저하 등 응급상황
                  </span>
                </div>
              </div>
              <span className="text-[13px] font-black text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-1 rounded-full flex items-center gap-1">
                <IconPhoneCall size={13} strokeWidth={2.5} /> 즉시 연결
              </span>
            </a>

            {/* NHIS Long-Term Care Insurance */}
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

            {/* Comprehensive Support Center for Elderly Living Alone */}
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

            {/* National Long-Term Care Web Portal Direct Link */}
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
              <IconExternalLink size={17} className="text-[#8E8E93] dark:text-[#98989D]" />
            </a>

            {/* Smart Long-Term Care Tag (NFC) Troubleshooting Guide */}
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
                <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showRfidGuide ? 'rotate-90' : ''}`} />
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

        {/* 5. 길안내 및 모빌리티 (NAVIGATION & GPS) */}
        <div>
          <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            길안내 및 모빌리티 (NAVIGATION)
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
                  <IconChevronRight size={17} className={`text-[#C7C7CC] dark:text-[#48484A] transition-transform ${showNaviPicker ? 'rotate-90' : ''}`} />
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
                {locationPerm === 'granted' ? '허용됨 ✓' : locationPerm === 'denied' ? '차단됨 ⚠️' : '대기'}
              </span>
            </div>

          </div>
        </div>

        {/* 6. 스마트 방문 알림 및 시스템 (NOTIFICATIONS & DISPLAY) */}
        <div>
          <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            알림 및 화면 디스플레이 (PREFERENCES)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* Visit Notifications Status Row */}
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
                    PC 데스크톱 및 모바일 푸시 알림
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

            {/* Notification Test Action Button Row */}
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
                  <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
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

            {/* Apple Accent Palette Chips */}
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

        {/* 7. 시스템 관리 및 고객 지원 (SYSTEM & SUPPORT) */}
        <div>
          <span className="text-[13px] font-bold text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
            시스템 관리 및 고객 지원 (SUPPORT)
          </span>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            
            {/* Replay Tutorial */}
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
                <div className="w-[32px] h-[32px] rounded-[10px] bg-[#48484A] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconBrandGithub size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">버전 정보</span>
              </div>
              <span className="text-[14px] font-black text-[#007AFF]">v1.4.0 최신 배포본</span>
            </a>

            {/* Bug Report */}
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
                <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconRefresh size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[16px] font-bold tracking-tight">전체 캐시 초기화 및 강력 새로고침</span>
              </div>
              <IconChevronRight size={17} className="text-[#C7C7CC] dark:text-[#48484A]" />
            </button>

          </div>
        </div>

      </div>
    </motion.div>
  );
}
