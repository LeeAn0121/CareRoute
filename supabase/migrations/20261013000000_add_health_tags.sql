-- Add health_tags column to recipients table
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS health_tags TEXT;
