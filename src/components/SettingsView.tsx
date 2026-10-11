import React, { useState, useEffect } from 'react';
import { 
  IconPalette, IconHelp, IconShieldLock, IconChevronRight, 
  IconMoonStars, IconSun, IconDeviceDesktop, IconBrandGithub, 
  IconBug, IconRefresh, IconBell, IconBellRinging, IconCheck, 
  IconAlertTriangle, IconInfoCircle, IconDeviceMobile 
} from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getDetailedNotificationStatus, 
  requestNotificationPermission, 
  sendTestNotification, 
  NotificationStatus 
} from '@/lib/notifications';

interface SettingsViewProps {
  onReplayTutorial: () => void;
  onBack: () => void;
  onSyncCalendar?: () => void;
  isSyncingCalendar?: boolean;
}

const colorThemes = [
  { id: 'theme-navy', name: '블랙/화이트', color: 'bg-[#1C1C1E] dark:bg-white' },
  { id: 'theme-blue', name: '블루', color: 'bg-[#007AFF]' },
  { id: 'theme-emerald', name: '에메랄드', color: 'bg-[#34C759]' },
  { id: 'theme-rose', name: '로즈', color: 'bg-[#FF2D55]' },
  { id: 'theme-purple', name: '퍼플', color: 'bg-[#AF52DE]' },
  { id: 'theme-teal', name: '틸', color: 'bg-[#32ADE6]' },
];

