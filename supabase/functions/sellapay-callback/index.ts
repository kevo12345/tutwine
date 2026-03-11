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

    const { transaction_id, status, ResultCode, ResultDesc } = body;

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Missing transaction_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if payment was successful (ResultCode 0 = success in M-Pesa)
    const isSuccess = ResultCode === 0 || ResultCode === '0' || status === 'completed' || status === 'success';

    if (isSuccess) {
      // Activate the subscription
      const { error } = await serviceClient
        .from('subscriptions')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('provider_sub_id', transaction_id)
        .eq('status', 'past_due');

      if (error) {
        console.error('Error activating subscription:', error);
      } else {
        console.log('Subscription activated for transaction:', transaction_id);
      }
    } else {
      // Payment failed or cancelled - mark subscription as canceled
      const { error } = await serviceClient
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('provider_sub_id', transaction_id)
        .eq('status', 'past_due');

      if (error) {
        console.error('Error canceling subscription:', error);
      } else {
        console.log('Subscription canceled for transaction:', transaction_id, 'Reason:', ResultDesc || status);
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
