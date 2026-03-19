-- Add onboarding_step to track progress for resume capability
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;