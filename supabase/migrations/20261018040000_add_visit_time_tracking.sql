-- 방문 시작/종료 시각 기록용. 기존에는 "완료" 여부(날짜)만 남고 실제 머문 시간은
-- 전혀 기록되지 않았다. last_visit_started_at은 "지금 진행 중인 방문"의 시작 시각을
-- 임시로 들고 있다가, 완료 처리 시 visit_logs에 시작/종료 시각을 함께 남기고 비운다.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS last_visit_started_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.visit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.visit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.visit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.visit_logs FOR DELETE USING (true);
