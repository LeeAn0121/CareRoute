'use client';
import { useState, useEffect } from 'react';

interface RegionData {
  name: string;
  lat: number;
  lng: number;
}

interface WeatherWidgetProps {
  regions: RegionData[];
}

interface WeatherInfo {
  name: string;
  temp: string;
  pty: string;
  rn1: string;
}

export default function WeatherWidget({ regions }: WeatherWidgetProps) {
  const [weathers, setWeathers] = useState<WeatherInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchWeathers() {
      if (!regions || regions.length === 0) return;
      
      try {
        setLoading(true);
        
        // Extract up to 5 regions to avoid URL too long / API limits
        const targetRegions = regions.slice(0, 5);
        const lats = targetRegions.map(r => r.lat).join(',');
        const lngs = targetRegions.map(r => r.lng).join(',');
        
        // Get Weather from Open-Meteo for multiple locations
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,weather_code&timezone=Asia%2FSeoul`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (isMounted) {
          const results: WeatherInfo[] = [];
          
          // Open-Meteo returns an array if multiple coordinates, or an object if single coordinate
          const dataArray = Array.isArray(data) ? data : [data];
          
          dataArray.forEach((item, index) => {
            if (item?.current) {
              const wmo = item.current.weather_code;
              let pty = "0"; // 0:맑음, 1:비, 3:눈
              
              if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(wmo)) pty = "1";
              if ([71,73,75,77,85,86].includes(wmo)) pty = "3";
              
              results.push({
                name: targetRegions[index].name,
                temp: Math.round(item.current.temperature_2m).toString(),
                pty: pty,
                rn1: item.current.precipitation.toString()
              });
            }
          });
          
          setWeathers(results);
        }
      } catch (err) {
        console.error("Weather fetch failed", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    // Add debounce to prevent spamming
    const timer = setTimeout(() => {
      fetchWeathers();
    }, 500);
    
    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, [regions]);

  if (loading && weathers.length === 0) return null;
  if (weathers.length === 0) return null;

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] right-4 mt-[72px] z-[40] pointer-events-auto flex flex-col gap-2 animate-in fade-in slide-in-from-right-4">
      {weathers.map((weather, i) => {
        let emoji = "☀️";
        let desc = "맑음";
        
        if (weather.pty === "1") { emoji = "🌧️"; desc = "비"; }
        else if (weather.pty === "3") { emoji = "❄️"; desc = "눈"; }

        return (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-surface/90 backdrop-blur-2xl rounded-[20px] shadow-lg shadow-foreground/10 border border-surface-border/60 transition-all hover:scale-105 cursor-default">
            <span className="text-xl leading-none">{emoji}</span>
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold text-foreground/60">{weather.name}</span>
                <span className="text-[14px] font-black text-primary leading-none">{weather.temp}°C</span>
              </div>
              {weather.pty !== "0" && <span className="text-[10px] font-bold text-accent mt-0.5">{desc} {weather.rn1}mm</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
