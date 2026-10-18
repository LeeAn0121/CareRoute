'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  IconSettings, IconChevronRight, IconChevronDown,
  IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, 
  IconBug, IconRefresh, IconBell, IconBellRinging, IconCheck, 
  IconAlertTriangle, IconInfoCircle, IconDeviceMobile,
  IconClock, IconBrandGoogle, IconCalendarEvent,
  IconMapPin, IconSparkles,
  IconHelp, IconDownload, IconUpload, IconDatabase,
  IconExternalLink, IconAlertCircle,
  IconSearch, IconX, IconTypography, IconShieldCheck
} from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import {
  getDetailedNotificationStatus,
  requestNotificationPermission,
  sendTestNotification,
  NotificationStatus
} from '@/lib/notifications';
import packageJson from '../../package.json';
import { supabase } from '@/lib/supabase';

const APP_VERSION = packageJson.version;

// 백업 파일에 들어갈 수 있는(=recipients 테이블에 실제 존재하는) 컬럼만 화이트리스트로 관리한다.
// 지도 화면에서 근접 마커를 서로 떨어뜨려 보여주기 위해 lat/lng를 화면용으로 틀어두는 로직이
// 있어서, 화면 상태(markers)를 그대로 내보내면 좌표가 조금씩 틀어진 채 백업/복원될 수 있다.
// 그래서 내보내기/복원 모두 이 화이트리스트로 걸러, 화면 전용 파생 필드가 섞여 들어가지 않게 한다.
const RECIPIENT_BACKUP_COLUMNS = [
  'id', 'name', 'address', 'detail_address', 'sido', 'sigungu', 'dong', 'lat', 'lng',
  'visit_time', 'notes', 'recurring_weekdays', 'photo_url', 'door_passcode', 'parking_memo',
  'health_tags', 'age', 'care_grade', 'last_completed_key', 'last_completed_memo', 'created_at',
  'assigned_caregiver_name',
] as const;

