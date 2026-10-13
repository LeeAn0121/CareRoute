/**
 * 두 지점(출발/도착) 사이의 이동수단 추천과, 자동차 경로일 때 실제 도로를 따라가는
 * 경로 좌표를 가져오는 유틸리티.
 *
 * 네이버 Directions 5(자동차 길찾기) API는 비밀키가 필요해 브라우저에서 직접 호출할 수
 * 없으므로, Supabase Edge Function(`naver-directions`)을 프록시로 거쳐 호출한다.
 * 도보/대중교통은 네이버가 제3자용 API를 제공하지 않아 직선 거리 기반으로만 안내한다.
 */

export type TravelMode = 'walk' | 'drive' | 'transit';

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  walk: '도보',
  drive: '차량',
  transit: '대중교통',
};

// 직선거리 기준 이동수단 추천 임계값 (km)
const WALK_MAX_KM = 1;
const DRIVE_MAX_KM = 15;

export function recommendTravelMode(distanceKm: number): TravelMode {
  if (distanceKm < WALK_MAX_KM) return 'walk';
  if (distanceKm <= DRIVE_MAX_KM) return 'drive';
  return 'transit';
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DrivingRouteResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
}

// 동일 출발/도착 쌍에 대한 반복 요청을 줄이기 위한 메모리 캐시
const routeCache = new Map<string, { data: DrivingRouteResult; timestamp: number }>();
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30분

function routeCacheKey(origin: LatLng, destination: LatLng): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(origin.lat)},${r(origin.lng)}->${r(destination.lat)},${r(destination.lng)}`;
}

/**
 * 자동차 기준 실제 도로 경로를 Supabase Edge Function(naver-directions)을 통해 가져온다.
 * 실패하거나 아직 배포/설정 전이면 null을 반환하며, 호출부에서 직선 경로로 폴백해야 한다.
 */
export async function fetchDrivingRoute(
  origin: LatLng,
  destination: LatLng
): Promise<DrivingRouteResult | null> {
  const key = routeCacheKey(origin, destination);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL_MS) {
    return cached.data;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/naver-directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        startLat: origin.lat,
        startLng: origin.lng,
        goalLat: destination.lat,
        goalLng: destination.lng,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.path) || data.path.length === 0) return null;

    const result: DrivingRouteResult = {
      path: data.path,
      distanceKm: data.distanceM / 1000,
      durationMin: Math.round(data.durationMs / 60000),
    };
    routeCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error('Driving route fetch error:', err);
    return null;
  }
}
