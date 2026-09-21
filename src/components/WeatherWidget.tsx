'use client';
import { useState, useEffect } from 'react';
import { IconWind, IconCloud } from '@tabler/icons-react';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    if (val <= 30) return <span className="text-blue-500">좋음</span>;
    if (val <= 80) return <span className="text-emerald-500">보통</span>;
    if (val <= 150) return <span className="text-orange-500">나쁨</span>;
    return <span className="text-red-500">최악</span>;
  };

  const getAqiText25 = (val: number) => {
    if (val <= 15) return <span className="text-blue-500">좋음</span>;
    if (val <= 35) return <span className="text-emerald-500">보통</span>;
    if (val <= 75) return <span className="text-orange-500">나쁨</span>;
    return <span className="text-red-500">최악</span>;
  };

  return (
    <div className="flex items-center gap-3 text-[13px] font-bold text-foreground/80 animate-in fade-in py-0.5">
      {/* 날씨 및 온도 */}
      <div className="flex items-center gap-1.5">
        <span className="text-[16px] leading-none drop-shadow-sm">{emoji}</span>
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
    </div>
  );
}
