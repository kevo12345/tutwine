import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sellapayTransactionStatus } from '../_shared/sellapay.ts';

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

      // M-Pesa: verify with SellaPay directly if the callback never landed.
      if (paymentMethod === 'mpesa') {
        const ref = String(sub.id).replace(/-/g, '').slice(0, 20);
        const verdict = await sellapayTransactionStatus(sub.provider_sub_id || ref);
        if (verdict === 'success') {
          const durationDays = sub.tier === 'simp' ? 14 : 30;
          await service
            .from('subscriptions')
            .update({
              status: 'active',
              started_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', sub.id)
            .eq('status', 'past_due');
          return json({ state: 'finished', order_id: sub.id, provider_status: 'completed' });
        }
        if (verdict === 'failed') {
          return json({ state: 'failed', order_id: sub.id, provider_status: 'failed' });
        }
      }

      // Re-read in case a callback landed meanwhile.
      const { data: freshSub } = await service
        .from('subscriptions')
        .select('status, ends_at')
        .eq('id', sub.id)
        .maybeSingle();
      if (
        freshSub?.status === 'active' &&
        (!freshSub.ends_at || new Date(freshSub.ends_at) > new Date())
      ) {
        return json({ state: 'finished', order_id: sub.id });
      }

      return json({ state: 'confirming', order_id: sub.id });
    }


    // ---------- Token purchases / other token-backed purchases ----------
    const { data: tx, error: txErr } = await service
      .from('token_transactions')
      .select('id, user_id, status, type, amount, payment_ref')
      .eq('id', orderId)
      .maybeSingle();

    if (txErr || !tx) return json({ error: 'Order not found' }, 404);
    if (tx.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    if (tx.status === 'completed') return json({ state: 'finished', order_id: tx.id });
    if (tx.status === 'failed') return json({ state: 'failed', order_id: tx.id });

    // Crypto coin purchases can be verified directly with NOWPayments.
    if (paymentMethod === 'crypto') {
      const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
      const npId = paymentId || tx.payment_ref;
      if (apiKey && npId) {
        const res = await fetch(`${NOWPAYMENTS_BASE}/payment/${npId}`, {
          headers: { 'x-api-key': apiKey },
        });
        const npData = await res.json().catch(() => null);
        if (res.ok && npData?.payment_status) {
          const state = mapNowPaymentsStatus(String(npData.payment_status));
          if (state === 'finished' || state === 'confirmed') {
            // Idempotent: complete_token_purchase only credits a pending row.
            const { error: rpcErr } = await service.rpc('complete_token_purchase', {
              _tx_id: tx.id,
              _payment_ref: String(npId),
            });
            if (rpcErr) console.error('complete_token_purchase failed:', rpcErr);
            else return json({ state: 'finished', order_id: tx.id, provider_status: npData.payment_status });
          }
          if (state === 'failed' || state === 'expired') {
            await service.rpc('fail_token_purchase', { _tx_id: tx.id, _payment_ref: String(npId) });
          }
          return json({ state, order_id: tx.id, provider_status: npData.payment_status });
        }
      }
    }

    // M-Pesa coin purchases: actively verify with SellaPay in case the callback
    // never reached us. `complete_token_purchase` is idempotent.
    if (paymentMethod === 'mpesa') {
      const refs = [tx.payment_ref, String(tx.id).replace(/-/g, '').slice(0, 20)].filter(
        Boolean,
      ) as string[];
      for (const ref of refs) {
        const verdict = await sellapayTransactionStatus(ref);
        if (verdict === 'success') {
          const { error: rpcErr } = await service.rpc('complete_token_purchase', {
            _tx_id: tx.id,
            _payment_ref: ref,
          });
          if (rpcErr) {
            console.error('complete_token_purchase failed:', rpcErr);
            break;
          }
          return json({ state: 'finished', order_id: tx.id, provider_status: 'completed' });
        }
        if (verdict === 'failed') {
          await service.rpc('fail_token_purchase', { _tx_id: tx.id, _payment_ref: ref });
          return json({ state: 'failed', order_id: tx.id, provider_status: 'failed' });
        }
      }
    }

    // Re-read: a callback may have landed while we were probing the provider.
    const { data: fresh } = await service
      .from('token_transactions')
      .select('status')
      .eq('id', tx.id)
      .maybeSingle();
    if (fresh?.status === 'completed') return json({ state: 'finished', order_id: tx.id });
    if (fresh?.status === 'failed') return json({ state: 'failed', order_id: tx.id });

    return json({ state: 'confirming', order_id: tx.id });


  } catch (err) {
    console.error('payment-status error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
