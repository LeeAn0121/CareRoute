import { supabase } from './supabase';
import { requireVerifiedStorageAccount } from './privateStorage';

export async function fetchAllRecipientsForExport(): Promise<Record<string, unknown>[]> {
  const scope = await requireVerifiedStorageAccount();
  const result: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    if (!scope.isCurrent()) throw new Error('계정이 변경되어 내보내기를 중단했습니다.');
    const { data, error } = await supabase.from('recipients').select('*').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!scope.isCurrent()) throw new Error('계정이 변경되어 내보내기를 중단했습니다.');
    result.push(...(data || []));
    if (!data || data.length < pageSize) return result;
  }
}
