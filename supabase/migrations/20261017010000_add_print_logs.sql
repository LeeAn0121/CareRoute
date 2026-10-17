-- 어르신 정보 출력(인쇄/PDF) 이력 기록용 테이블
CREATE TABLE IF NOT EXISTS public.print_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    method TEXT NOT NULL, -- 'print' | 'pdf' | 'share'
    batch_count INTEGER, -- 일괄 출력일 때 함께 출력된 인원 수
    author_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.print_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.print_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.print_logs FOR DELETE USING (true);
