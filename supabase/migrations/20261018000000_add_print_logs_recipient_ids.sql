-- 일괄 출력 시 함께 출력된 전체 수급자 id 목록을 기록(단일 출력은 기존 recipient_id만 사용).
-- "출력됨" 배지(해당 날짜에 출력한 수급자인지)를 정확히 판단하기 위해 필요.
ALTER TABLE public.print_logs ADD COLUMN IF NOT EXISTS recipient_ids UUID[];
