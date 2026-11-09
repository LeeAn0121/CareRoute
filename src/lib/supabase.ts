import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const sensitiveRequests = new Set<AbortController>();

/** Auth requests are deliberately excluded so logout/refresh can finish. */
export function abortSensitiveRequests() {
  for (const controller of sensitiveRequests) controller.abort();
  sensitiveRequests.clear();
}

// Next.js App Router의 공격적인 fetch 캐싱을 무력화하기 위해 no-store 옵션 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    fetch: async (url, options) => {
      // options.headers가 Headers 객체일 수 있으므로 안전하게 복사
      const headers = new Headers(options?.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      const sensitive = !new URL(requestUrl, supabaseUrl).pathname.startsWith('/auth/v1/');
      const controller = sensitive ? new AbortController() : null;
      const signal = options?.signal || (typeof Request !== 'undefined' && url instanceof Request ? url.signal : null);
      const abort = () => controller?.abort();
      if (controller) {
        sensitiveRequests.add(controller);
        if (signal?.aborted) controller.abort();
        else signal?.addEventListener('abort', abort, { once: true });
      }
      try {
        return await fetch(url, {
          ...options,
          signal: controller?.signal || signal,
          cache: 'no-store',
          headers
        });
      } finally {
        if (controller) sensitiveRequests.delete(controller);
        signal?.removeEventListener('abort', abort);
      }
    }
  }
})
