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
  properties?: { totalDistance?: number; totalTime?: number };
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

  const { startLat, startLng, goalLat, goalLng } = body ?? {};
  const coords = [startLat, startLng, goalLat, goalLng];
  if (coords.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    return json({ error: "startLat/startLng/goalLat/goalLng(숫자)가 모두 필요합니다." }, 400);
  }

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
      }),
    });

    const data = await res.json();
    const features: TmapFeature[] | undefined = data?.features;

    if (!res.ok || !Array.isArray(features) || features.length === 0) {
      return json({ error: data?.error?.message || "도보 경로를 찾지 못했습니다.", raw: data }, 502);
    }

    const path: { lat: number; lng: number }[] = [];
    for (const feature of features) {
      if (feature.geometry?.type === "LineString") {
        for (const [lng, lat] of feature.geometry.coordinates as number[][]) {
          path.push({ lat, lng });
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
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