export default function SettingsView({ onReplayTutorial, onBack, onSyncCalendar, isSyncingCalendar }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('theme-navy');
  const [locationPerm, setLocationPerm] = useState('확인 중...');
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);

  const refreshNotifStatus = async () => {
    const status = await getDetailedNotificationStatus();
    setNotifStatus(status);
  };

  useEffect(() => {
    setMounted(true);
    const current = localStorage.getItem('careroute_color_theme') || 'theme-navy';
    setColorTheme(current);

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
    if (status === 'granted') return <span className="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-md text-xs">허용됨</span>;
    if (status === 'denied') return <span className="text-red-500 font-bold bg-red-500/10 px-2.5 py-1 rounded-md text-xs">거부됨</span>;
    if (status === 'prompt' || status === 'default') return <span className="text-foreground/50 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">요청 전</span>;
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
        // Send initial confirmation test notification
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
      className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-surface-muted/50 supports-[backdrop-filter]:bg-surface-muted/30 backdrop-blur-[40px] saturate-200 text-foreground transition-colors duration-500"
    >
      <div className="flex items-center gap-4 mb-8 px-2">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-colors"
          aria-label="뒤로가기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 className="text-[34px] font-black tracking-tighter text-foreground">메뉴</h2>
      </div>

      <div className="space-y-8">
        {/* Sync Section */}
        <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-[13px] font-black text-primary/80 uppercase tracking-wider mb-2 pl-2">데이터 동기화</h2>
          <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
            <button 
              onClick={onSyncCalendar}
              disabled={isSyncingCalendar}
              className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-muted transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <IconRefresh size={18} className="text-blue-500" />
                </div>
                <div>
                  <span className="font-bold text-[16px] tracking-tight block">구글 캘린더 동기화</span>
                  <span className="text-[12px] text-foreground/50">선택한 날짜의 일정을 구글 캘린더로 내보냅니다</span>
                </div>
              </div>
              {isSyncingCalendar ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <IconChevronRight size={20} className="text-foreground/30" />
              )}
            </button>
          </div>
        </section>

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

        {/* Permissions & Diagnostics Center */}
        <section>
          <div className="px-4 mb-2 mt-6">
            <span className="text-[13px] font-bold text-foreground/50 uppercase tracking-wider">개인정보 및 시스템 권한</span>
          </div>

          <div className="bg-surface/80 supports-[backdrop-filter]:bg-surface/50 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-surface-border/50 overflow-hidden flex flex-col">
            {/* Location Permission */}
            <div className="flex items-center justify-between p-4 border-b border-surface-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <IconShieldLock size={18} />
                </div>
                <div>
                  <span className="font-bold text-[16px] tracking-tight block">위치 정보</span>
                  <span className="text-[12px] text-foreground/50">현재 GPS 위치 자동 감지 및 지도 포커싱</span>
                </div>
              </div>
              {translateLocationPerm(locationPerm)}
            </div>

            {/* Notification Permission & Diagnostics */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <IconBellRinging size={18} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] tracking-tight block">시스템 알림 (방문 일정)</span>
                    <span className="text-[12px] text-foreground/50">
                      {currentNotifPerm === 'granted' 
                        ? '어르신 방문 예정 시간 푸시 알림 수신 중' 
                        : currentNotifPerm === 'denied'
                          ? '알림이 차단되어 알림을 받을 수 없습니다'
                          : '방문 시간 알림을 받으려면 권한 허용이 필요합니다'}
                    </span>
                  </div>
                </div>

                <div>
                  {currentNotifPerm === 'granted' && (
                    <span className="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-md text-xs flex items-center gap-1">
                      <IconCheck size={14} /> 허용됨
                    </span>
                  )}
                  {currentNotifPerm === 'denied' && (
                    <span className="text-red-500 font-bold bg-red-500/10 px-2.5 py-1 rounded-md text-xs flex items-center gap-1">
                      <IconAlertTriangle size={14} /> 차단됨
                    </span>
                  )}
                  {currentNotifPerm === 'default' && (
                    <span className="text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded-md text-xs">
                      요청 대기
                    </span>
                  )}
                  {currentNotifPerm === 'unsupported' && (
                    <span className="text-foreground/40 font-bold bg-surface-muted px-2.5 py-1 rounded-md text-xs">
                      지원 안 함
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback Message Banner */}
              <AnimatePresence>
                {feedbackMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      feedbackMessage.type === 'success' ? 'bg-primary/10 text-primary' :
                      feedbackMessage.type === 'error' ? 'bg-red-500/10 text-red-500' :
                      'bg-surface-muted text-foreground/80'
                    }`}
                  >
                    <IconInfoCircle size={16} className="shrink-0" />
                    <span>{feedbackMessage.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons depending on status */}
              <div className="pt-1 flex flex-col gap-2">
                {currentNotifPerm === 'granted' && (
                  <button
                    onClick={handleTestNotification}
                    disabled={isTestingNotif}
                    className="w-full py-2.5 px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                  >
                    <IconBell size={16} />
                    {isTestingNotif ? '테스트 알림 발송 중...' : '🔔 시스템 알림 테스트 보내기'}
                  </button>
                )}

                {currentNotifPerm === 'default' && (
                  <button
                    onClick={handleRequestNotification}
                    disabled={isRequestingNotif}
                    className="w-full py-3 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-black text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                  >
                    <IconBellRinging size={18} />
                    {isRequestingNotif ? '권한 요청 진행 중...' : '🔔 알림 권한 허용하고 켜기'}
                  </button>
                )}

                {currentNotifPerm === 'denied' && (
                  <button
                    onClick={() => setShowUnblockGuide(!showUnblockGuide)}
                    className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/15 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <IconInfoCircle size={16} />
                    {showUnblockGuide ? '알림 차단 해제 방법 접기' : '💡 알림 차단 해제 방법 보기'}
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
                    className="mt-2 p-4 rounded-2xl bg-foreground/[0.03] border border-surface-border text-xs leading-relaxed space-y-3"
                  >
                    <p className="font-bold text-[13px] text-foreground">브라우저별 알림 권한 해제 방법</p>
                    
                    <div className="space-y-1">
                      <p className="font-bold text-primary">1. 크롬 / 엣지 / 네이버 웨일</p>
                      <p className="text-foreground/70">상단 주소창 왼쪽의 자물쇠(또는 설정 슬라이더) 🔒 아이콘 클릭 → [알림] 설정을 '허용'으로 변경한 후 페이지를 새로고침하세요.</p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-bold text-primary">2. 맥(Mac) 사파리(Safari)</p>
                      <p className="text-foreground/70">상단 메뉴바의 [Safari] → [설정] → [웹사이트] 탭 → 좌측 [알림] 선택 → CareRoute 항목을 '허용'으로 설정하세요.</p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-bold text-primary">3. 아이폰 / 아이패드 (iOS Safari)</p>
                      <p className="text-foreground/70">아이폰에서는 애플 정책상 웹 브라우저 탭에서 웹 알림이 제한됩니다. Safari 하단 [공유] → [홈 화면에 추가]를 진행하신 후 앱으로 실행하여 알림을 켜주세요.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* iOS Non-Standalone Banner */}
              {notifStatus?.isIOS && !notifStatus?.isStandalone && (
                <div className="mt-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <IconDeviceMobile size={18} className="shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-black block mb-0.5">아이폰(iOS) 사용자 필독 안내</span>
                    <span>애플 정책상 사파리 브라우저 창에서는 웹 푸시가 제한됩니다. 사파리 하단 <strong>공유(사각형에 화살표) 아이콘</strong>을 누르고 <strong>[홈 화면에 추가]</strong>를 하신 후 실행하셔야 방문 알림이 정상 작동합니다.</span>
                  </div>
                </div>
              )}
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
                  <span className="font-bold text-[16px] tracking-tight">버전 정보 (v1.4.0)</span>
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
