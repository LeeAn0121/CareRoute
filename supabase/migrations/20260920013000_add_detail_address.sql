-- Split the freeform "address" field into a base address (from Daum postcode
-- search) and an optional detail address (e.g. dong/ho, floor) that used to
-- be concatenated into the same address string on save.
ALTER TABLE public.recipients
  ADD COLUMN IF NOT EXISTS detail_address TEXT;
