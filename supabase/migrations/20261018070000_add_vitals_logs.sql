-- 방문마다 혈압/혈당/체온 같은 수치를 기록해 추이를 볼 수 있게 한다.
-- health_tags는 "고혈압" 같은 태그 한 줄만 저장할 뿐 실제 수치 추이는 전혀 남지 않았다.
CREATE TABLE IF NOT EXISTS public.vitals_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    blood_sugar INTEGER,
    temperature NUMERIC(4,1),
    memo TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.vitals_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.vitals_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vitals_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.vitals_logs FOR DELETE USING (true);
