'use client';
import { useState, useEffect } from 'react';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
}

export default function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<{ temp: string; pty: string; rn1: string } | null>(null);
  const [regionName, setRegionName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchWeather() {
      try {
        setLoading(true);
        
        // 1. Get Weather from Open-Meteo
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=Asia%2FSeoul`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data?.current && isMounted) {
          const wmo = data.current.weather_code;
          let pty = "0"; // 0:맑음, 1:비, 3:눈
          
          if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(wmo)) pty = "1";
          if ([71,73,75,77,85,86].includes(wmo)) pty = "3";
          
          setWeather({ 
            temp: Math.round(data.current.temperature_2m).toString(), 
            pty: pty, 
            rn1: data.current.precipitation.toString() 
          });
        }

        // 2. Get Region Name using Naver Reverse Geocoding
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
    
    // 디바운스: 지도를 마구 드래그할 때 API가 과도하게 호출되는 것을 방지
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

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] right-4 mt-[72px] z-[40] pointer-events-auto animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface/90 backdrop-blur-2xl rounded-[20px] shadow-lg shadow-foreground/10 border border-surface-border/60 transition-all hover:scale-105 cursor-default">
        <span className="text-xl leading-none">{emoji}</span>
        <div className="flex flex-col justify-center">
          <div className="flex items-baseline gap-1.5">
            {regionName && <span className="text-[11px] font-bold text-foreground/60">{regionName}</span>}
            <span className="text-[14px] font-black text-primary leading-none">{weather.temp}°C</span>
          </div>
          {weather.pty !== "0" && <span className="text-[10px] font-bold text-accent mt-0.5">{desc} {weather.rn1}mm</span>}
        </div>
      </div>
    </div>
  );
}
