-- "저장" 버튼(기기 저장 + 서버 보관)으로 올린 PDF의 스토리지 경로를 기록.
ALTER TABLE public.print_logs ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- 저장된 PDF를 담을 버킷. 로그인 체계가 없는 앱 구조상 다른 테이블(print_logs 등)과
-- 동일하게 공개 읽기/쓰기로 둔다.
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-pdfs', 'print-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for print pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'print-pdfs');

CREATE POLICY "Public upload access for print pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'print-pdfs');
