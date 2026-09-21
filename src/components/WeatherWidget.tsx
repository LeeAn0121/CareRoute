'use client';
import { useState, useEffect } from 'react';
import { IconWind, IconCloud } from '@tabler/icons-react';

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

        if (window.naver && window.naver.maps && window.naver.maps.Service) {
          window.naver.maps.Service.reverseGeocode({
            coords: new window.naver.maps.LatLng(lat, lng),
          }, function(status: any, response: any) {
            if (status === window.naver.maps.Service.Status.OK && isMounted) {
              const result = response.v2;
              if (result && result.results && result.results.length > 0) {
                const region = result.results[0].region;
                const dong = region.area3 ? region.area3.name : '';
                setRegionName(dong);
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

  const getAqiText = (val: number) => {
    if (val <= 30) return <span className="text-blue-500 font-bold">좋음</span>;
    if (val <= 80) return <span className="text-emerald-500 font-bold">보통</span>;
    if (val <= 150) return <span className="text-orange-500 font-bold">나쁨</span>;
    return <span className="text-red-500 font-bold">최악</span>;
  };

  const getAqiText25 = (val: number) => {
    if (val <= 15) return <span className="text-blue-500 font-bold">좋음</span>;
    if (val <= 35) return <span className="text-emerald-500 font-bold">보통</span>;
    if (val <= 75) return <span className="text-orange-500 font-bold">나쁨</span>;
    return <span className="text-red-500 font-bold">최악</span>;
  };

  return (
    <div className="w-full flex flex-col gap-1.5 animate-in fade-in">
      
      {/* Row 1: Dong Name, Status, Temp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[20px] leading-none drop-shadow-sm">{emoji}</span>
          <span className="text-[15px] font-black text-foreground/90 tracking-tight">
            {regionName || '현위치'} {desc}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[20px] font-black text-primary tracking-tighter leading-none">{weather.temp}°</span>
          <span className="text-[12px] font-bold text-foreground/50">체감 {weather.tempApparent}°</span>
        </div>
      </div>

      {/* Row 2: Min/Max & Dust */}
      <div className="flex items-center justify-between text-[11px] font-bold bg-foreground/[0.03] rounded-xl px-2.5 py-1.5 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-blue-500">최저 {weather.tempMin}°</span>
          <span className="text-foreground/20">|</span>
          <span className="text-red-500">최고 {weather.tempMax}°</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-0.5 text-foreground/60"><IconWind size={12}/> 미세 {getAqiText(weather.pm10)}</span>
          <span className="flex items-center gap-0.5 text-foreground/60"><IconCloud size={12}/> 초미세 {getAqiText25(weather.pm25)}</span>
        </div>
      </div>

    </div>
  );
}
