-- 여러 요양보호사가 함께 쓸 때 "이 어르신은 누가 담당인지"를 알 수 있는 필드가 없었다.
-- 계정/로그인 시스템 이전 단계의 가벼운 버전으로, 자유 텍스트로 담당자명을 기록한다.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS assigned_caregiver_name TEXT;
