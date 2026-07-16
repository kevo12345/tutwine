create or replace function public.get_live_session_room(_session_id uuid)
returns table (
  id uuid,
  host_id uuid,
  status text,
  daily_room_url text,
  expires_at timestamptz,
  started_at timestamptz,
  thumbnail_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.host_id, s.status::text, s.daily_room_url,
         s.expires_at, s.started_at, s.thumbnail_url
  from public.live_sessions s
  where s.id = _session_id
  limit 1;
$$;

grant execute on function public.get_live_session_room(uuid) to authenticated;