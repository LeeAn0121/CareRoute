// 일정 탭의 방문 일정을 외부 캘린더 앱(구글 캘린더/애플 캘린더 등)에서 "구독"(iCal) 형태로
// 실시간으로 받아보게 하는 기능. 기존 "밀어넣기"(handleSyncToCalendar)는 누를 때마다 수동으로
// 다시 동기화해야 했지만, 구독 URL은 캘린더 앱이 주기적으로 알아서 다시 불러온다.
//
// 실제 iCal 생성 로직은 supabase/functions/calendar-feed(Edge Function)에 있다. 이 앱은
// 정적 배포(output: export)라 Next.js 라우트 핸들러로는 "요청마다 최신 데이터를 돌려주는"
// 동작을 만들 수 없기 때문이다.
//
// 이 앱에는 로그인/계정 시스템이 아직 없어 URL 자체에 비밀 토큰을 섞어 넣는 방식으로
// 짐작하기 어렵게만 막는다(진짜 인증은 아님 - 지금 앱 전체의 보안 수준과 동일한 한계).
// 아래 토큰은 Edge Function의 CALENDAR_FEED_TOKEN 환경변수와 반드시 같은 값이어야 한다.
export const CALENDAR_FEED_TOKEN = '2d910e91880438e593971897e7ef272cd91b6f0d0d5adddd';

const FUNCTIONS_BASE_URL = 'https://lzkmmrxgehevmyidbsqs.supabase.co/functions/v1';

export function buildCalendarFeedUrl(): string {
  return `${FUNCTIONS_BASE_URL}/calendar-feed?token=${CALENDAR_FEED_TOKEN}`;
}
