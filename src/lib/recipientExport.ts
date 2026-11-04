import { supabase } from './supabase';

export async function fetchAllRecipientsForExport(): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('recipients').select('*').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < pageSize) return result;
  }
}
