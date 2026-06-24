// Safety-net cron: marks expired live_sessions and live_passes as 'expired'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const nowIso = new Date().toISOString();

  const { data: sessions } = await service
    .from('live_sessions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', nowIso)
    .select('id');

  const { data: passes } = await service
    .from('live_passes')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', nowIso)
    .select('id');

  // Also drop very old pending payments (>30 min) so the unique partial index doesn't lock the host
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await service.from('live_sessions').update({ status: 'canceled' }).eq('status', 'pending_payment').lt('created_at', cutoff);
  await service.from('live_passes').update({ status: 'canceled' }).eq('status', 'pending_payment').lt('created_at', cutoff);

  return new Response(
    JSON.stringify({ expired_sessions: sessions?.length ?? 0, expired_passes: passes?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
