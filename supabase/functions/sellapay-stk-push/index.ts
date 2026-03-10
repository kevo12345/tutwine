const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SELLAPAY_BASE = 'https://pay.sellapay.africa/api/v1';

async function getSellapayToken(): Promise<string> {
  const apiKey = Deno.env.get('SELLAPAY_API_KEY');
  const apiSecret = Deno.env.get('SELLAPAY_SECRET_KEY');

  if (!apiKey || !apiSecret) {
    throw new Error('SellaPay credentials not configured');
  }

  const res = await fetch(`${SELLAPAY_BASE}/authorize`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'X-API-SECRET': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`SellaPay auth failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
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

    const { phone, amount, tier, reference } = await req.json();

    if (!phone || !amount || !tier) {
      return new Response(
        JSON.stringify({ error: 'phone, amount, and tier are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - remove country code prefix if present, keep local format
    let cleanPhone = phone.replace(/\s+/g, '').replace(/^(\+?254)/, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Get SellaPay access token
    const sellapayToken = await getSellapayToken();

    // Initiate STK Push
    const stkRes = await fetch(`${SELLAPAY_BASE}/requestStkPush`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellapayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        amount: Number(amount),
        reference: reference || `SUB-${tier.toUpperCase()}-${Date.now()}`,
        description: `TutWine ${tier} subscription`,
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok) {
      console.error('STK Push failed:', stkData);
      return new Response(
        JSON.stringify({ error: 'STK push failed', details: stkData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store pending subscription using service role for insert
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Deactivate any existing active subscription
    await serviceClient
      .from('subscriptions')
      .update({ status: 'canceled', ends_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Create new subscription (active on successful STK push initiation)
    const { error: subError } = await serviceClient.from('subscriptions').insert({
      user_id: userId,
      tier,
      status: 'active',
      price: Number(amount),
      currency: 'KES',
      provider: 'sellapay',
      provider_sub_id: stkData.transaction_id || null,
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (subError) {
      console.error('Subscription insert error:', subError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK push sent! Check your phone for the M-Pesa prompt.',
        transaction_id: stkData.transaction_id,
        status: stkData.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
