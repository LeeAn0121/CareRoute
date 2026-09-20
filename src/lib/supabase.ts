import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Next.js App Router의 공격적인 fetch 캐싱을 무력화하기 위해 no-store 옵션 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      // url param must be string or Request. We don't modify the url string.
      // Modifying query string with random params breaks PostgREST.
      return fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          ...options?.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  }
})
