// Creates a payment for either going live (host) or joining a live session (viewer).
// Inserts a pending live_sessions or live_passes row, then dispatches the actual
// payment via SellaPay STK push or NOWPayments crypto, just like subscriptions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SELLAPAY_BASE = 'https://pay.sellapay.co.ke/api';
const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';
const ALLOWED_CRYPTO = ['ltc', 'usdttrc20'];
// NOWPayments rejects USDT-TRC20 invoices below this amount (AMOUNT_MINIMAL_ERROR).
// Block server-side so a UI bypass returns a clear, actionable error.
const USDT_TRC20_MIN_USD = 8;

function priceForHours(hours: number): number {
  const h = Math.max(1, Math.floor(hours));
  const base = Math.min(h, 2) * 1.5;
  const extra = Math.max(0, h - 2) * 0.35;
  return Math.round((base + extra) * 100) / 100;
}

function cleanKenyanPhone(phone: string) {
  let p = phone.replace(/\s+/g, '').replace(/^(\+?254)/, '');
  if (p.startsWith('0')) p = p.substring(1);
  return p;
}

async function getSellapayToken(): Promise<string> {
  const apiKey = Deno.env.get('SELLAPAY_API_KEY');
  const apiSecret = Deno.env.get('SELLAPAY_SECRET_KEY');
  if (!apiKey || !apiSecret) throw new Error('SellaPay credentials not configured');
  const res = await fetch(`${SELLAPAY_BASE}/index.php?action=authorize`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'X-API-SECRET': apiSecret, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({}),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SellaPay auth failed: ${res.status} ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw);
  const token = data.access_token || data.token;
  if (!token) throw new Error('SellaPay auth: no access_token');
  return token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { kind, session_id, duration_hours, provider, phone, pay_currency, kes_amount } = body || {};

    // Hosting a live is always free. Reject any attempt to create a host
    // billing transaction, regardless of what the client sends.
    if (kind === 'host') {
      return new Response(
        JSON.stringify({ error: 'Hosting a live is free — no payment required.', code: 'HOST_FREE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (kind !== 'viewer') {
      return new Response(JSON.stringify({ error: 'kind must be viewer' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['sellapay', 'nowpayments'].includes(provider)) {
      return new Response(JSON.stringify({ error: 'unsupported provider' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const hours = Number(duration_hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return new Response(JSON.stringify({ error: 'invalid duration_hours' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (kind === 'viewer' && !session_id) {
      return new Response(JSON.stringify({ error: 'session_id required for viewer' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const amountUsd = priceForHours(hours);
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Cancel previous pending rows for this user
    if (kind === 'host') {
      await service.from('live_sessions').update({ status: 'canceled' }).eq('host_id', userId).eq('status', 'pending_payment');
    } else {
      await service.from('live_passes').update({ status: 'canceled' }).eq('viewer_id', userId).eq('status', 'pending_payment').eq('session_id', session_id);
    }

    // Insert pending row
    let rowId: string;
    if (kind === 'host') {
      const { data, error } = await service
        .from('live_sessions')
        .insert({ host_id: userId, duration_hours: hours, amount_paid_usd: amountUsd, currency: provider === 'sellapay' ? 'KES' : 'USD', provider, status: 'pending_payment' })
        .select('id')
        .single();
      if (error || !data) {
        console.error('Insert live_sessions failed', error);
        return new Response(JSON.stringify({ error: 'Could not create live session' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      rowId = data.id;
    } else {
      const { data, error } = await service
        .from('live_passes')
        .insert({ viewer_id: userId, session_id, duration_hours: hours, amount_paid_usd: amountUsd, currency: provider === 'sellapay' ? 'KES' : 'USD', provider, status: 'pending_payment' })
        .select('id')
        .single();
      if (error || !data) {
        console.error('Insert live_passes failed', error);
        return new Response(JSON.stringify({ error: 'Could not create live pass' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      rowId = data.id;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    if (provider === 'sellapay') {
      if (!phone) {
        await cancelRow(service, kind, rowId);
        return new Response(JSON.stringify({ error: 'phone is required for M-Pesa' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const amountKes = Math.max(1, Math.round(Number(kes_amount) || amountUsd * 130));
      const cleanPhone = cleanKenyanPhone(String(phone));
      const sellapayToken = await getSellapayToken();
      const callbackUrl = `${supabaseUrl}/functions/v1/sellapay-callback?live_${kind === 'host' ? 'session' : 'pass'}_id=${rowId}`;
      const stkRes = await fetch(`${SELLAPAY_BASE}/v1/requestStkPush`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellapayToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount: amountKes,
          phone: cleanPhone,
          note: `TutWine Live ${hours}h`,
          reference: rowId,
          description: `TutWine Live ${kind} ${hours}h`,
          callbackUrl,
          callback_url: callbackUrl,
        }),
      });
      const raw = await stkRes.text();
      let stk: any = null;
      try { stk = JSON.parse(raw); } catch { stk = { raw }; }
      if (!stkRes.ok) {
        console.error('Live STK push failed', stk);
        await cancelRow(service, kind, rowId);
        return new Response(JSON.stringify({ error: 'STK push failed', details: stk }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const providerRef = stk?.transaction_id || stk?.message?.transaction_id || stk?.CheckoutRequestID || stk?.message?.CheckoutRequestID || rowId;
      await updateRow(service, kind, rowId, { provider_ref: String(providerRef) });
      return new Response(JSON.stringify({ success: true, id: rowId, kind, amount_usd: amountUsd, amount_kes: amountKes, message: 'STK push sent — check your phone' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // NOWPayments crypto
    const cur = String(pay_currency || '').toLowerCase();
    if (!ALLOWED_CRYPTO.includes(cur)) {
      await cancelRow(service, kind, rowId);
      return new Response(JSON.stringify({ error: 'Only LTC and USDT (TRC20) are supported' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (cur === 'usdttrc20' && amountUsd < USDT_TRC20_MIN_USD) {
      await cancelRow(service, kind, rowId);
      return new Response(
        JSON.stringify({
          error: `USDT (TRC20) requires at least $${USDT_TRC20_MIN_USD}. This duration is only $${amountUsd.toFixed(2)} — please choose Litecoin, pay with M-Pesa, or pick a longer duration.`,
          code: 'USDT_MIN_AMOUNT',
          min_usd: USDT_TRC20_MIN_USD,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const npKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!npKey) {
      await cancelRow(service, kind, rowId);
      return new Response(JSON.stringify({ error: 'NOWPayments not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const ipnUrl = `${supabaseUrl}/functions/v1/nowpayments-callback`;
    const npRes = await fetch(`${NOWPAYMENTS_BASE}/payment`, {
      method: 'POST',
      headers: { 'x-api-key': npKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: 'usd',
        pay_currency: cur,
        order_id: rowId,
        order_description: `TutWine Live ${kind} ${hours}h`,
        ipn_callback_url: ipnUrl,
      }),
    });
    const np = await npRes.json();
    if (!npRes.ok || !np?.payment_id) {
      console.error('NOWPayments create failed', np);
      await cancelRow(service, kind, rowId);
      return new Response(JSON.stringify({ error: np?.message || 'Crypto payment failed', details: np }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await updateRow(service, kind, rowId, { provider_ref: String(np.payment_id) });
    return new Response(
      JSON.stringify({
        success: true,
        id: rowId,
        kind,
        amount_usd: amountUsd,
        payment_id: np.payment_id,
        pay_address: np.pay_address,
        pay_amount: np.pay_amount,
        pay_currency: np.pay_currency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('live-create-payment error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function cancelRow(service: ReturnType<typeof createClient>, kind: string, id: string) {
  const table = kind === 'host' ? 'live_sessions' : 'live_passes';
  await service.from(table).update({ status: 'canceled' }).eq('id', id);
}
async function updateRow(service: ReturnType<typeof createClient>, kind: string, id: string, patch: Record<string, unknown>) {
  const table = kind === 'host' ? 'live_sessions' : 'live_passes';
  await service.from(table).update(patch).eq('id', id);
}
