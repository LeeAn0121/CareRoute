'use client';
import { useState, useEffect } from 'react';
import { IconDroplet, IconWind, IconCloud } from '@tabler/icons-react';

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
  let gradient = "from-sky-400 to-blue-500";
  
  if (weather.pty === "1") { emoji = "🌧️"; desc = "비"; gradient = "from-slate-500 to-slate-700"; }
  else if (weather.pty === "3") { emoji = "❄️"; desc = "눈"; gradient = "from-blue-200 to-slate-300"; }
  else if (weather.pty === "4") { emoji = "⚡"; desc = "번개"; gradient = "from-indigo-600 to-purple-800"; }

  const getAqiText = (val: number, type: 'pm10' | 'pm25') => {
    if (type === 'pm10') {
      if (val <= 30) return <span className="text-blue-500 font-bold">좋음</span>;
      if (val <= 80) return <span className="text-emerald-500 font-bold">보통</span>;
      if (val <= 150) return <span className="text-orange-500 font-bold">나쁨</span>;
      return <span className="text-red-500 font-bold">최악</span>;
    } else {
      if (val <= 15) return <span className="text-blue-500 font-bold">좋음</span>;
      if (val <= 35) return <span className="text-emerald-500 font-bold">보통</span>;
      if (val <= 75) return <span className="text-orange-500 font-bold">나쁨</span>;
      return <span className="text-red-500 font-bold">최악</span>;
    }
  };

  return (
    <div className="w-full flex flex-col pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="relative overflow-hidden bg-surface/75 supports-[backdrop-filter]:bg-surface/50 backdrop-blur-[40px] saturate-200 rounded-[32px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10">
        
        {/* Soft atmospheric glow based on weather */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[40px] opacity-20 bg-gradient-to-br ${gradient} pointer-events-none`} />

        <div className="relative z-10 flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[20px] font-bold tracking-tight text-foreground/90">{regionName || '현재 위치'}</span>
              <span className="text-[13px] font-semibold text-foreground/60 tracking-tight">{desc}</span>
            </div>
            <span className="text-[42px] leading-none filter drop-shadow-md">{emoji}</span>
          </div>

          {/* Temperature Row */}
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[44px] font-black tracking-tighter leading-none text-foreground">{weather.temp}°</span>
              <span className="text-[14px] font-bold text-foreground/50 mb-1">체감 {weather.tempApparent}°</span>
            </div>
            
            <div className="flex flex-col items-end gap-1 mb-1">
              <span className="text-[13px] font-bold text-foreground/70">최고 <span className="text-red-500">{weather.tempMax}°</span></span>
              <span className="text-[13px] font-bold text-foreground/70">최저 <span className="text-blue-500">{weather.tempMin}°</span></span>
            </div>
          </div>

          {/* Air Quality Row */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex items-center justify-between bg-foreground/[0.04] rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground/60">
                <IconWind size={16} stroke={2.5} />
                <span>미세</span>
              </div>
              <span className="text-[13px] tracking-tight">{getAqiText(weather.pm10, 'pm10')}</span>
            </div>
            
            <div className="flex items-center justify-between bg-foreground/[0.04] rounded-2xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground/60">
                <IconCloud size={16} stroke={2.5} />
                <span>초미세</span>
              </div>
              <span className="text-[13px] tracking-tight">{getAqiText(weather.pm25, 'pm25')}</span>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
