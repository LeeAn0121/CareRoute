import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Next.js App Router의 공격적인 fetch 캐싱을 무력화하기 위해 no-store 옵션 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
})
