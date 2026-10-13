/**
 * 두 지점(출발/도착) 사이의 이동수단 추천과, 자동차/도보일 때 실제 경로를 따라가는
 * 좌표를 가져오는 유틸리티.
 *
 * - 자동차: 네이버 Directions 5 API (비밀키 필요 → Supabase Edge Function `naver-directions` 경유)
 * - 도보: Tmap 보행자 경로 API (appKey 필요 → Supabase Edge Function `tmap-pedestrian` 경유)
 *   네이버는 제3자용 도보 경로 API를 제공하지 않아 Tmap(SK Open API)을 사용한다.
 * - 대중교통: 공개된 제3자용 경로 API가 없어 직선 거리 기준 추정치만 제공한다.
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

export interface RouteStep {
  lat: number;
  lng: number;
  description: string;
  distanceM: number;
}

export interface RouteResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
  steps?: RouteStep[];
}

// 동일 출발/도착 쌍에 대한 반복 요청을 줄이기 위한 메모리 캐시 (수단별로 분리)
const routeCache = new Map<string, { data: RouteResult; timestamp: number }>();
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30분

function routeCacheKey(prefix: string, origin: LatLng, destination: LatLng): string {
  const r = (n: number) => n.toFixed(5);
  return `${prefix}:${r(origin.lat)},${r(origin.lng)}->${r(destination.lat)},${r(destination.lng)}`;
}

interface RouteFunctionResponse {
  path: LatLng[];
  distanceM: number;
  durationMs?: number;
  durationS?: number;
  steps?: RouteStep[];
}

async function fetchRouteFromFunction(
  functionName: string,
  origin: LatLng,
  destination: LatLng
): Promise<RouteFunctionResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
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
    return data;
  } catch (err) {
    console.error(`${functionName} fetch error:`, err);
    return null;
  }
}

/**
 * 자동차 기준 실제 도로 경로를 Supabase Edge Function(naver-directions)을 통해 가져온다.
 * 실패하거나 아직 배포/설정 전이면 null을 반환하며, 호출부에서 직선 경로로 폴백해야 한다.
 */
export async function fetchDrivingRoute(origin: LatLng, destination: LatLng): Promise<RouteResult | null> {
  const key = routeCacheKey('drive', origin, destination);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL_MS) return cached.data;

  const data = await fetchRouteFromFunction('naver-directions', origin, destination);
  if (!data) return null;

  const result: RouteResult = {
    path: data.path,
    distanceKm: data.distanceM / 1000,
    durationMin: Math.round((data.durationMs ?? 0) / 60000),
  };
  routeCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}

/**
 * 도보 기준 실제 보행자 경로(인도/횡단보도 반영)를 Supabase Edge Function(tmap-pedestrian)을
 * 통해 가져온다. 실패하거나 아직 배포/설정 전이면 null을 반환하며, 호출부에서 직선 경로로
 * 폴백해야 한다.
 */
export async function fetchWalkingRoute(origin: LatLng, destination: LatLng): Promise<RouteResult | null> {
  const key = routeCacheKey('walk', origin, destination);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL_MS) return cached.data;

  const data = await fetchRouteFromFunction('tmap-pedestrian', origin, destination);
  if (!data) return null;

  const result: RouteResult = {
    path: data.path,
    distanceKm: data.distanceM / 1000,
    durationMin: data.durationS != null ? Math.round(data.durationS / 60) : Math.round((data.distanceM / 1000 / 4) * 60),
    steps: data.steps,
  };
  routeCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
