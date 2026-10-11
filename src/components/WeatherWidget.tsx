'use client';
import { useState, useEffect } from 'react';
import { IconWind, IconCloud, IconChevronDown, IconDroplet, IconThermometer, IconSparkles } from '@tabler/icons-react';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

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
    <div className="flex flex-col w-full">
      {/* 기본 요약 바 (클릭 시 상세 토글) */}
      <button
        type="button"
        onClick={() => setShowDetail(!showDetail)}
        className="flex items-center gap-3 text-[13px] font-bold text-foreground/80 hover:text-foreground py-0.5 text-left transition-colors group cursor-pointer"
        title="날씨 상세 정보 보기"
      >
        {/* 날씨 및 온도 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[16px] leading-none drop-shadow-sm group-hover:scale-110 transition-transform">{emoji}</span>
          <span className="text-[14px] font-black text-foreground">{weather.temp}°</span>
        </div>

        {/* 최저/최고 온도 */}
        <div className="flex items-center gap-1 border-l border-foreground/10 pl-3">
          <span className="text-blue-500">{weather.tempMin}°</span>
          <span className="text-foreground/20">/</span>
          <span className="text-red-500">{weather.tempMax}°</span>
        </div>

        {/* 미세먼지 */}
        <div className="flex items-center gap-2 border-l border-foreground/10 pl-3">
          <span className="flex items-center gap-1"><IconWind size={14} className="text-foreground/40"/> {getAqiText(weather.pm10)}</span>
          <span className="flex items-center gap-1 ml-1"><IconCloud size={14} className="text-foreground/40"/> {getAqiText25(weather.pm25)}</span>
        </div>

        <IconChevronDown
          size={14}
          className={`text-foreground/40 ml-auto transition-transform duration-200 ${showDetail ? 'rotate-180 text-primary' : 'group-hover:text-foreground/70'}`}
        />
      </button>

      {/* 펼침 상세 정보 카드 */}
      {showDetail && (
        <div className="mt-2.5 p-3 rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.06] border border-foreground/5 dark:border-white/10 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 text-[12px]">
          <div className="grid grid-cols-2 gap-2 text-foreground/80">
            <div className="flex items-center gap-1.5 bg-surface/80 rounded-xl px-2.5 py-1.5 border border-surface-border/40">
              <IconThermometer size={14} className="text-primary shrink-0" />
              <span>체감 온도: <strong className="text-foreground font-black">{weather.tempApparent}°C</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface/80 rounded-xl px-2.5 py-1.5 border border-surface-border/40">
              <IconDroplet size={14} className="text-blue-500 shrink-0" />
              <span>강수량: <strong className="text-foreground font-black">{weather.rn1 ?? 0}mm</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface/80 rounded-xl px-2.5 py-1.5 border border-surface-border/40">
              <IconWind size={14} className="text-emerald-500 shrink-0" />
              <span>미세: <strong className="text-foreground font-black">{weather.pm10}</strong> ㎍/㎥</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface/80 rounded-xl px-2.5 py-1.5 border border-surface-border/40">
              <IconCloud size={14} className="text-orange-500 shrink-0" />
              <span>초미세: <strong className="text-foreground font-black">{weather.pm25}</strong> ㎍/㎥</span>
            </div>
          </div>

          {/* 방문 케어 가이드 팁 */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary/90 bg-primary/10 rounded-xl px-2.5 py-1.5 mt-0.5">
            <IconSparkles size={13} className="shrink-0 text-primary" />
            <span className="truncate">{fieldCareTip}</span>
          </div>
        </div>
      )}
    </div>
  );
}
