-- 응급 상황 시 바로 연락할 보호자/가족 연락처가 어디에도 없었다.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS guardian_relation TEXT;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
