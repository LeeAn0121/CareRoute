-- 안심 공유 리포트(가족에게 보내는 카톡/문자/복사)를 한 번 보내고 나면 그 내용이 어디에도
-- 남지 않아, 나중에 "지난번에 가족한테 뭐라고 전달했지?"를 확인할 방법이 없었다.
CREATE TABLE IF NOT EXISTS public.share_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    method TEXT NOT NULL, -- 'sms' | 'share' | 'copy'
    message_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.share_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.share_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.share_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.share_logs FOR DELETE USING (true);
