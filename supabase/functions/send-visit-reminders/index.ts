// 1분마다(Cron) 호출되어, 지금 이 순간이 방문 예정 시간인 어르신을 찾아
// 등록된 모든 기기(push_subscriptions)에 Web Push 알림을 보낸다.
// 앱이 꺼져있거나 백그라운드여도 브라우저가 서비스워커의 'push' 이벤트를
// 깨워서 알림을 띄워주기 때문에, 클라이언트의 setInterval 방식과 달리
// 실제로 신뢰할 수 있는 알림이 된다.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  "mailto:careroute-admin@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

function seoulNow() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` };
}

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

Deno.serve(async () => {
  const { ymd, hm } = seoulNow();
  const notifiedKey = `${ymd}_${hm}`;

  const recRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipients?select=id,name,address,visit_time,notes,last_notified_key&notes=eq.${ymd}`,
    { headers: restHeaders },
  );
  if (!recRes.ok) {
    return new Response(await recRes.text(), { status: 500 });
  }
  const recipients = await recRes.json();

  const due = recipients.filter((r: any) =>
    r.visit_time &&
    r.visit_time !== "00:00:00" &&
    r.visit_time.substring(0, 5) === hm &&
    r.last_notified_key !== notifiedKey
  );

  if (due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, due: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const subRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: restHeaders,
  });
  const subscriptions = await subRes.json();

  let sent = 0;
  const errors: any[] = [];
  for (const recipient of due) {
    const payload = JSON.stringify({
      title: "케어루트 알림 🚨",
      body: `${recipient.name} 어르신 방문 예정 시간입니다! (${recipient.address})`,
      url: `/CareRoute/?focus=${recipient.id}`,
      recipientId: recipient.id,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        // 만료되었거나 사용자가 알림을 끈 구독은 정리
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "DELETE",
            headers: restHeaders,
          });
        } else {
          console.error("push failed", sub.endpoint, err);
        }
        errors.push({
          endpoint: sub.endpoint.slice(0, 60),
          statusCode: err?.statusCode,
          message: err?.message || String(err),
          body: err?.body,
        });
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/recipients?id=eq.${recipient.id}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ last_notified_key: notifiedKey }),
    });
  }

  return new Response(JSON.stringify({ sent, due: due.length, subscriptions: subscriptions.length, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
