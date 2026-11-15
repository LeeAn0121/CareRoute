import { supabase } from './supabase';

export class RecipientLoadError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
  get denied() { return this.status === 401 || this.status === 403 || this.code === '42501'; }
  get transient() { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

/** Fetch complete, stable pages. Never turn a partial page sequence into a complete list. */
export async function loadRecipients(signal: AbortSignal): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total: number | null = null;
  while (true) {
    signal.throwIfAborted();
    let page: Record<string, unknown>[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const stop = () => controller.abort();
      signal.addEventListener('abort', stop, { once: true });
      const timer = setTimeout(stop, 15_000);
      try {
        const { data, error, status, count } = await supabase.from('recipients')
          .select('*', offset === 0 ? { count: 'exact' } : {})
          .order('id').range(offset, offset + 499).abortSignal(controller.signal);
        signal.throwIfAborted();
        if (error) throw new RecipientLoadError(error.message, controller.signal.aborted ? 0 : status, error.code);
        if (!Array.isArray(data)) throw new RecipientLoadError('명단 응답을 확인하지 못했습니다.', 502);
        if (offset === 0) total = count;
        page = data;
        break;
      } catch (cause) {
        signal.throwIfAborted();
        const failure = cause instanceof RecipientLoadError ? cause : new RecipientLoadError('명단 연결이 지연되고 있습니다.', 0);
        if (attempt === 1 || !failure.transient) throw failure;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', stop);
      }
    }
    if (!page.length) {
      if (total !== null && offset < total) throw new RecipientLoadError('명단 일부가 누락되었습니다. 다시 불러와 주세요.', 502);
      return rows;
    }
    for (const row of page) {
      if (typeof row.id !== 'string' || seen.has(row.id)) throw new RecipientLoadError('명단 조회 순서를 확인하지 못했습니다. 다시 불러와 주세요.', 502);
      seen.add(row.id);
      rows.push(row);
    }
    offset += page.length;
    if (total !== null ? offset >= total : page.length < 500) return rows;
  }
}
