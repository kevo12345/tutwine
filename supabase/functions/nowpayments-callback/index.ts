import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nowpayments-sig',
};

// NOWPayments requires keys sorted alphabetically before HMAC-SHA512
function sortObjectDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectDeep);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortObjectDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const parsed = JSON.parse(rawBody);
    const sorted = sortObjectDeep(parsed);
    const sortedString = JSON.stringify(sorted);
    const computed = createHmac('sha512', secret).update(sortedString).digest('hex');
    return computed === signature;
  } catch (err) {
    console.error('Signature verify error:', err);
    return false;
  }
}

const SUCCESS_STATUSES = ['finished', 'confirmed', 'sending', 'partially_paid'];
const FAILURE_STATUSES = ['failed', 'expired', 'refunded'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawText = await req.text();
    const signature = req.headers.get('x-nowpayments-sig');
    const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');

    console.log('NOWPayments IPN raw:', rawText);

    if (ipnSecret) {
      const ok = verifySignature(rawText, signature, ipnSecret);
      if (!ok) {
        console.error('NOWPayments IPN signature invalid');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('NOWPAYMENTS_IPN_SECRET not set — skipping signature check');
    }

    const body = JSON.parse(rawText);
    const paymentId = body?.payment_id ? String(body.payment_id) : null;
    const orderId = body?.order_id ? String(body.order_id) : null;
    const status = String(body?.payment_status || '').toLowerCase();

    if (!paymentId && !orderId) {
      return new Response(JSON.stringify({ error: 'No identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Try by order_id (our subscription UUID) first, then by provider_sub_id (payment_id)
    let sub: any = null;
    if (orderId) {
      const { data } = await serviceClient
        .from('subscriptions')
        .select('id, user_id, tier, status')
        .eq('id', orderId)
        .maybeSingle();
      sub = data;
    }
    if (!sub && paymentId) {
      const { data } = await serviceClient
        .from('subscriptions')
        .select('id, user_id, tier, status')
        .eq('provider_sub_id', paymentId)
        .maybeSingle();
      sub = data;
    }

    if (!sub) {
      console.error('No matching subscription for IPN', { paymentId, orderId });
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sub.status === 'active') {
      return new Response(JSON.stringify({ success: true, already_processed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (SUCCESS_STATUSES.includes(status)) {
      // Cancel any other active subs for this user
      await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled', ends_at: new Date().toISOString() })
        .eq('user_id', sub.user_id)
        .eq('status', 'active')
        .neq('id', sub.id);

      const durationDays = sub.tier === 'simp' ? 14 : 30;
      const { error } = await serviceClient
        .from('subscriptions')
        .update({
          status: 'active',
          provider_sub_id: paymentId || sub.id,
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', sub.id);

      if (error) console.error('Activate error:', error);
      console.log('NOWPayments subscription activated:', sub.id, 'status:', status);
    } else if (FAILURE_STATUSES.includes(status)) {
      await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', sub.id);
      console.log('NOWPayments subscription canceled:', sub.id, 'status:', status);
    } else {
      console.log('NOWPayments intermediate status, no-op:', status, 'sub:', sub.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('nowpayments-callback error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
