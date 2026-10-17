-- Add age and care grade (장기요양등급) columns to recipients table for print profile output
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS care_grade TEXT;
