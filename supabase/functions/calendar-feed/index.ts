// 일정 탭의 방문 일정을 외부 캘린더 앱(구글/애플 캘린더 등)이 "구독"(iCal) 형태로 실시간으로
// 받아볼 수 있게 하는 공개 피드. 앱이 정적 배포(output: export)라 Next.js 라우트 핸들러로는
// 만들 수 없어 Edge Function으로 둔다. 캘린더 앱은 Supabase 인증 헤더를 보낼 수 없으므로
// 이 함수는 --no-verify-jwt로 배포하고, 대신 URL에 섞인 토큰으로 무작위 접근만 막는다
// (로그인 시스템이 아직 없는 지금 앱 전체의 보안 수준과 동일한 한계 — 진짜 인증은 아님).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CALENDAR_FEED_TOKEN = Deno.env.get("CALENDAR_FEED_TOKEN") ?? "";

const WEEKDAY_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface FeedRecipient {
  id: string;
  name: string;
  address: string;
  detail_address?: string | null;
  visit_time?: string | null;
  notes?: string | null;
  recurring_weekdays?: string | null;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIcsDateTime(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

function parseStartTime(visitTime?: string | null, notes?: string | null): { hour: number; minute: number; durationMin: number } {
  let hour = 9;
  let minute = 0;
  let durationMin = 60;

  const timeMatch = notes?.match(/TIME:(\d{2}):(\d{2})(?:~(\d{2}):(\d{2}))?/);
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    if (timeMatch[3] && timeMatch[4]) {
      const endMinutes = Number(timeMatch[3]) * 60 + Number(timeMatch[4]);
      const startMinutes = hour * 60 + minute;
      if (endMinutes > startMinutes) durationMin = endMinutes - startMinutes;
    }
  } else if (visitTime && visitTime !== "00:00:00" && visitTime.length >= 5) {
    const [h, m] = visitTime.slice(0, 5).split(":").map(Number);
    if (!(h === 0 && m === 0)) {
      hour = h;
      minute = m;
    }
  }
  return { hour, minute, durationMin };
}

function nextOccurrenceOf(weekday: number, from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildCalendarIcs(recipients: FeedRecipient[], now: Date): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareRoute//Visit Schedule//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:케어루트 방문 일정",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];
  const location = (r: FeedRecipient) => escapeIcsText([r.address, r.detail_address].filter(Boolean).join(" "));

  for (const r of recipients) {
    const { hour, minute, durationMin } = parseStartTime(r.visit_time, r.notes);
    const summary = escapeIcsText(`${r.name} 어르신 방문`);
    const loc = location(r);

    if (r.recurring_weekdays) {
      const weekdays = r.recurring_weekdays
        .split(",")
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
        .sort((a, b) => a - b);
      if (weekdays.length > 0) {
        const dtStartDate = nextOccurrenceOf(weekdays[0], now);
        dtStartDate.setHours(hour, minute, 0, 0);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${r.id}-recurring@careroute`,
          `DTSTAMP:${formatIcsDateTime(now)}`,
          `DTSTART:${formatIcsDateTime(dtStartDate)}`,
          `DURATION:PT${durationMin}M`,
          `RRULE:FREQ=WEEKLY;BYDAY=${weekdays.map((w) => WEEKDAY_ICS[w]).join(",")}`,
          `SUMMARY:${summary}`,
          ...(loc ? [`LOCATION:${loc}`] : []),
          "END:VEVENT",
        );
      }
    }

    const oneOffDates = (r.notes || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    for (const dateStr of oneOffDates) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${r.id}-${dateStr}@careroute`,
        `DTSTAMP:${formatIcsDateTime(now)}`,
        `DTSTART:${formatIcsDateTime(dt)}`,
        `DURATION:PT${durationMin}M`,
        `SUMMARY:${summary}`,
        ...(loc ? [`LOCATION:${loc}`] : []),
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!CALENDAR_FEED_TOKEN || token !== CALENDAR_FEED_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response("Server not configured", { status: 500 });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/recipients?select=id,name,address,detail_address,visit_time,notes,recurring_weekdays`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (!res.ok) {
      return new Response("Failed to load schedule", { status: 502 });
    }
    const data = (await res.json()) as FeedRecipient[];
    const ics = buildCalendarIcs(data, new Date());

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="careroute.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
});
