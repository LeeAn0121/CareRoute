// 출발/도착 좌표를 받아 네이버 Directions 5(자동차 길찾기) API를 호출하고,
// 실제 도로를 따라가는 경로 좌표와 거리/소요시간을 돌려준다.
// Directions 5는 비밀키(X-NCP-APIGW-API-KEY)가 필요해 정적으로 배포되는
// 클라이언트에 직접 둘 수 없으므로, 이 Edge Function이 서버 측에서 대신 호출한다.

const NAVER_MAPS_CLIENT_ID = Deno.env.get("NAVER_MAPS_CLIENT_ID") ?? "";
const NAVER_MAPS_CLIENT_SECRET = Deno.env.get("NAVER_MAPS_CLIENT_SECRET") ?? "";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!NAVER_MAPS_CLIENT_ID || !NAVER_MAPS_CLIENT_SECRET) {
    return json({ error: "NAVER_MAPS_CLIENT_ID / NAVER_MAPS_CLIENT_SECRET 환경변수가 설정되지 않았습니다." }, 500);
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
    const url =
      `https://maps.apigw.ntruss.com/map-direction/v1/driving` +
      `?start=${startLng},${startLat}&goal=${goalLng},${goalLat}&option=trafast`;

    const res = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": NAVER_MAPS_CLIENT_ID,
        "x-ncp-apigw-api-key": NAVER_MAPS_CLIENT_SECRET,
      },
    });

    const data = await res.json();
    const route = data?.route?.trafast?.[0];

    if (!res.ok || !route) {
      return json({ error: data?.message || "경로를 찾지 못했습니다.", raw: data }, 502);
    }

    const path = (route.path as [number, number][]).map(([lng, lat]) => ({ lat, lng }));

    return json({
      path,
      distanceM: route.summary.distance,
      durationMs: route.summary.duration,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
