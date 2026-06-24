
CREATE TABLE public.live_overlay_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_overlay_messages_session_created_idx
  ON public.live_overlay_messages (session_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.live_overlay_messages TO authenticated;
GRANT ALL ON public.live_overlay_messages TO service_role;

ALTER TABLE public.live_overlay_messages ENABLE ROW LEVEL SECURITY;

-- Helper: caller is the host or has an active pass for this session
CREATE OR REPLACE FUNCTION public.has_live_access(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = _session_id
      AND s.status = 'active'
      AND s.expires_at > now()
      AND (
        s.host_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.live_passes lp
          WHERE lp.session_id = s.id
            AND lp.viewer_id = _user_id
            AND lp.status = 'active'
            AND lp.expires_at > now()
        )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_live_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_live_access(uuid, uuid) TO authenticated;

CREATE POLICY "Participants can read overlay messages"
ON public.live_overlay_messages
FOR SELECT
TO authenticated
USING (public.has_live_access(session_id, auth.uid()));

CREATE POLICY "Participants can post overlay messages"
ON public.live_overlay_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND public.has_live_access(session_id, auth.uid())
);

CREATE POLICY "Authors can delete their overlay messages"
ON public.live_overlay_messages
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_overlay_messages;
