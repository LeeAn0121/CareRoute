// 출발/도착 좌표를 받아 Tmap 보행자(도보) 경로 API를 호출하고,
// 인도/횡단보도/지하도 등을 반영한 실제 도보 경로 좌표와 거리/소요시간을 돌려준다.
// 네이버 지도는 제3자용 도보 경로 API를 제공하지 않아 Tmap(SK Open API)을 사용한다.
// appKey는 도메인 제한과 호출 쿼터가 걸린 값이라 공개 정적 사이트에 그대로 두지 않고
// 이 Edge Function을 통해서만 호출한다.

const TMAP_APP_KEY = Deno.env.get("TMAP_APP_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface TmapFeature {
  type: "Feature";
  geometry: { type: "Point" | "LineString"; coordinates: number[] | number[][] };
  properties?: { totalDistance?: number; totalTime?: number; description?: string };
}

// 두 WGS84 좌표 사이의 거리(m), 각 구간 실제 이동 거리를 직접 계산해
// Tmap 응답의 필드 이름에 의존하지 않고 정확한 값을 보장한다.
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!TMAP_APP_KEY) {
    return json({ error: "TMAP_APP_KEY 환경변수가 설정되지 않았습니다." }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { startLat, startLng, goalLat, goalLng, searchOption } = body ?? {};
  const coords = [startLat, startLng, goalLat, goalLng];
  if (coords.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    return json({ error: "startLat/startLng/goalLat/goalLng(숫자)가 모두 필요합니다." }, 400);
  }

  // Tmap 공식 문서 기준 보행자 경로 탐색 옵션: 0=추천(기본), 4=추천+대로우선,
  // 10=최단거리, 30=최단거리+계단제외. 그 외 값이 오면 기본값으로 안전하게 대체한다.
  const VALID_SEARCH_OPTIONS = new Set(["0", "4", "10", "30"]);
  const safeSearchOption = VALID_SEARCH_OPTIONS.has(String(searchOption)) ? String(searchOption) : "0";

  try {
    const res = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
      method: "POST",
      headers: {
        appKey: TMAP_APP_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        startX: String(startLng),
        startY: String(startLat),
        endX: String(goalLng),
        endY: String(goalLat),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        startName: "출발",
        endName: "도착",
        searchOption: safeSearchOption,
      }),
    });

    const data = await res.json();
    const features: TmapFeature[] | undefined = data?.features;

    if (!res.ok || !Array.isArray(features) || features.length === 0) {
      return json({ error: data?.error?.message || "도보 경로를 찾지 못했습니다.", raw: data }, 502);
    }

    const path: { lat: number; lng: number }[] = [];
    // 턴바이턴 안내: Tmap이 생성한 자연어 description을 그대로 신뢰해서 보여준다
    // (좌/우회전 같은 방향 정보를 직접 코드로 추정하면 틀렸을 때 위험하므로 추정하지 않음).
    // 각 안내 지점 바로 다음에 오는 LineString 구간의 실제 좌표로 거리를 계산해 붙인다.
    const steps: { lat: number; lng: number; description: string; distanceM: number }[] = [];
    let pendingStep: { lat: number; lng: number; description: string } | null = null;

    for (const feature of features) {
      if (feature.geometry?.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates as number[];
        const description = feature.properties?.description;
        if (description) {
          pendingStep = { lat, lng, description };
        }
      } else if (feature.geometry?.type === "LineString") {
        const coords = feature.geometry.coordinates as number[][];
        for (const [lng, lat] of coords) {
          path.push({ lat, lng });
        }
        if (pendingStep) {
          let segmentM = 0;
          for (let i = 1; i < coords.length; i++) {
            segmentM += haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
          }
          steps.push({ ...pendingStep, distanceM: Math.round(segmentM) });
          pendingStep = null;
        }
      }
    }

    const summary = features[0]?.properties ?? {};
    if (path.length === 0 || typeof summary.totalDistance !== "number") {
      return json({ error: "도보 경로 응답 형식이 올바르지 않습니다.", raw: data }, 502);
    }

    return json({
      path,
      distanceM: summary.totalDistance,
      durationS: summary.totalTime ?? null,
      steps,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
