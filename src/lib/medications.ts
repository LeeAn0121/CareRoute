// 어르신별 복약 시간표(약 이름/용량/시간) CRUD.
import { supabase } from './supabase';

export interface MedicationRow {
  id: string;
  recipient_id: string;
  drug_name: string;
  dose: string | null;
  times_of_day: string | null;
  memo: string | null;
  created_at: string;
}

export async function fetchMedicationsForRecipient(recipientId: string): Promise<MedicationRow[]> {
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('id, recipient_id, drug_name, dose, times_of_day, memo, created_at')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('medications fetch failed', e);
    return [];
  }
}

export async function addMedication(params: {
  recipientId: string;
  drugName: string;
  dose?: string | null;
  timesOfDay?: string | null;
  memo?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('medications').insert({
      recipient_id: params.recipientId,
      drug_name: params.drugName,
      dose: params.dose || null,
      times_of_day: params.timesOfDay || null,
      memo: params.memo || null,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('medication insert failed', e);
    return false;
  }
}

export async function deleteMedication(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('medication delete failed', e);
    return false;
  }
}