function pickRecipientColumns(row: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const col of RECIPIENT_BACKUP_COLUMNS) {
    if (row[col] !== undefined) picked[col] = row[col];
  }
  return picked;
}

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
  recipients?: any[];
  onDataRestored?: () => void;
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
  recipients = [],
  onDataRestored,
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const restoreInputRef = React.useRef<HTMLInputElement>(null);
  
  // 설정 검색어
  const [searchQuery, setSearchQuery] = useState('');

  // 방문 일정 기본 설정
  const [defaultDuration, setDefaultDuration] = useState('60');
  const [dimCompleted, setDimCompleted] = useState(true);

  // 알림 리드타임
  const [notifLeadTime, setNotifLeadTime] = useState('15');
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);

  // 큰 글씨 모드
  const [isLargeFont, setIsLargeFont] = useState(false);

  const refreshNotifStatus = async () => {
    const status = await getDetailedNotificationStatus();
    setNotifStatus(status);
  };

  useEffect(() => {
    setMounted(true);
    const savedColor = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    setColorTheme(savedColor);

    const savedDuration = localStorage.getItem('careroute_default_duration') || '60';
    setDefaultDuration(savedDuration);

    const savedDim = localStorage.getItem('careroute_dim_completed');
    if (savedDim !== null) setDimCompleted(savedDim === 'true');

    const savedLead = localStorage.getItem('careroute_notif_lead_time') || '15';
    setNotifLeadTime(savedLead);

    const savedLarge = localStorage.getItem('careroute_large_font') === 'true';
    setIsLargeFont(savedLarge);

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

  const handleDurationChange = (duration: string) => {
    setDefaultDuration(duration);
    localStorage.setItem('careroute_default_duration', duration);
  };

  const handleDimToggle = () => {
    const next = !dimCompleted;
    setDimCompleted(next);
    localStorage.setItem('careroute_dim_completed', String(next));
  };

  const handleLeadTimeChange = (time: string) => {
    setNotifLeadTime(time);
    localStorage.setItem('careroute_notif_lead_time', time);
  };

  const handleLargeFontToggle = () => {
    const next = !isLargeFont;
    setIsLargeFont(next);
    localStorage.setItem('careroute_large_font', String(next));
    if (next) {
      document.documentElement.classList.add('large-font-mode');
    } else {
      document.documentElement.classList.remove('large-font-mode');
    }
  };

  // 백업 파일 JSON 다운로드. 화면에 떠 있는 markers 상태(근접 마커를 서로 떨어뜨리려고
  // lat/lng를 화면용으로 틀어둔 상태)가 아니라, DB에서 원본 좌표를 새로 조회해서 내보낸다.
  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const { data, error } = await supabase.from('recipients').select('*');
      if (error) throw error;

      const dataToExport = {
        app: 'CareRoute',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        totalCount: data?.length ?? 0,
        recipients: (data || []).map(pickRecipientColumns),
      };

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `careroute_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedbackMessage({ type: 'success', text: `수급자 데이터 백업 파일(JSON)이 다운로드되었습니다.` });
    } catch (e) {
      console.error('백업 내보내기 실패', e);
      setFeedbackMessage({ type: 'error', text: '백업 생성에 실패했습니다.' });
    } finally {
      setIsExportingBackup(false);
    }
  };

  // 백업 JSON 파일을 다시 업로드해 recipients 테이블에 복원(id 기준 upsert)한다.
  // 기존 어르신은 백업 시점 내용으로 덮어써지므로, 적용 전 반드시 확인을 받는다.
  const handleRestoreFile = async (file: File) => {
    setIsRestoringBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows: unknown[] = Array.isArray(parsed?.recipients) ? parsed.recipients : [];
      if (rows.length === 0) {
        setFeedbackMessage({ type: 'error', text: '백업 파일에서 수급자 데이터를 찾을 수 없습니다.' });
        return;
      }

      const confirmed = window.confirm(
        `백업 파일에 담긴 ${rows.length}명의 수급자 데이터를 복원하시겠습니까?\n` +
        `이미 등록된 어르신은 백업 시점 내용으로 덮어써집니다(같은 ID 기준). 삭제되지는 않습니다.`
      );
      if (!confirmed) return;

      const payload = rows
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object' && typeof (r as Record<string, unknown>).id === 'string')
        .map((r) => pickRecipientColumns(r as Record<string, unknown>));

      if (payload.length === 0) {
        setFeedbackMessage({ type: 'error', text: '백업 파일 형식이 올바르지 않습니다(id 누락).' });
        return;
      }

      const { error } = await supabase.from('recipients').upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      setFeedbackMessage({ type: 'success', text: `${payload.length}명의 수급자 데이터를 복원했습니다.` });
      onDataRestored?.();
    } catch (e) {
      console.error('백업 복원 실패', e);
      setFeedbackMessage({ type: 'error', text: '백업 파일을 읽거나 복원하는 데 실패했습니다. 올바른 백업 파일인지 확인해주세요.' });
    } finally {
      setIsRestoringBackup(false);
    }
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
      if (notifStatus?.permission !== 'granted') {
        const resPerm = await requestNotificationPermission();
        await refreshNotifStatus();
        if (!resPerm.success) {
          if (resPerm.permission === 'denied') {
            setShowUnblockGuide(true);
            setFeedbackMessage({ type: 'error', text: '알림 권한이 차단되어 있습니다. 브라우저/기기 설정에서 허용해주세요.' });
          } else {
            setFeedbackMessage({ type: 'info', text: '알림 권한이 허용되어야 테스트 알림을 발송할 수 있습니다.' });
          }
          return;
        }
      }
      const res = await sendTestNotification();
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: '테스트 알림을 발송했습니다! 기기 상단/잠금화면 알림을 확인해보세요.' });
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || '알림 발송에 실패했습니다.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || '알림 발송 중 오류가 발생했습니다.' });
    } finally {
      setIsTestingNotif(false);
    }
  };

  const handleResetCache = async () => {
    if (!window.confirm('앱 캐시와 오프라인 데이터를 초기화하고 새로고침하시겠습니까?\n(등록된 수급자 데이터는 삭제되지 않습니다.)')) {
      return;
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
    try { localStorage.removeItem('careroute_pwa_install_dismissed'); } catch {}
    window.location.href = window.location.pathname + '?t=' + Date.now();
  };

  // 검색 가능한 설정 항목들
  const searchableSettings = useMemo(() => [
    { id: 'permission', category: '권한 상태', title: '위치 서비스 (GPS) 상태', desc: '내 위치 중심 지도 및 거리 계산 권한' },
    { id: 'calendar', category: '구글 캘린더 동기화', title: '구글 캘린더 방문 일정 동기화', desc: '스마트폰 캘린더로 당일 방문 일정 내보내기' },
    { id: 'duration', category: '구글 캘린더 동기화', title: '기본 방문 권장 시간', desc: '방문당 기본 일정 시간(30분~120분)' },
    { id: 'dim', category: '구글 캘린더 동기화', title: '완료된 일정 시각적 구분', desc: '오늘 완료된 어르신 카드 흐리게 처리' },
    { id: 'push', category: '알림 권한 상태', title: '알림 권한 상태', desc: '방문 예정 시간 시스템 푸시 알림 수신 상태' },
    { id: 'test-notif', category: '테스트 알림 발송', title: '테스트 알림 발송', desc: '실제 기기 상단/잠금화면 푸시 알림 즉시 시험 발송' },
    { id: 'lead', category: '알림 권한 상태', title: '사전 리마인더 알림 시점', desc: '방문 10분/15분/30분 전 알림' },
    { id: 'theme', category: '화면 및 디스플레이', title: '화면 모드 (테마)', desc: '라이트, 다크, 시스템 자동 모드' },
    { id: 'color', category: '화면 및 디스플레이', title: '강조 컬러 선택', desc: '포인트 컬러 스타일 변경' },
    { id: 'font', category: '화면 및 디스플레이', title: '큰 글씨 가독성 모드', desc: '가독성을 높이는 폰트 확대' },
    { id: 'backup', category: '데이터 및 저장공간', title: '수급자 데이터 백업 다운로드', desc: 'JSON 파일로 안전하게 보관' },
    { id: 'cache', category: '데이터 및 저장공간', title: '오프라인 캐시 초기화 및 강력 새로고침', desc: '오프라인 캐시 및 앱 새로고침' },
    { id: 'tutorial', category: '앱 정보 및 고객지원', title: '앱 사용법 가이드 튜토리얼', desc: '핵심 사용법 튜토리얼 다시 보기' },
    { id: 'version', category: '앱 정보 및 고객지원', title: '버전 정보', desc: `최신 정식 빌드 v${APP_VERSION}` },
    { id: 'support', category: '앱 정보 및 고객지원', title: '현장 개선 건의 및 버그 제보', desc: '기능 제안 및 버그 제보' },
  ], []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableSettings.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.desc.toLowerCase().includes(q) || 
      s.category.toLowerCase().includes(q)
    );
  }, [searchQuery, searchableSettings]);

  if (!mounted) return null;

  const currentNotifPerm = notifStatus?.permission || 'unsupported';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 overflow-y-auto px-4 pt-14 pb-36 bg-[#F2F2F7] dark:bg-[#000000] text-black dark:text-white transition-colors duration-300 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Pretendard',sans-serif]"
    >
      {/* Top Header: iOS Large Title Settings Header */}
      <div className="flex items-center justify-between mb-3 px-1 max-w-xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[13px] bg-primary/10 text-primary flex items-center justify-center">
            <IconSettings size={22} strokeWidth={2.4} />
          </div>
          <div>
            <span className="text-[11px] font-black text-primary uppercase tracking-wider block">
              PREFERENCES
            </span>
            <h1 className="text-[30px] font-extrabold tracking-tight text-black dark:text-white leading-none mt-0.5">
              설정
            </h1>
          </div>
        </div>

        {/* Done / Close Button */}
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-full bg-white dark:bg-[#1C1C1E] text-primary font-bold text-[14px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] active:scale-95 transition-all"
        >
          완료
        </button>
      </div>

      <div className="space-y-4 max-w-xl mx-auto">

        {/* CareRoute Caregiver Profile Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 shadow-xs border border-black/[0.04] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[18px] bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shadow-md shadow-[#007AFF]/25 shrink-0">
              <IconShieldCheck size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-black text-black dark:text-white tracking-tight">케어루트 현장 관리</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  정상 가동
                </span>
              </div>
              <p className="text-[12px] text-[#8E8E93] dark:text-[#98989D] mt-0.5 font-medium">
                등록 수급자 <strong className="text-black dark:text-white">{totalRecipientsCount}명</strong> · 맞춤 방문 케어
              </p>
            </div>
          </div>
        </div>

        {/* Feedback / Notification Toast */}
        <AnimatePresence>
          {feedbackMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className={`p-3.5 rounded-[20px] text-[13px] font-bold flex items-center justify-between shadow-xs border ${
                feedbackMessage.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' 
                  : feedbackMessage.type === 'error'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedbackMessage.type === 'success' && <IconCheck size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                {feedbackMessage.type === 'error' && <IconAlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400" />}
                {feedbackMessage.type === 'info' && <IconInfoCircle size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                <span>{feedbackMessage.text}</span>
              </div>
              <button 
                onClick={() => setFeedbackMessage(null)} 
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors ml-2"
              >
                <IconX size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="설정 항목 검색 (예: 권한, 캘린더, 알림, 테마, 백업...)"
            className="w-full bg-white dark:bg-[#1C1C1E] rounded-[20px] py-3 pl-11 pr-10 text-[14px] font-bold text-black dark:text-white placeholder:text-[#8E8E93] border border-black/[0.04] dark:border-white/[0.08] shadow-xs outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
          />
          <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[#8E8E93] hover:text-black dark:hover:text-white transition-colors"
            >
              <IconX size={13} />
            </button>
          )}
        </div>

        {/* 검색 결과가 있을 때: 실시간 필터 뷰 */}
        {searchQuery.trim() !== '' ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 shadow-xs border border-black/[0.04] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            <div className="pb-2.5 px-1 flex items-center justify-between">
              <span className="text-xs font-bold text-[#8E8E93]">검색 결과 ({searchResults.length}건)</span>
              <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-[#007AFF]">전체 보기</button>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-10 text-center text-[#8E8E93]">
                <IconSearch size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-sm">일치하는 설정이 없습니다.</p>
                <p className="text-xs mt-1 text-[#8E8E93]/70">권한, 캘린더, 알림, 테마, 백업 등으로 검색해보세요.</p>
              </div>
            ) : (
              searchResults.map((item) => (
                <div key={item.id} className="py-3 px-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#007AFF] tracking-wider block">{item.category}</span>
                    <p className="text-[15px] font-bold text-black dark:text-white mt-0.5">{item.title}</p>
                    <p className="text-[12px] text-[#8E8E93]">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setTimeout(() => {
                        document.getElementById(`section-${item.id}`)?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-black"
                  >
                    이동
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {/* 1. 권한 상태 (PERMISSION STATUS) */}
            <div id="section-permission">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                권한 상태
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* GPS 위치 서비스 상태 */}
                <div id="section-gps" className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#32ADE6] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconMapPin size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        위치 서비스 (GPS) 상태
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                        내 위치 중심 지도 및 거리 계산 권한
                      </span>
                    </div>
                  </div>
                  <span className={`text-[12px] font-black px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${
                    locationPerm === 'granted' 
                      ? 'text-[#34C759] bg-[#34C759]/15' 
                      : locationPerm === 'denied' 
                        ? 'text-[#FF3B30] bg-[#FF3B30]/15' 
                        : 'text-[#8E8E93] bg-[#8E8E93]/15'
                  }`}>
                    {locationPerm === 'granted' ? '정상 허용됨 ✓' : locationPerm === 'denied' ? '차단됨 ⚠️' : '확인 중'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 구글 캘린더 동기화 (GOOGLE CALENDAR SYNC) */}
            <div id="section-calendar">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                구글 캘린더 동기화
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 구글 캘린더 동기화 */}
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBrandGoogle size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        구글 캘린더 방문 일정 동기화
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                        스마트폰 캘린더로 당일 방문 일정 내보내기
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onSyncCalendar}
                    disabled={isSyncingCalendar}
                    className="px-3.5 py-1.5 rounded-full bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] font-black text-[13px] active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    {isSyncingCalendar ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <IconCalendarEvent size={15} strokeWidth={2.4} className="shrink-0" />
                        <span className="whitespace-nowrap">지금 동기화</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 기본 방문 소요 시간 (30분 / 60분 / 90분 / 120분) */}
                <div id="section-duration" className="px-4 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconClock size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        기본 방문 권장 시간
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        방문 일정 생성 시 기본 종료 시각 산정 기준
                      </span>
                    </div>
                  </div>

                  <div className="flex p-1 bg-[#E3E3E8] dark:bg-[#2C2C2E] rounded-[14px] mt-1">
                    {[
                      { val: '30', label: '30분' },
                      { val: '60', label: '60분' },
                      { val: '90', label: '90분' },
                      { val: '120', label: '120분' },
                    ].map(d => (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => handleDurationChange(d.val)}
                        className={`flex-1 py-1.5 rounded-[11px] font-black text-[12px] transition-all ${
                          defaultDuration === d.val
                            ? 'bg-white dark:bg-[#636366] text-black dark:text-white shadow-xs'
                            : 'text-[#6D6D72] dark:text-[#AEAEB2] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 당일 완료된 방문 흐리게 보기 */}
                <div id="section-dim" className="px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                      완료된 일정 시각적 구분
                    </span>
                    <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                      오늘 방문 완료된 어르신 카드 흐리게 처리
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDimToggle}
                    className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                      dimCompleted ? 'bg-[#34C759]' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                      dimCompleted ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. 알림 권한 상태 및 테스트 발송 (NOTIFICATIONS & TEST) */}
            <div id="section-push">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                알림 권한 상태 및 테스트 알림 발송
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 푸시 알림 상태 및 켜기 */}
                <div className="px-4 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF2D55] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconBellRinging size={18} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                          알림 권한 상태
                        </span>
                        <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                          방문 예정 시간 시스템 푸시 알림 권한
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 whitespace-nowrap">
                      {currentNotifPerm === 'granted' && (
                        <span className="text-[12px] font-black text-[#34C759] bg-[#34C759]/15 px-3 py-1 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
                          <IconCheck size={13} strokeWidth={3} className="shrink-0" /> 정상 작동
                        </span>
                      )}
                      {currentNotifPerm === 'denied' && (
                        <button
                          type="button"
                          onClick={() => setShowUnblockGuide(prev => !prev)}
                          className="text-[12px] font-black text-[#FF3B30] bg-[#FF3B30]/15 px-3 py-1 rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity shrink-0 whitespace-nowrap"
                        >
                          <IconAlertTriangle size={13} strokeWidth={3} className="shrink-0" /> 차단됨 (해제법)
                        </button>
                      )}
                      {currentNotifPerm === 'default' && (
                        <button
                          onClick={handleRequestNotification}
                          disabled={isRequestingNotif}
                          className="text-[12px] font-black text-white bg-[#007AFF] px-3.5 py-1.5 rounded-full shadow-xs active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
                        >
                          {isRequestingNotif ? '요청 중...' : '권한 켜기'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 차단 해제 안내 아코디언 */}
                  <AnimatePresence>
                    {showUnblockGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[16px] text-[12px] text-amber-800 dark:text-amber-200 space-y-1 mt-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>🔔 알림 차단 해제 방법</span>
                          <button onClick={() => setShowUnblockGuide(false)} className="text-xs hover:opacity-70">닫기</button>
                        </div>
                        <p>• <strong>스마트폰 (Safari/Chrome):</strong> 주소창 좌측 자물쇠 또는 사이트 설정 &gt; 알림 &gt; &apos;허용&apos;으로 변경</p>
                        <p>• <strong>PC 브라우저:</strong> 브라우저 설정 &gt; 개인정보 보호 및 보안 &gt; 사이트 설정 &gt; 알림 &gt; &apos;허용&apos; 추가</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 테스트 알림 발송 */}
                <div id="section-test-notif" className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBell size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        테스트 알림 발송
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                        실제 기기 상단/잠금화면 푸시 알림 즉시 시험 발송
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={isTestingNotif}
                    className="px-3.5 py-1.5 rounded-full bg-[#FF9500]/10 hover:bg-[#FF9500]/20 text-[#FF9500] font-black text-[13px] active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    {isTestingNotif ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <IconBellRinging size={15} strokeWidth={2.4} className="shrink-0" />
                        <span className="whitespace-nowrap">지금 발송</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 사전 알림 리드타임 설정 */}
                <div id="section-lead" className="px-4 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        사전 리마인더 알림 시점
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        방문 시작 전 알림을 미리 보낼 시간
                      </span>
                    </div>
                  </div>

                  <div className="flex p-1 bg-[#E3E3E8] dark:bg-[#2C2C2E] rounded-[14px]">
                    {[
                      { val: '10', label: '10분 전' },
                      { val: '15', label: '15분 전' },
                      { val: '30', label: '30분 전' },
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => handleLeadTimeChange(item.val)}
                        className={`flex-1 py-1.5 rounded-[11px] font-black text-[12px] transition-all ${
                          notifLeadTime === item.val
                            ? 'bg-white dark:bg-[#636366] text-black dark:text-white shadow-xs'
                            : 'text-[#6D6D72] dark:text-[#AEAEB2] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 화면 및 디스플레이 (APPEARANCE & DISPLAY) */}
            <div id="section-theme">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                화면 및 디스플레이
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 다크/라이트 화면 모드 */}
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
                        type="button"
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

                {/* 강조 컬러 테마 */}
                <div id="section-color" className="px-4 py-3.5 flex flex-col gap-2.5">
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
                        type="button"
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

                {/* 어르신/현장 맞춤 큰 글씨 가독성 모드 */}
                <div id="section-font" className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconTypography size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        큰 글씨 가독성 모드
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        야외 현장 및 어르신 카드 글자 크기 확대
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLargeFontToggle}
                    className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                      isLargeFont ? 'bg-[#34C759]' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                      isLargeFont ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* 5. 데이터 및 저장공간 관리 (DATA & STORAGE) */}
            <div id="section-backup">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                데이터 및 저장공간
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 수급자 명단 JSON 백업 내보내기 */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExportingBackup}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors gap-3 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconDownload size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        수급자 명단 데이터 백업 (JSON)
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                        등록된 {totalRecipientsCount}명의 명단을 파일로 안전하게 다운로드
                      </span>
                    </div>
                  </div>
                  <span className="text-[12px] font-black text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                    {isExportingBackup ? '내보내는 중...' : '내보내기'}
                  </span>
                </button>

                {/* 백업 JSON 파일로 복원(id 기준 upsert) */}
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={isRestoringBackup}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors gap-3 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconUpload size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">
                        백업 파일로 데이터 복원 (JSON)
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] block truncate">
                        내보낸 백업 파일을 불러와 수급자 명단을 복원
                      </span>
                    </div>
                  </div>
                  <span className="text-[12px] font-black text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                    {isRestoringBackup ? '복원 중...' : '복원'}
                  </span>
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleRestoreFile(file);
                  }}
                />

                {/* 전체 캐시 초기화 및 강력 새로고침 */}
                <button
                  type="button"
                  id="section-cache"
                  onClick={handleResetCache}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors text-[#FF3B30]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconRefresh size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold tracking-tight block">
                        오프라인 캐시 초기화 및 강력 새로고침
                      </span>
                      <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                        서비스 워커 및 임시 캐시 데이터 완전 갱신
                      </span>
                    </div>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>
              </div>
            </div>

            {/* 6. 앱 정보 및 고객지원 (ABOUT & SUPPORT) */}
            <div id="section-tutorial">
              <span className="text-[12px] font-black text-[#6D6D72] dark:text-[#8E8E93] uppercase tracking-wider ml-4 mb-2 block">
                앱 정보 및 고객지원
              </span>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-xs border border-black/[0.04] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {/* 튜토리얼 온보딩 다시보기 */}
                <button
                  type="button"
                  onClick={onReplayTutorial}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#30B0C7] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconHelp size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">
                      앱 사용법 가이드 튜토리얼 다시 보기
                    </span>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </button>

                {/* 버전 정보 */}
                <a
                  id="section-version"
                  href="https://github.com/LeeAn0121/CareRoute/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#48484A] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBrandGithub size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[16px] font-bold text-black dark:text-white tracking-tight block">버전 정보</span>
                      <span className="text-[12px] text-[#8E8E93]">최신 정식 빌드</span>
                    </div>
                  </div>
                  <span className="text-[14px] font-black text-[#007AFF]">v{APP_VERSION}</span>
                </a>

                {/* 기능 제안 및 버그 제보 */}
                <a
                  id="section-support"
                  href="https://github.com/LeeAn0121/CareRoute/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 flex items-center justify-between active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[32px] h-[32px] rounded-[10px] bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconBug size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[16px] font-bold text-black dark:text-white tracking-tight">
                      현장 개선 건의 및 버그 제보
                    </span>
                  </div>
                  <IconChevronRight size={17} className="text-[#C7C7CC]" />
                </a>
              </div>
            </div>

            {/* Bottom Copyright */}
            <div className="pt-2 pb-6 text-center text-[#8E8E93] dark:text-[#636366] text-[11px] font-medium leading-relaxed">
              <p className="font-bold text-[#8E8E93]">CareRoute · 어르신 방문 요양 솔루션</p>
              <p className="mt-0.5">안전하고 정직한 방문 요양 환경을 만들어갑니다</p>
            </div>
          </>
        )}

      </div>
    </motion.div>
  );
}
