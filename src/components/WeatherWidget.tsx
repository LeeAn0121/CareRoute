'use client';
import { useState, useEffect } from 'react';
import { IconWind, IconCloud, IconChevronDown, IconDroplet, IconThermometer, IconSparkles, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  WeatherData, 
  weatherCache, 
  getGridKey, 
  getLatestKnownWeather, 
  getWeatherEmojiAndDesc, 
  fetchWeatherForCoord 
} from '@/lib/weather';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  showWeatherGrid?: boolean;
  onToggleWeatherGrid?: () => void;
  modalOnly?: boolean;
}

export default function WeatherWidget({ 
  lat, 
  lng, 
  isOpen, 
  onToggle, 
  onClose,
  showWeatherGrid,
  onToggleWeatherGrid,
  modalOnly = false,
}: WeatherWidgetProps) {
  const gridKey = getGridKey(lat, lng, 0.02);
  const [weather, setWeather] = useState<WeatherData | null>(() => {
    const cached = weatherCache.get(gridKey);
    return cached ? cached.data : getLatestKnownWeather();
  });
  const [internalShowDetail, setInternalShowDetail] = useState(false);

  const showDetail = isOpen !== undefined ? isOpen : internalShowDetail;
  const handleToggle = onToggle || (() => setInternalShowDetail(!internalShowDetail));
  const handleClose = onClose || (() => setInternalShowDetail(false));

  useEffect(() => {
    // modalOnly 모드는 상세 모달이 열려 있을 때만 날씨를 조회한다 (지도 이동마다 불필요한 API 호출 방지)
    if (modalOnly && !showDetail) return;

    let isMounted = true;
    
    // Check in-memory cache first
    const cached = weatherCache.get(gridKey);
    if (cached) {
      setWeather(cached.data);
      return;
    }

    const timer = setTimeout(async () => {
      const data = await fetchWeatherForCoord(lat, lng, 0.02);
      if (isMounted && data) {
        setWeather(data);
      }
    }, 400);
    
    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, [gridKey, lat, lng, modalOnly, showDetail]);

  if (!weather) {
    // 모달 전용 모드에서는 헤더에 스켈레톤 캡슐을 노출하지 않는다
    if (modalOnly) return null;
    return (
      <div
        className="h-[50px] min-w-[78px] px-3.5 rounded-[25px] flex items-center justify-center gap-1.5 bg-surface/90 supports-[backdrop-filter]:bg-surface/80 border border-white/40 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)] text-foreground/40 animate-pulse select-none shrink-0"
        title="현장 날씨 정보 동기화 중..."
      >
        <span className="text-[17px] opacity-70">🌤️</span>
        <span className="text-[14px] font-extrabold opacity-60">--°</span>
      </div>
    );
  }

  const { emoji, desc } = getWeatherEmojiAndDesc(weather.pty);

  const getAqiText = (val: number) => {
    if (val <= 30) return <span className="text-blue-500 font-black">좋음</span>;
    if (val <= 80) return <span className="text-emerald-500 font-black">보통</span>;
    if (val <= 150) return <span className="text-orange-500 font-black">나쁨</span>;
    return <span className="text-red-500 font-black">매우나쁨</span>;
  };

  const getAqiText25 = (val: number) => {
    if (val <= 15) return <span className="text-blue-500 font-black">좋음</span>;
    if (val <= 35) return <span className="text-emerald-500 font-black">보통</span>;
    if (val <= 75) return <span className="text-orange-500 font-black">나쁨</span>;
    return <span className="text-red-500 font-black">매우나쁨</span>;
  };

  // 현장 케어 팁 산출
  let fieldCareTip = "외출 및 방문 케어에 좋은 날씨입니다.";
  if (weather.pty === "1") fieldCareTip = "우산 및 방수 장구를 지참하세요.";
  else if (weather.pty === "3") fieldCareTip = "빙판길 낙상 주의! 미끄럼 방지 신발 착용 권장";
  else if (weather.pm10 > 80 || weather.pm25 > 35) fieldCareTip = "미세먼지 농도가 높습니다. 마스크를 착용하세요.";
  else if (weather.tempApparent <= 3) fieldCareTip = "체감 온도가 낮습니다. 따뜻한 외투와 보온에 유의하세요.";
  else if (weather.tempApparent >= 28) fieldCareTip = "어르신 수분 섭취와 실내 환기에 유의하세요.";

  return (
    <div className={modalOnly ? '' : 'relative'}>
      {/* 컴팩트 날씨 캡슐 버튼 (modalOnly가 아닐 때만 렌더링) */}
      {!modalOnly && (
        <button
          type="button"
          onClick={handleToggle}
          className={`h-[50px] px-4 rounded-[25px] flex items-center gap-1.5 transition-all active:scale-95 border ${
            showDetail
              ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
              : 'bg-surface/90 supports-[backdrop-filter]:bg-surface/80 hover:bg-surface text-foreground/85 border-white/40 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'
          }`}
          title={`현재 날씨: ${desc} ${weather.temp}° (터치 시 상세 정보)`}
        >
          <span className="text-[18px] leading-none drop-shadow-2xs">{emoji}</span>
          <span className="text-[15px] font-black">{weather.temp}°</span>
          <IconChevronDown
            size={15}
            className={`transition-transform duration-200 ${showDetail ? 'rotate-180 text-primary-foreground' : 'text-foreground/40'}`}
          />
        </button>
      )}

      {/* 펼침 상세 정보 플로팅 카드 (독립 오버레이 - 헤더 레이아웃을 절대 깨뜨리지 않음) */}
      <AnimatePresence>
        {showDetail && (
          <>
            {/* 바깥 클릭 시 닫히는 투명 배경 오버레이 */}
            <div
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
              onClick={handleClose}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed top-[calc(env(safe-area-inset-top,0px)+68px)] left-3.5 right-3.5 max-w-[360px] mx-auto z-50 bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-[40px] saturate-200 rounded-[28px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-white/40 dark:border-white/10 text-foreground animate-in fade-in pointer-events-auto"
            >
              {/* 상단 타이틀 & 닫기 버튼 */}
              <div className="flex items-center justify-between pb-3 border-b border-surface-border/40 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl leading-none">{emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-black text-foreground">{desc} {weather.temp}°C</span>
                      <span className="text-[11px] font-bold text-foreground/50">({weather.tempMin}° / {weather.tempMax}°)</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground/50">현장 실시간 기상 안내</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-7 h-7 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/60 flex items-center justify-center transition-colors shrink-0 active:scale-95"
                  aria-label="닫기"
                >
                  <IconX size={15} strokeWidth={2.5} />
                </button>
              </div>

              {/* 지도 위 행정구역별 기상 그리드 토글 스위치 (One UI 9.0 Style) */}
              {onToggleWeatherGrid && (
                <div className="flex items-center justify-between p-3 rounded-[20px] bg-sky-500/10 border border-sky-500/20 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-[12px] bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                      <IconCloud size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[13px] font-black text-foreground block tracking-tight">행정구역별 기상 그리드</span>
                      <span className="text-[11px] font-bold text-foreground/50 block truncate">동/구 행정구역별 실시간 날씨 및 기온 표시</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleWeatherGrid}
                    className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 ml-2 ${
                      showWeatherGrid ? 'bg-sky-500' : 'bg-foreground/20'
                    }`}
                    aria-label="행정구역별 기상 그리드 토글"
                  >
                    <motion.div
                      animate={{ x: showWeatherGrid ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-6 h-6 rounded-full bg-white shadow-md"
                    />
                  </button>
                </div>
              )}

              {/* 4대 주요 기상 지표 그리드 */}
              <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
                <div className="flex items-center gap-2 bg-surface/80 rounded-[18px] p-2.5 border border-surface-border/40">
                  <IconThermometer size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-foreground/50 font-bold block">체감 온도</span>
                    <span className="text-[13px] font-black text-foreground">{weather.tempApparent}°C</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-surface/80 rounded-[18px] p-2.5 border border-surface-border/40">
                  <IconDroplet size={16} className="text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-foreground/50 font-bold block">강수량</span>
                    <span className="text-[13px] font-black text-foreground">{weather.rn1 ?? 0}mm</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-surface/80 rounded-[18px] p-2.5 border border-surface-border/40">
                  <IconWind size={16} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-foreground/50 font-bold block">미세먼지 ({weather.pm10})</span>
                    <span className="text-[12px] font-black">{getAqiText(weather.pm10)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-surface/80 rounded-[18px] p-2.5 border border-surface-border/40">
                  <IconCloud size={16} className="text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-foreground/50 font-bold block">초미세 ({weather.pm25})</span>
                    <span className="text-[12px] font-black">{getAqiText25(weather.pm25)}</span>
                  </div>
                </div>
              </div>

              {/* 방문 케어 가이드 팁 */}
              <div className="flex items-start gap-2 text-[11px] font-bold text-primary bg-primary/10 rounded-[18px] p-3 border border-primary/20">
                <IconSparkles size={16} className="shrink-0 text-primary mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-black block text-primary mb-0.5">방문 케어 안심 수칙</span>
                  <span>{fieldCareTip}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
