import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('SellaPay callback received:', JSON.stringify(body));

    const { transaction_id, status, ResultCode, ResultDesc, CheckoutRequestID, reference } = body;

    // Try multiple identifiers to find the subscription
    const lookupId = transaction_id || CheckoutRequestID || reference;

    if (!lookupId) {
      console.error('No identifier found in callback body:', JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: 'No transaction identifier found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if payment was successful (ResultCode 0 = success in M-Pesa)
    const isSuccess = ResultCode === 0 || ResultCode === '0' || status === 'completed' || status === 'success';

    // Try to find the subscription by provider_sub_id
    const { data: sub } = await serviceClient
      .from('subscriptions')
      .select('id, user_id, tier')
      .eq('provider_sub_id', lookupId)
      .eq('status', 'past_due')
      .maybeSingle();

    if (!sub) {
      console.error('No pending subscription found for identifier:', lookupId);
      // Try alternate identifiers
      for (const altId of [transaction_id, CheckoutRequestID, reference].filter(Boolean)) {
        if (altId === lookupId) continue;
        const { data: altSub } = await serviceClient
          .from('subscriptions')
          .select('id, user_id, tier')
          .eq('provider_sub_id', altId)
          .eq('status', 'past_due')
          .maybeSingle();
        if (altSub) {
          console.log('Found subscription via alternate ID:', altId);
          if (isSuccess) {
            await serviceClient
              .from('subscriptions')
              .update({
                status: 'active',
                started_at: new Date().toISOString(),
                ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq('id', altSub.id);
            console.log('Subscription activated for user:', altSub.user_id, 'tier:', altSub.tier);
          } else {
            await serviceClient
              .from('subscriptions')
              .update({ status: 'canceled' })
              .eq('id', altSub.id);
          }
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isSuccess) {
      const { error } = await serviceClient
        .from('subscriptions')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', sub.id);

      if (error) {
        console.error('Error activating subscription:', error);
      } else {
        console.log('Subscription activated for user:', sub.user_id, 'tier:', sub.tier);
      }
    } else {
      const { error } = await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', sub.id);

      if (error) {
        console.error('Error canceling subscription:', error);
      } else {
        console.log('Subscription canceled for:', sub.user_id, 'Reason:', ResultDesc || status);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});