import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_NAME = 'TutWine';
const ADMIN_NOTIFICATION_EMAIL = 'payment@tutwine.com';
const ADMIN_NOTIFICATION_FROM = 'TutWine Billing <billing@mg.lovable.app>';
const ADMIN_NOTIFICATION_SUBJECT = 'New subscription activated';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendAdminSubscriptionNotification(
  serviceClient: ReturnType<typeof createClient>,
  subscription: { id: string; user_id: string; tier: string; price?: number | string | null; currency?: string | null },
  lookupId: string
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('display_name')
    .eq('user_id', subscription.user_id)
    .maybeSingle();

  const displayName = profile?.display_name || 'Unknown user';
  const safeDisplayName = escapeHtml(displayName);
  const safeTier = escapeHtml(subscription.tier);
  const safeUserId = escapeHtml(subscription.user_id);
  const safeLookupId = escapeHtml(lookupId);
  const paidAmount = subscription.price != null ? String(subscription.price) : 'Unknown';
  const paidCurrency = subscription.currency || 'Unknown';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 16px;">New subscription activated</h2>
      <p style="margin: 0 0 16px;">A customer has successfully activated a paid subscription.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>App</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${APP_NAME}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>Plan</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-transform: capitalize;">${safeTier}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>User</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${safeDisplayName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>User ID</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${safeUserId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>Subscription ID</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(subscription.id)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>Paid Amount</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(paidAmount)} ${escapeHtml(paidCurrency)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;"><strong>Payment Ref</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${safeLookupId}</td>
        </tr>
      </table>
    </div>
  `;

  const text = [
    'New subscription activated',
    '',
    `App: ${APP_NAME}`,
    `Plan: ${subscription.tier}`,
    `User: ${displayName}`,
    `User ID: ${subscription.user_id}`,
    `Subscription ID: ${subscription.id}`,
    `Paid Amount: ${paidAmount} ${paidCurrency}`,
    `Payment Ref: ${lookupId}`, 
  ].join('\n');

  const messageId = `subscription-activated-${subscription.id}-${ADMIN_NOTIFICATION_EMAIL}`;

  await serviceClient.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'subscription-admin-notification',
    recipient_email: ADMIN_NOTIFICATION_EMAIL,
    status: 'pending',
  });

  const { error } = await serviceClient.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      queued_at: new Date().toISOString(),
      to: ADMIN_NOTIFICATION_EMAIL,
      from: ADMIN_NOTIFICATION_FROM,
      subject: ADMIN_NOTIFICATION_SUBJECT,
      html,
      text,
      purpose: 'transactional',
      label: 'subscription-admin-notification',
      idempotency_key: messageId,
    },
  });

  if (error) {
    throw new Error(`Failed to queue admin notification: ${error.message}`);
  }
}

async function activateSubscription(
  serviceClient: ReturnType<typeof createClient>,
  subscription: { id: string; user_id: string; tier: string },
  lookupId: string
) {
  const { error } = await serviceClient
    .from('subscriptions')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', subscription.id);

  if (error) {
    console.error('Error activating subscription:', error);
    return;
  }

  console.log('Subscription activated for user:', subscription.user_id, 'tier:', subscription.tier);

  try {
    await sendAdminSubscriptionNotification(serviceClient, subscription, lookupId);
  } catch (notificationError) {
    console.error('Failed to send admin subscription notification:', notificationError);
  }
}

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
            await activateSubscription(serviceClient, altSub, altId);
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
      await activateSubscription(serviceClient, sub, lookupId);
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