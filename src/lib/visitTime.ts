/**
 * Helper utilities for formatting visit times and time ranges.
 * Notes may contain an optional time range tag: "TIME:HH:mm~HH:mm" or "TIME:HH:mm"
 * e.g., "2026-10-11,TIME:10:00~11:30"
 */

export interface ParsedVisitTime {
  startTime: string; // e.g. "10:00" or ""
  endTime: string;   // e.g. "11:30" or ""
  formattedText: string; // e.g. "10:00 ~ 11:30", "10:00", or "시간 미정"
  hasTime: boolean;
}

export function parseVisitTime(visitTime?: string | null, notes?: string | null): ParsedVisitTime {
  let startTime = '';
  let endTime = '';

  // 1. Try to extract from notes TIME tag first
  if (notes) {
    const timeMatch = notes.match(/TIME:(\d{2}:\d{2})(?:~(\d{2}:\d{2}))?/);
    if (timeMatch) {
      startTime = timeMatch[1];
      endTime = timeMatch[2] || '';
    }
  }

  // 2. Fallback to visit_time column if start time wasn't parsed from notes
  if (!startTime && visitTime && visitTime !== '00:00:00' && visitTime.length >= 5) {
    const raw = visitTime.substring(0, 5);
    if (raw !== '00:00') {
      startTime = raw;
    }
  }

  if (!startTime) {
    return {
      startTime: '',
      endTime: '',
      formattedText: '시간 미정',
      hasTime: false,
    };
  }

  const formattedText = endTime ? `${startTime} ~ ${endTime}` : startTime;
  return {
    startTime,
    endTime,
    formattedText,
    hasTime: true,
  };
}

/**
 * Returns clean notes without the TIME tag
 */
export function extractNotesWithoutTime(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('TIME:'))
    .join(',');
}

/**
 * Encodes start and end times into the notes string
 */
export function composeNotesWithTime(datesStr: string, startTime?: string, endTime?: string): string | null {
  const cleanDates = extractNotesWithoutTime(datesStr);
  const parts = cleanDates ? cleanDates.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (startTime) {
    if (endTime) {
      parts.push(`TIME:${startTime}~${endTime}`);
    } else {
      parts.push(`TIME:${startTime}`);
    }
  }

  return parts.length > 0 ? parts.join(',') : null;
}
