'use client';
import { useState, useEffect } from 'react';
import { IconWind, IconCloud, IconChevronDown, IconDroplet, IconThermometer, IconSparkles, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

interface WeatherData {
  temp: number;
  tempApparent: number;
  tempMax: number;
  tempMin: number;
  pty: string;
  rn1: number;
  pm10: number;
  pm25: number;
}

export default function WeatherWidget({ lat, lng, isOpen, onToggle, onClose }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalShowDetail, setInternalShowDetail] = useState(false);

  const showDetail = isOpen !== undefined ? isOpen : internalShowDetail;
  const handleToggle = onToggle || (() => setInternalShowDetail(!internalShowDetail));
  const handleClose = onClose || (() => setInternalShowDetail(false));

  useEffect(() => {
    let isMounted = true;
    
    async function fetchWeather() {
      try {
        setLoading(true);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`;
        const res = await fetch(url);
        const data = await res.json();
        
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5&timezone=Asia%2FSeoul`;
        const aqiRes = await fetch(aqiUrl);
        const aqiData = await aqiRes.json();

        if (data?.current && isMounted) {
          const wmo = data.current.weather_code;
          let pty = "0"; 
          
          if ([51,53,55,61,63,65,80,81,82].includes(wmo)) pty = "1";
          if ([71,73,75,77,85,86].includes(wmo)) pty = "3";
          if ([95,96,99].includes(wmo)) pty = "4"; 
          
          setWeather({ 
            temp: Math.round(data.current.temperature_2m), 
            tempApparent: Math.round(data.current.apparent_temperature),
            tempMax: Math.round(data.daily.temperature_2m_max[0]),
            tempMin: Math.round(data.daily.temperature_2m_min[0]),
            pty: pty, 
            rn1: data.current.precipitation,
            pm10: aqiData.current?.pm10 || 0,
            pm25: aqiData.current?.pm2_5 || 0,
          });
        }
      } catch (err) {
        console.error("Weather fetch failed", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    const timer = setTimeout(() => {
      fetchWeather();
    }, 500);
    
    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, [lat, lng]);

  if (loading || !weather) return null;

  let emoji = "☀️";
  let desc = "맑음";
  
  if (weather.pty === "1") { emoji = "🌧️"; desc = "비"; }
  else if (weather.pty === "3") { emoji = "❄️"; desc = "눈"; }
  else if (weather.pty === "4") { emoji = "⚡"; desc = "번개"; }

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
    <div className="relative">
      {/* 컴팩트 날씨 캡슐 버튼 (헤더 높이 44px 통일) */}
      <button
        type="button"
        onClick={handleToggle}
        className={`h-11 px-3.5 rounded-[22px] flex items-center gap-1.5 transition-all active:scale-95 border ${
          showDetail
            ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
            : 'bg-surface/90 supports-[backdrop-filter]:bg-surface/80 hover:bg-surface text-foreground/85 border-white/40 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'
        }`}
        title={`현재 날씨: ${desc} ${weather.temp}° (터치 시 상세 정보)`}
      >
        <span className="text-[17px] leading-none drop-shadow-2xs">{emoji}</span>
        <span className="text-[14px] font-black">{weather.temp}°</span>
        <IconChevronDown
          size={14}
          className={`transition-transform duration-200 ${showDetail ? 'rotate-180 text-primary-foreground' : 'text-foreground/40'}`}
        />
      </button>

      {/* 펼침 상세 정보 플로팅 카드 (독립 오버레이 - 헤더 레이아웃을 절대 깨뜨리지 않음) */}
      <AnimatePresence>
        {showDetail && (
          <>
            {/* 바깥 클릭 시 닫히는 투명 배경 오버레이 */}
            <div
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
              onClick={handleClose}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="absolute top-[52px] right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-[310px] sm:w-[340px] max-w-[calc(100vw-28px)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-[40px] saturate-200 rounded-[28px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-white/40 dark:border-white/10 text-foreground animate-in fade-in"
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
