import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';

// USD prices (kept in sync with src/lib/constants.ts TIER_PRICES)
const USD_PRICES: Record<string, number> = {
  simp: 1.5,
  basic: 3,
  plus: 5,
  pro: 10,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'NOWPayments not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { tier, pay_currency } = await req.json();
    if (!tier || !pay_currency) {
      return new Response(
        JSON.stringify({ error: 'tier and pay_currency are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountUsd = USD_PRICES[tier];
    if (!amountUsd) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Clean up any past_due subs
    await serviceClient
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .eq('status', 'past_due');

    const durationDays = tier === 'simp' ? 14 : 30;
    const pendingEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingSub, error: pendingErr } = await serviceClient
      .from('subscriptions')
      .insert({
        user_id: userId,
        tier,
        status: 'past_due',
        price: amountUsd,
        currency: 'USD',
        provider: 'nowpayments',
        started_at: new Date().toISOString(),
        ends_at: pendingEndsAt,
      })
      .select('id')
      .single();

    if (pendingErr || !pendingSub) {
      console.error('Pending sub insert error:', pendingErr);
      return new Response(
        JSON.stringify({ error: 'Could not create pending subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const ipnUrl = `${supabaseUrl}/functions/v1/nowpayments-callback`;

    const npRes = await fetch(`${NOWPAYMENTS_BASE}/payment`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: 'usd',
        pay_currency,
        order_id: pendingSub.id,
        order_description: `TutWine ${tier} subscription`,
        ipn_callback_url: ipnUrl,
      }),
    });

    const npData = await npRes.json();
    console.log('NOWPayments /payment response:', JSON.stringify(npData));

    if (!npRes.ok || !npData?.payment_id) {
      console.error('NOWPayments create payment failed:', npData);
      await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', pendingSub.id);

      return new Response(
        JSON.stringify({
          error: npData?.message || 'Failed to create crypto payment',
          details: npData,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await serviceClient
      .from('subscriptions')
      .update({ provider_sub_id: String(npData.payment_id) })
      .eq('id', pendingSub.id);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: pendingSub.id,
        payment_id: npData.payment_id,
        pay_address: npData.pay_address,
        pay_amount: npData.pay_amount,
        pay_currency: npData.pay_currency,
        price_amount: npData.price_amount,
        price_currency: npData.price_currency,
        network: npData.network,
        expiration_estimate_date: npData.expiration_estimate_date,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('nowpayments-create-payment error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
