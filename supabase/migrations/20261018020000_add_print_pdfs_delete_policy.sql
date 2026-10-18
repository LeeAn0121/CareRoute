-- print_logs 레코드 삭제 시 함께 쌓인 PDF 파일도 정리할 수 있도록 공개 삭제 정책 추가.
CREATE POLICY "Public delete access for print pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'print-pdfs');
