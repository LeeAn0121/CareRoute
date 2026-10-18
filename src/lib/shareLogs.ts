// 가족에게 보내는 안심 공유 리포트(카톡/문자/복사) 이력 기록 및 조회.
import { supabase } from './supabase';

export type ShareMethod = 'sms' | 'share' | 'copy';

export async function logShareEvent(params: {
  recipientId?: string | null;
  recipientName: string;
  method: ShareMethod;
  messageText?: string | null;
}) {
  try {
    const { error } = await supabase.from('share_logs').insert({
      recipient_id: params.recipientId || null,
      recipient_name: params.recipientName,
      method: params.method,
      message_text: params.messageText || null,
    });
    if (error) throw error;
  } catch (e) {
    console.error('share log insert failed', e);
  }
}

export interface ShareLogRow {
  id: string;
  recipient_name: string;
  method: ShareMethod;
  message_text: string | null;
  created_at: string;
}

const SHARE_LOG_COLUMNS = 'id, recipient_name, method, message_text, created_at';

export async function fetchRecentShareLogsForRecipient(recipientId: string, limit = 20): Promise<ShareLogRow[]> {
  try {
    const { data, error } = await supabase
      .from('share_logs')
      .select(SHARE_LOG_COLUMNS)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('share log fetch failed', e);
    return [];
  }
}
