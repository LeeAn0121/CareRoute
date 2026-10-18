// 어르신 정보 출력(인쇄/PDF/공유) 이력 기록 및 조회.
// print_logs 테이블이 아직 없는 환경(마이그레이션 미적용)에서도 출력 기능 자체는
// 끊기지 않도록, 기록 실패는 콘솔에만 남기고 조용히 무시한다.
import { supabase } from './supabase';

export type PrintMethod = 'print' | 'pdf' | 'share';

export async function logPrintEvent(params: {
  recipientId?: string | null;
  recipientIds?: string[] | null;
  recipientName: string;
  method: PrintMethod;
  batchCount?: number;
  authorName?: string | null;
}) {
  try {
    const { error } = await supabase.from('print_logs').insert({
      recipient_id: params.recipientId || null,
      recipient_ids: params.recipientIds && params.recipientIds.length > 0 ? params.recipientIds : null,
      recipient_name: params.recipientName,
      method: params.method,
      batch_count: params.batchCount ?? null,
      author_name: params.authorName || null,
    });
    if (error) throw error;
  } catch (e) {
    console.error('print log insert failed', e);
  }
}

export interface PrintLogRow {
  id: string;
  recipient_name: string;
  method: PrintMethod;
  batch_count: number | null;
  author_name: string | null;
  created_at: string;
}

export async function fetchRecentPrintLogs(limit = 20): Promise<PrintLogRow[]> {
  try {
    const { data, error } = await supabase
      .from('print_logs')
      .select('id, recipient_name, method, batch_count, author_name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('print log fetch failed', e);
    return [];
  }
}

// 특정 어르신의 출력 이력만 조회(개별 출력 모달에서 사용). 단일 출력은 recipient_id,
// 일괄 출력은 recipient_ids 배열에 그 어르신이 포함되어 있으면 함께 보여준다.
export async function fetchRecentPrintLogsForRecipient(recipientId: string, limit = 20): Promise<PrintLogRow[]> {
  try {
    const { data, error } = await supabase
      .from('print_logs')
      .select('id, recipient_name, method, batch_count, author_name, created_at')
      .or(`recipient_id.eq.${recipientId},recipient_ids.cs.{${recipientId}}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('print log fetch (by recipient) failed', e);
    return [];
  }
}

// 일정 탭의 "출력됨" 배지용: 특정 날짜(로컬 기준)에 출력/공유된 수급자 id 전체를 모아 반환.
// 단일 출력은 recipient_id, 일괄 출력은 recipient_ids 배열에 담겨 있어 둘 다 합친다.
export async function fetchPrintedRecipientIdsForDate(dateKey: string): Promise<Set<string>> {
  const result = new Set<string>();
  try {
    const start = new Date(`${dateKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data, error } = await supabase
      .from('print_logs')
      .select('recipient_id, recipient_ids')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    if (error) throw error;
    (data || []).forEach((row) => {
      if (row.recipient_id) result.add(row.recipient_id);
      if (Array.isArray(row.recipient_ids)) row.recipient_ids.forEach((id: string) => result.add(id));
    });
  } catch (e) {
    console.error('printed recipient ids fetch failed', e);
  }
  return result;
}

// 달력에 출력 이력 표시용: [startKey, endKeyExclusive) 범위(로컬 날짜, YYYY-MM-DD) 안에
// 출력/공유 기록이 하나라도 있는 날짜들을 모아 반환한다.
export async function fetchPrintedDateKeysInRange(startKey: string, endKeyExclusive: string): Promise<Set<string>> {
  const result = new Set<string>();
  try {
    const start = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKeyExclusive}T00:00:00`);
    const { data, error } = await supabase
      .from('print_logs')
      .select('created_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    if (error) throw error;
    (data || []).forEach((row) => {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.add(key);
    });
  } catch (e) {
    console.error('printed date keys fetch failed', e);
  }
  return result;
}
