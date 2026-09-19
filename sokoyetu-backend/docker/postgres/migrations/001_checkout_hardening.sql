ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_code character varying;
