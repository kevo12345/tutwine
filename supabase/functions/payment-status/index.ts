import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';

type PayState =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'finished'
  | 'failed'
  | 'expired'
  | 'timeout';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Maps a NOWPayments payment_status onto our canonical states. */
function mapNowPaymentsStatus(status: string): PayState {
  switch ((status || '').toLowerCase()) {
    case 'waiting':
      return 'waiting';
    case 'confirming':
    case 'sending':
    case 'partially_paid':
      return 'confirming';
    case 'confirmed':
      return 'confirmed';
    case 'finished':
      return 'finished';
    case 'failed':
    case 'refunded':
      return 'failed';
    case 'expired':
      return 'expired';
    default:
      return 'waiting';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const purchaseType = String(body?.purchase_type ?? '');
    const orderId = body?.order_id ? String(body.order_id) : '';
    const paymentId = body?.payment_id ? String(body.payment_id) : '';
    const paymentMethod = String(body?.payment_method ?? '');

    if (!purchaseType || !orderId) {
      return json({ error: 'purchase_type and order_id are required' }, 400);
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ---------- Subscriptions ----------
    if (purchaseType === 'subscription') {
      const { data: sub, error } = await service
        .from('subscriptions')
        .select('id, user_id, tier, status, ends_at, provider, provider_sub_id')
        .eq('id', orderId)
        .maybeSingle();

      if (error || !sub) return json({ error: 'Order not found' }, 404);
      if (sub.user_id !== userId) return json({ error: 'Forbidden' }, 403);

      const active =
        sub.status === 'active' && (!sub.ends_at || new Date(sub.ends_at) > new Date());
      if (active) return json({ state: 'finished', order_id: sub.id });
      if (sub.status === 'canceled' || sub.status === 'expired') {
        return json({ state: 'failed', order_id: sub.id });
      }

      // Still pending (past_due). Crypto payments can be verified with the provider.
      if (paymentMethod === 'crypto') {
        const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
        const npId = paymentId || sub.provider_sub_id;
        if (apiKey && npId) {
          const res = await fetch(`${NOWPAYMENTS_BASE}/payment/${npId}`, {
            headers: { 'x-api-key': apiKey },
          });
          const npData = await res.json().catch(() => null);
          if (res.ok && npData?.payment_status) {
            const state = mapNowPaymentsStatus(String(npData.payment_status));

            // Idempotent activation: only flips a still-pending row.
            if (state === 'finished') {
              const durationDays = sub.tier === 'simp' ? 14 : 30;
              await service
                .from('subscriptions')
                .update({
                  status: 'active',
                  started_at: new Date().toISOString(),
                  ends_at: new Date(
                    Date.now() + durationDays * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                })
                .eq('id', sub.id)
                .eq('status', 'past_due');
            }
            return json({ state, order_id: sub.id, provider_status: npData.payment_status });
          }
        }
      }

      // M-Pesa (and crypto without a provider answer): the callback is the source of truth.
      return json({ state: 'waiting', order_id: sub.id });
    }

    // ---------- Token purchases / other token-backed purchases ----------
    const { data: tx, error: txErr } = await service
      .from('token_transactions')
      .select('id, user_id, status, type, amount')
      .eq('id', orderId)
      .maybeSingle();

    if (txErr || !tx) return json({ error: 'Order not found' }, 404);
    if (tx.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    if (tx.status === 'completed') return json({ state: 'finished', order_id: tx.id });
    if (tx.status === 'failed') return json({ state: 'failed', order_id: tx.id });
    return json({ state: 'waiting', order_id: tx.id });
  } catch (err) {
    console.error('payment-status error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
