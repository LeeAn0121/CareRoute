// 어르신 정보 출력(인쇄/PDF/공유) 이력 기록 및 조회.
// print_logs 테이블이 아직 없는 환경(마이그레이션 미적용)에서도 출력 기능 자체는
// 끊기지 않도록, 기록 실패는 콘솔에만 남기고 조용히 무시한다.
import { supabase } from './supabase';

export type PrintMethod = 'print' | 'pdf' | 'share';

export async function logPrintEvent(params: {
  recipientId?: string | null;
  recipientName: string;
  method: PrintMethod;
  batchCount?: number;
  authorName?: string | null;
}) {
  try {
    await supabase.from('print_logs').insert({
      recipient_id: params.recipientId || null,
      recipient_name: params.recipientName,
      method: params.method,
      batch_count: params.batchCount ?? null,
      author_name: params.authorName || null,
    });
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
