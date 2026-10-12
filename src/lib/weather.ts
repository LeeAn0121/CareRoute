/**
 * Weather utility and shared caching layer for CareRoute.
 * Provides grid-based Open-Meteo fetching, memory/localStorage caching,
 * and helper functions for weather grid layers and widgets.
 */

export interface WeatherData {
  temp: number;
  tempApparent: number;
  tempMax: number;
  tempMin: number;
  pty: string;
  rn1: number;
  pm10: number;
  pm25: number;
}

// Global in-memory cache per coordinate grid
export const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
export const WEATHER_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes TTL

export function getGridKey(lat: number, lng: number, step: number = 0.02): string {
  const roundedLat = (Math.floor(lat / step) * step).toFixed(3);
  const roundedLng = (Math.floor(lng / step) * step).toFixed(3);
  return `${roundedLat}_${roundedLng}`;
}

let latestKnownWeather: WeatherData | null = null;
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('careroute_last_weather');
    if (saved) latestKnownWeather = JSON.parse(saved);
  } catch {}
}

export function getLatestKnownWeather(): WeatherData | null {
  return latestKnownWeather;
}

export function getWeatherEmojiAndDesc(pty: string): { emoji: string; desc: string } {
  if (pty === '1') return { emoji: '🌧️', desc: '비' };
  if (pty === '3') return { emoji: '❄️', desc: '눈' };
  if (pty === '4') return { emoji: '⚡', desc: '번개' };
  return { emoji: '☀️', desc: '맑음' };
}

export async function fetchWeatherForCoord(lat: number, lng: number, step: number = 0.02): Promise<WeatherData | null> {
  const key = getGridKey(lat, lng, step);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Forecast fetch failed');
    const data = await res.json();

    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5&timezone=Asia%2FSeoul`;
    const aqiRes = await fetch(aqiUrl);
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    if (data?.current) {
      const wmo = data.current.weather_code;
      let pty = '0';
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(wmo)) pty = '1';
      if ([71, 73, 75, 77, 85, 86].includes(wmo)) pty = '3';
      if ([95, 96, 99].includes(wmo)) pty = '4';

      const newWeather: WeatherData = {
        temp: Math.round(data.current.temperature_2m),
        tempApparent: Math.round(data.current.apparent_temperature),
        tempMax: Math.round(data.daily.temperature_2m_max[0]),
        tempMin: Math.round(data.daily.temperature_2m_min[0]),
        pty,
        rn1: data.current.precipitation,
        pm10: aqiData?.current?.pm10 || 0,
        pm25: aqiData?.current?.pm2_5 || 0,
      };

      weatherCache.set(key, { data: newWeather, timestamp: Date.now() });
      latestKnownWeather = newWeather;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('careroute_last_weather', JSON.stringify(newWeather));
        } catch {}
      }
      return newWeather;
    }
  } catch (err) {
    console.error('Weather fetch error:', err);
  }
  return latestKnownWeather;
}
