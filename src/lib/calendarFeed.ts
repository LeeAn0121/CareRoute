import { supabase } from './supabase';

// Issued once by authenticated RPC; never persist the capability in browser storage.
// Every copy rotates this account's token and invalidates its old subscription.
export async function buildCalendarFeedUrl(): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Supabase URL이 설정되지 않았습니다.');
  const { data, error } = await supabase.rpc('rotate_calendar_feed_token');
  if (error || typeof data !== 'string' || !/^[a-f0-9]{512}$/.test(data)) {
    throw new Error('일정 구독 링크를 발급하지 못했습니다. Google 로그인을 확인해주세요.');
  }
  const url = new URL('/functions/v1/calendar-feed', base);
  url.searchParams.set('token', data);
  return url.toString();
}

export async function revokeCalendarFeedToken(): Promise<void> {
  const { error } = await supabase.rpc('revoke_calendar_feed_token');
  if (error) throw new Error('일정 구독 해제에 실패했습니다. Google 로그인을 확인해주세요.');
}
