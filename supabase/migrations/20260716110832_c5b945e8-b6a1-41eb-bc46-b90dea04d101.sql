
ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS daily_room_name text,
  ADD COLUMN IF NOT EXISTS daily_room_url text;

-- Prevent viewers from writing daily fields via the existing UPDATE policy:
-- restrict client UPDATE to specific columns via a column-level grant.
REVOKE UPDATE ON public.lives FROM authenticated;
GRANT UPDATE (title, banner_url, status, ended_at, viewer_count, like_count)
  ON public.lives TO authenticated;
