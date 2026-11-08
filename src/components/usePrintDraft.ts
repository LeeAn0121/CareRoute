'use client';

import { useSyncExternalStore } from 'react';

const draftChangeEvent = 'careroute-print-draft-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(draftChangeEvent, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(draftChangeEvent, onChange);
  };
}

function serverSnapshot() {
  return null;
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
  const draft = useSyncExternalStore(
    subscribe,
    () => enabled && key ? localStorage.getItem(key) : null,
    serverSnapshot,
  );

  const setValue = (value: string) => {
    if (!enabled || !key) return;
    // Persist only explicit edits, never state left over from a previous key.
    // An empty string is a saved draft, so clearing a memo suppresses fallback.
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(draftChangeEvent));
  };

  return [draft ?? fallback ?? '', setValue] as const;
}
