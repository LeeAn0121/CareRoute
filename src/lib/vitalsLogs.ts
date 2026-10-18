// 방문 시 측정한 활력징후(혈압/혈당/체온) 기록 및 추이 조회.
import { supabase } from './supabase';

export interface VitalsInput {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  bloodSugar?: number | null;
  temperature?: number | null;
}

export function hasAnyVitals(v: VitalsInput): boolean {
  return v.systolicBp != null || v.diastolicBp != null || v.bloodSugar != null || v.temperature != null;
}

export async function logVitals(params: {
  recipientId: string;
  recipientName: string;
  vitals: VitalsInput;
  memo?: string | null;
}) {
  if (!hasAnyVitals(params.vitals)) return;
  try {
    const { error } = await supabase.from('vitals_logs').insert({
      recipient_id: params.recipientId,
      recipient_name: params.recipientName,
      systolic_bp: params.vitals.systolicBp ?? null,
      diastolic_bp: params.vitals.diastolicBp ?? null,
      blood_sugar: params.vitals.bloodSugar ?? null,
      temperature: params.vitals.temperature ?? null,
      memo: params.memo || null,
    });
    if (error) throw error;
  } catch (e) {
    console.error('vitals log insert failed', e);
  }
}

export interface VitalsLogRow {
  id: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  blood_sugar: number | null;
  temperature: number | null;
  memo: string | null;
  recorded_at: string;
}

const VITALS_LOG_COLUMNS = 'id, systolic_bp, diastolic_bp, blood_sugar, temperature, memo, recorded_at';

export async function fetchRecentVitalsForRecipient(recipientId: string, limit = 20): Promise<VitalsLogRow[]> {
  try {
    const { data, error } = await supabase
      .from('vitals_logs')
      .select(VITALS_LOG_COLUMNS)
      .eq('recipient_id', recipientId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('vitals log fetch failed', e);
    return [];
  }
}
