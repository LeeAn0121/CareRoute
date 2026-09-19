-- Create recipients table
CREATE TABLE IF NOT EXISTS public.recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    sido TEXT NOT NULL,
    sigungu TEXT NOT NULL,
    dong TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    visit_time TIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for simplicity in development)
CREATE POLICY "Allow public read access" ON public.recipients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.recipients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.recipients FOR DELETE USING (true);

-- Insert mock data (역삼동, 개포동)
INSERT INTO public.recipients (name, address, sido, sigungu, dong, lat, lng, visit_time)
VALUES
('김할머니', '서울특별시 강남구 역삼동 123', '1100000000', '1168000000', '1168010100', 37.5172, 127.0473, '10:00:00'),
('이할아버지', '서울특별시 강남구 개포동 456', '1100000000', '1168000000', '1168010300', 37.4890, 127.0650, '14:00:00');
