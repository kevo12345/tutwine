import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SELLAPAY_BASE = 'https://pay.sellapay.co.ke/api/v1';

async function getSellapayToken(): Promise<string> {
  const apiKey = Deno.env.get('SELLAPAY_API_KEY');
  const apiSecret = Deno.env.get('SELLAPAY_SECRET_KEY');

  if (!apiKey || !apiSecret) {
    throw new Error('SellaPay credentials not configured');
  }

  const authAttempts: RequestInit[] = [
    {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'X-API-SECRET': apiSecret,
        'Accept': 'application/json',
      },
    },
    {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
        'Accept': 'application/json',
      },
    },
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'X-API-SECRET': apiSecret,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    },
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey, apiSecret }),
    },
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ api_key: apiKey, api_secret: apiSecret }).toString(),
    },
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
        'Accept': 'application/json',
      },
    },
  ];

  const failures: string[] = [];
  for (const [index, init] of authAttempts.entries()) {
    const res = await fetch(`${SELLAPAY_BASE}/authorize`, init);
    const raw = await res.text();
    const preview = raw?.slice(0, 500) || 'empty response';
    console.log(`SellaPay /authorize attempt ${index + 1} [${init.method}] status:`, res.status, 'body:', preview);

    if (raw && raw.trim().length > 0) {
      try {
        const data = JSON.parse(raw);
        const accessToken = data.access_token || data.token || data?.data?.access_token || data?.data?.token;
        if (res.ok && accessToken) return accessToken;
        failures.push(`attempt ${index + 1}: status ${res.status}, no token`);
      } catch (_e) {
        if (res.ok && /^[A-Za-z0-9._-]{20,}$/.test(raw.trim())) {
          return raw.trim();
        }
        failures.push(`attempt ${index + 1}: status ${res.status}, non-JSON`);
      }
    } else {
      failures.push(`attempt ${index + 1}: status ${res.status}, empty response`);
    }
  }

  throw new Error(`SellaPay auth failed: ${failures.join('; ')}`);
}

function cleanKenyanPhoneNumber(phone: string) {
  let cleanPhone = phone.replace(/\s+/g, '').replace(/^(\+?254)/, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }
  return cleanPhone;
}

function extractProviderSubscriptionId(stkData: any, fallbackReference: string) {
  return (
    stkData?.transaction_id ||
    stkData?.TransactionID ||
    stkData?.CheckoutRequestID ||
    stkData?.checkout_request_id ||
    stkData?.message?.transaction_id ||
    stkData?.message?.TransactionID ||
    stkData?.message?.CheckoutRequestID ||
    stkData?.message?.checkout_request_id ||
    fallbackReference
  );
}

function buildCallbackUrl(supabaseUrl: string, subscriptionId: string) {
  const callbackUrl = new URL(`${supabaseUrl}/functions/v1/sellapay-callback`);
  callbackUrl.searchParams.set('subscription_id', subscriptionId);
  return callbackUrl.toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { phone, amount, tier } = await req.json();

    if (!phone || !amount || !tier) {
      return new Response(
        JSON.stringify({ error: 'phone, amount, and tier are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = cleanKenyanPhoneNumber(phone);
    const sellapayToken = await getSellapayToken();
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await serviceClient
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .eq('status', 'past_due');

    const durationDays = tier === 'simp' ? 14 : 30;
    const pendingEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingSubscription, error: pendingSubscriptionError } = await serviceClient
      .from('subscriptions')
      .insert({
        user_id: userId,
        tier,
        status: 'past_due',
        price: Number(amount),
        currency: 'KES',
        provider: 'sellapay',
        payment_phone: cleanPhone,
        started_at: new Date().toISOString(),
        ends_at: pendingEndsAt,
      })
      .select('id')
      .single();

    if (pendingSubscriptionError || !pendingSubscription) {
      console.error('Pending subscription insert error:', pendingSubscriptionError);
      return new Response(
        JSON.stringify({ error: 'Could not create pending subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subRef = pendingSubscription.id;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = buildCallbackUrl(supabaseUrl, pendingSubscription.id);

    const stkRes = await fetch(`${SELLAPAY_BASE}/requestStkPush`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellapayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        amount: Number(amount),
        reference: subRef,
        description: `TutWine ${tier} subscription`,
        callbackUrl,
        callback_url: callbackUrl,
      }),
    });

    const stkRaw = await stkRes.text();
    let stkData: any = null;
    if (stkRaw && stkRaw.trim().length > 0) {
      try {
        stkData = JSON.parse(stkRaw);
      } catch (_e) {
        stkData = { raw: stkRaw };
      }
    }
    console.log('STK Push status:', stkRes.status, 'body:', stkRaw?.slice(0, 500));
    console.log('STK Push response:', JSON.stringify(stkData));

    if (!stkRes.ok || !stkData) {
      console.error('STK Push failed:', stkData);
      await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', pendingSubscription.id);

      return new Response(
        JSON.stringify({ error: 'STK push failed', details: stkData || stkRaw || 'empty response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providerSubId = extractProviderSubscriptionId(stkData, subRef);

    const { error: subError } = await serviceClient
      .from('subscriptions')
      .update({ provider_sub_id: providerSubId })
      .eq('id', pendingSubscription.id);

    if (subError) {
      console.error('Subscription update error:', subError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK push sent! Check your phone for the M-Pesa prompt.',
        subscription_id: pendingSubscription.id,
        transaction_id: providerSubId,
        reference: subRef,
        status: stkData?.status ?? stkData?.message?.ResponseDescription ?? 'pending',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.startsWith('SellaPay auth failed')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'M-Pesa provider authentication failed. SellaPay is not returning an access token for the configured credentials/API endpoint.',
          details: msg,
          provider: 'sellapay',
          fallback: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});