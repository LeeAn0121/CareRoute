-- 방문완료 처리 시 함께 저장하는 돌봄 일지 메모 컬럼이 실제로는 생성된 적이 없어,
-- 이 컬럼을 포함한 recipients UPDATE가 전부 조용히 실패(에러 미확인)하고 있었다.
-- last_completed_key까지 함께 저장되지 않아 "방문완료" 상태가 새로고침 시 사라졌다.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS last_completed_memo TEXT;
