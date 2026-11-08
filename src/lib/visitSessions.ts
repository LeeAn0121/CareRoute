import { supabase } from './supabase';

export type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
export interface VisitSession {
  id: string;
  recipient_id: string | null;
  visit_date: string;
  status: VisitStatus;
  started_at: string | null;
  completed_at: string | null;
  memo: string | null;
  version: number;
  updated_at: string;
}
export interface VisitSessionEvent {
  id: string;
  session_id: string;
  from_status: VisitStatus | null;
  to_status: VisitStatus;
  before_state: VisitSession | null;
  after_state: VisitSession | null;
  reason: string | null;
  created_at: string;
}
export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  planned: '방문 예정', in_progress: '방문 중', completed: '방문 완료', missed: '미방문', cancelled: '방문 취소',
};
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const sessionKey = (recipientId: string | null, dateKey: string) => `${recipientId}/${dateKey}`;

export async function fetchVisitSessions(dates: string[]): Promise<VisitSession[]> {
  const rows: VisitSession[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('visit_sessions').select('*')
      .in('visit_date', [...new Set(dates)]).order('recipient_id').order('visit_date').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
export async function fetchVisitSessionEvents(id: string): Promise<VisitSessionEvent[]> {
  const { data, error } = await supabase.from('visit_session_events').select('*').eq('session_id', id)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}
export async function transitionVisitSession(params: {
  recipientId: string; dateKey: string; status: VisitStatus; memo?: string | null;
  reason?: string; expectedVersion: number; requestId: string;
}): Promise<VisitSession> {
  const { data, error } = await supabase.rpc('transition_visit_session', {
    p_recipient_id: params.recipientId, p_visit_date: params.dateKey, p_status: params.status,
    p_memo: params.memo || null, p_reason: params.reason || null,
    p_expected_version: params.expectedVersion, p_request_id: params.requestId,
  });
  if (error) {
    if (error.code === '40001') throw new Error('다른 기기에서 방문 기록이 변경되었습니다. 최신 기록을 확인한 뒤 다시 시도해 주세요.');
    if (error.code === 'P0002') throw new Error('어르신 정보가 변경되거나 삭제되었습니다. 목록을 다시 불러와 주세요.');
    if (error.message.includes('Completed sessions')) throw new Error('완료된 방문은 기록 화면에서 사유를 입력해 정정해 주세요.');
    if (error.message.includes('reason')) throw new Error('상태 변경 사유를 입력해 주세요.');
    if (error.message.includes('visit date')) throw new Error('선택한 방문 날짜에는 이 상태를 기록할 수 없습니다. 날짜와 기기 시간을 확인해 주세요.');
    throw new Error('방문 기록을 저장하지 못했습니다. 입력 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.');
  }
  const session = Array.isArray(data) ? data[0] : data;
  if (!session?.id || session.recipient_id !== params.recipientId || session.visit_date !== params.dateKey || session.status !== params.status || !Number.isInteger(session.version)) {
    throw new Error('방문 기록 저장 결과를 확인하지 못했습니다. 기록을 다시 불러와 주세요.');
  }
  return session;
}
