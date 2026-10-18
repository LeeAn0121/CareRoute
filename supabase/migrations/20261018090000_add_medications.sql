-- 어르신별 복약 시간표. 방문 알림(visit_time)은 있었지만 몇 시에 무슨 약을 먹는지
-- 등록하고 방문 중 체크리스트로 확인하는 기능은 없었다.
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
    drug_name TEXT NOT NULL,
    dose TEXT,
    times_of_day TEXT, -- 콤마로 구분된 HH:mm 목록, 예: "08:00,20:00"
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.medications FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.medications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.medications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.medications FOR DELETE USING (true);
