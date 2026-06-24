import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';
import { tryActivateLiveSession, tryActivateLivePass } from '../_shared/live-activation.ts';


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

async function logIpn(
  serviceClient: ReturnType<typeof createClient>,
  entry: Record<string, unknown>
) {
  const { error } = await serviceClient.from('nowpayments_ipn_log').insert(entry);
  if (error) console.error('Failed to log IPN:', error);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const rawText = await req.text();
  const signature = req.headers.get('x-nowpayments-sig');
  const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');

  console.log('NOWPayments IPN raw:', rawText);

  let body: any = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (err) {
    console.error('Invalid JSON in IPN:', err);
    await logIpn(serviceClient, {
      signature_present: !!signature,
      signature_valid: false,
      activation_result: 'error',
      error: 'Invalid JSON payload',
      raw_payload: { raw: rawText },
    });
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const paymentId = body?.payment_id ? String(body.payment_id) : null;
  const orderId = body?.order_id ? String(body.order_id) : null;
  const status = String(body?.payment_status || '').toLowerCase();

  const baseLog = {
    signature_present: !!signature,
    signature_valid: false as boolean,
    payment_id: paymentId,
    order_id: orderId,
    payment_status: status || null,
    pay_currency: body?.pay_currency ?? null,
    pay_amount: body?.pay_amount != null ? Number(body.pay_amount) : null,
    price_amount: body?.price_amount != null ? Number(body.price_amount) : null,
    price_currency: body?.price_currency ?? null,
    raw_payload: body,
  };

  // Signature check
  let signatureValid = false;
  if (ipnSecret) {
    signatureValid = verifySignature(rawText, signature, ipnSecret);
    if (!signatureValid) {
      console.error('NOWPayments IPN signature invalid');
      await logIpn(serviceClient, {
        ...baseLog,
        signature_valid: false,
        activation_result: 'rejected_signature',
        error: 'Invalid HMAC signature',
      });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('NOWPAYMENTS_IPN_SECRET not set — skipping signature check');
  }

  if (!paymentId && !orderId) {
    await logIpn(serviceClient, {
      ...baseLog,
      signature_valid: signatureValid,
      activation_result: 'error',
      error: 'No identifier in payload',
    });
    return new Response(JSON.stringify({ error: 'No identifier' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
    await logIpn(serviceClient, {
      ...baseLog,
      signature_valid: signatureValid,
      activation_result: 'not_found',
      error: 'No matching subscription',
    });
    return new Response(JSON.stringify({ error: 'Subscription not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (sub.status === 'active') {
    await logIpn(serviceClient, {
      ...baseLog,
      signature_valid: signatureValid,
      matched_subscription_id: sub.id,
      activation_result: 'already_active',
    });
    return new Response(JSON.stringify({ success: true, already_processed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let activationResult: string = 'noop';
  let activationError: string | null = null;

  if (SUCCESS_STATUSES.includes(status)) {
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

    if (error) {
      console.error('Activate error:', error);
      activationResult = 'error';
      activationError = error.message;
    } else {
      activationResult = 'activated';
      console.log('NOWPayments subscription activated:', sub.id, 'status:', status);
    }
  } else if (FAILURE_STATUSES.includes(status)) {
    const { error } = await serviceClient
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', sub.id);
    if (error) {
      activationResult = 'error';
      activationError = error.message;
    } else {
      activationResult = 'canceled';
      console.log('NOWPayments subscription canceled:', sub.id, 'status:', status);
    }
  } else {
    activationResult = 'pending';
    console.log('NOWPayments intermediate status, no-op:', status, 'sub:', sub.id);
  }

  await logIpn(serviceClient, {
    ...baseLog,
    signature_valid: signatureValid,
    matched_subscription_id: sub.id,
    activation_result: activationResult,
    error: activationError,
  });

  return new Response(JSON.stringify({ success: true, activation_result: activationResult }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
