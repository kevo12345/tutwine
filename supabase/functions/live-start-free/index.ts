// Starts a FREE host live session directly (no payment).
// - Enforces auth via JWT
// - Enforces duration >= 1 hour
// - Provisions Daily.co room
// - Inserts an active live_sessions row and returns { session_id }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function provisionDailyRoom(name: string, expSeconds: number): Promise<string | null> {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) return null;
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      privacy: 'public',
      properties: {
        exp: expSeconds,
        enable_chat: false,
        enable_screenshare: false,
        enable_prejoin_ui: false,
        enable_network_ui: false,
        enable_people_ui: false,
        enable_video_processing_ui: false,
enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });
  if (!res.ok) {
    console.error('Daily room create failed:', res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json.url ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const durationHours = Number(body?.duration_hours);
    const thumbnailUrl = typeof body?.thumbnail_url === 'string' ? body.thumbnail_url : null;

    if (!thumbnailUrl) {
      return new Response(
        JSON.stringify({ error: 'A cover image is required to go live' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24) {
      return new Response(
        JSON.stringify({ error: 'duration_hours must be between 1 and 24' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Hosting a live is free — no subscription check.


    // Cancel any prior pending/active rows from this host to avoid dupes
    await service
      .from('live_sessions')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('host_id', userId)
      .in('status', ['pending_payment', 'active']);

    const startedAt = new Date();
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    const { data: inserted, error: insErr } = await service
      .from('live_sessions')
      .insert({
        host_id: userId,
        duration_hours: durationHours,
        amount_paid_usd: 0,
        currency: 'USD',
        provider: 'free',
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        thumbnail_url: thumbnailUrl,
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      console.error('Insert live_sessions failed', insErr);
      return new Response(JSON.stringify({ error: 'Could not start live' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roomName = `live-${inserted.id.slice(0, 12)}`;
    const roomUrl = await provisionDailyRoom(roomName, Math.floor(expiresAt.getTime() / 1000));
    if (!roomUrl) {
      await service.from('live_sessions').update({ status: 'canceled' }).eq('id', inserted.id);
      return new Response(JSON.stringify({ error: 'Could not provision video room' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await service
      .from('live_sessions')
      .update({ daily_room_url: roomUrl, daily_room_name: roomName })
      .eq('id', inserted.id);

    return new Response(
      JSON.stringify({ success: true, session_id: inserted.id, expires_at: expiresAt.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('live-start-free error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
