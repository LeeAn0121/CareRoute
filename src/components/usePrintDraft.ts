'use client';

import { useSyncExternalStore } from 'react';

import { captureAccountStorage, getAccountStorageRevision, subscribeAccountStorage } from '@/lib/accountStorage';

function serverSnapshot() { return null; }
function serverRevision() { return 0; }

function useAccountStoredValue(key: string | null, fallback: string | null | undefined, enabled: boolean) {
  useSyncExternalStore(subscribeAccountStorage, getAccountStorageRevision, serverRevision);
  const scope = captureAccountStorage();
  const draft = useSyncExternalStore(
    subscribeAccountStorage,
    () => enabled && key ? scope.getItem(key) : null,
    serverSnapshot,
  );
  const setValue = (value: string) => {
    if (enabled && key && scope.isCurrent()) scope.setItem(key, value);
  };
  return [enabled && scope.isCurrent() ? draft ?? fallback ?? '' : '', setValue] as const;
}

// Author/organization details are also private to the signed-in account.
export function usePrintSetting(key: string, enabled: boolean) {
  return useAccountStoredValue(key, '', enabled);
}

// Health is shared per person; memos belong to one visit date. Legacy unscoped
// memo drafts are deliberately left untouched because their date is unknown.
export function usePrintDraft(
  recipientId: string | undefined,
  field: 'health' | 'memo',
  dateKey: string,
  fallback?: string | null,
  enabled = true,
) {
  const key = recipientId
    ? `careroute_print_${field}_${recipientId}${field === 'memo' ? `_${dateKey}` : ''}`
    : null;
  return useAccountStoredValue(key, fallback, enabled);
}
