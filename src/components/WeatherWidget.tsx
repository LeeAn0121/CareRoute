'use client';
import { useState, useEffect } from 'react';
import { dfs_xy_conv, getBaseDateTime } from '@/lib/kmaGrid';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<{ temp: string; pty: string; rn1: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchWeather() {
      try {
        setLoading(true);
        const { x, y } = dfs_xy_conv("toXY", lat, lng);
        const { base_date, base_time } = getBaseDateTime();
        
        // Proxy API to bypass CORS
        const targetUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${x}&ny=${y}&authKey=CTl9VmD0R7O5fVZg9DezwQ`;
        const url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data?.response?.header?.resultCode === "00") {
          const items = data.response.body.items.item;
          
          let temp = "";
          let pty = ""; 
          let rn1 = ""; 
          
          items.forEach((item: any) => {
            if (item.category === "T1H") temp = item.obsrValue;
            if (item.category === "PTY") pty = item.obsrValue;
            if (item.category === "RN1") rn1 = item.obsrValue;
          });
          
          if (isMounted) {
            setWeather({ temp, pty, rn1 });
          }
        }
      } catch (err) {
        console.error("Weather fetch failed", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchWeather();
    
    return () => { isMounted = false; };
  }, [lat, lng]);

  if (loading || !weather) return null;

  let emoji = "☀️";
  let desc = "맑음";
  
  if (weather.pty === "1" || weather.pty === "5") { emoji = "🌧️"; desc = "비"; }
  else if (weather.pty === "2" || weather.pty === "6") { emoji = "🌨️"; desc = "비/눈"; }
  else if (weather.pty === "3" || weather.pty === "7") { emoji = "❄️"; desc = "눈"; }
  else {
    emoji = "🌡️";
    desc = "기온";
  }

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] right-4 mt-20 z-[40] pointer-events-auto animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-foreground/10 border border-surface-border/50 transition-all hover:scale-105 cursor-default">
        <span className="text-lg">{emoji}</span>
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-primary leading-tight">{weather.temp}°C</span>
          {weather.pty !== "0" && <span className="text-[9px] font-bold text-accent">{desc} {weather.rn1}mm</span>}
        </div>
      </div>
    </div>
  );
}
