'use client';
import { useState, useEffect } from 'react';
import { IconDroplet, IconThermometer, IconWind, IconCloud } from '@tabler/icons-react';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null);
  const [regionName, setRegionName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchWeather() {
      try {
        setLoading(true);
        
        // 1. Get Weather from Open-Meteo
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`;
        const res = await fetch(url);
        const data = await res.json();
        
        // 2. Get Air Quality
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5&timezone=Asia%2FSeoul`;
        const aqiRes = await fetch(aqiUrl);
        const aqiData = await aqiRes.json();

        if (data?.current && isMounted) {
          const wmo = data.current.weather_code;
          let pty = "0"; // 0:맑음, 1:비, 3:눈, 4:번개
          
          if ([51,53,55,61,63,65,80,81,82].includes(wmo)) pty = "1";
          if ([71,73,75,77,85,86].includes(wmo)) pty = "3";
          if ([95,96,99].includes(wmo)) pty = "4"; // 번개
          
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

        // 3. Get Region Name
        if (window.naver && window.naver.maps && window.naver.maps.Service) {
          window.naver.maps.Service.reverseGeocode({
            coords: new window.naver.maps.LatLng(lat, lng),
          }, function(status: any, response: any) {
            if (status === window.naver.maps.Service.Status.OK && isMounted) {
              const result = response.v2;
              if (result && result.results && result.results.length > 0) {
                const region = result.results[0].region;
                const dong = region.area3 ? region.area3.name : '';
                const gu = region.area2 ? region.area2.name : '';
                setRegionName(dong || gu);
              }
            }
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

  const getAqiText = (val: number, type: 'pm10' | 'pm25') => {
    if (type === 'pm10') {
      if (val <= 30) return <span className="text-blue-500 font-black">좋음</span>;
      if (val <= 80) return <span className="text-green-500 font-black">보통</span>;
      if (val <= 150) return <span className="text-orange-500 font-black">나쁨</span>;
      return <span className="text-red-500 font-black">최악</span>;
    } else {
      if (val <= 15) return <span className="text-blue-500 font-black">좋음</span>;
      if (val <= 35) return <span className="text-green-500 font-black">보통</span>;
      if (val <= 75) return <span className="text-orange-500 font-black">나쁨</span>;
      return <span className="text-red-500 font-black">최악</span>;
    }
  };

  return (
    <div className="w-full flex flex-col pointer-events-auto mb-2 animate-in fade-in slide-in-from-top-2">
      <div className="bg-surface/85 backdrop-blur-[32px] rounded-3xl p-4 shadow-xl shadow-foreground/5 border border-surface-border/60">
        
        {/* 상단: 동 이름 및 현재 날씨 메인 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-[32px] leading-none filter drop-shadow-md">{emoji}</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-black text-foreground/80 tracking-tight">{regionName || '현재 위치'} {desc}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-black text-primary tracking-tighter leading-none">{weather.temp}°</span>
                <span className="text-[12px] font-bold text-foreground/50">체감 {weather.tempApparent}°</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-[11px] font-bold">
            <div className="flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-full w-full justify-center">
              최저 {weather.tempMin}°
            </div>
            <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full w-full justify-center">
              최고 {weather.tempMax}°
            </div>
          </div>
        </div>

        {/* 하단: 미세먼지 정보 */}
        <div className="flex gap-2">
          <div className="flex-1 bg-surface-muted/50 rounded-[14px] px-3 py-2 flex items-center justify-between border border-surface-border/30">
            <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1"><IconWind size={14}/>미세</span>
            <span className="text-[13px]">{getAqiText(weather.pm10, 'pm10')}</span>
          </div>
          <div className="flex-1 bg-surface-muted/50 rounded-[14px] px-3 py-2 flex items-center justify-between border border-surface-border/30">
            <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1"><IconCloud size={14}/>초미세</span>
            <span className="text-[13px]">{getAqiText(weather.pm25, 'pm25')}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
