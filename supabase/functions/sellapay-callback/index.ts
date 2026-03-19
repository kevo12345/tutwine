import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_NAME = 'TutWine';
const ADMIN_NOTIFICATION_EMAIL = 'payment@tutwine.com';
const ADMIN_NOTIFICATION_FROM = 'TutWine Billing <billing@mg.lovable.app>';
const ADMIN_NOTIFICATION_SUBJECT = 'New subscription activated';

type SubscriptionRecord = {
  id: string;
  user_id: string;
  tier: string;
  price?: number | string | null;
  currency?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getCandidateIdentifiers(body: any) {
  return Array.from(new Set([
    body?.transaction_id,
    body?.TransactionID,
    body?.MpesaTransID,
    body?.checkout_request_id,
    body?.CheckoutRequestID,
    body?.reference,
    body?.merchant_reference,
    body?.external_reference,
    body?.message?.transaction_id,
    body?.message?.TransactionID,
    body?.message?.MpesaTransID,
    body?.message?.checkout_request_id,
    body?.message?.CheckoutRequestID,
    body?.message?.reference,
    body?.data?.transaction_id,
    body?.data?.TransactionID,
    body?.data?.MpesaTransID,
    body?.data?.checkout_request_id,
    body?.data?.CheckoutRequestID,
    body?.data?.reference,
  ].filter(Boolean).map(String)));
}

function extractPhoneNumber(body: any): string | null {
  const raw = body?.phone || body?.data?.phone || body?.message?.phone ||
    body?.MSISDN || body?.data?.MSISDN || body?.message?.MSISDN;
  if (!raw || typeof raw !== 'string') return null;
  // Only use unhashed phone numbers (hashed ones are 64+ hex chars)
  if (/^[a-f0-9]{40,}$/i.test(raw)) return null;
  // Normalize: strip leading +, 254 prefix → 0-prefixed
  let phone = raw.replace(/\s+/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  if (phone.startsWith('254')) phone = '0' + phone.substring(3);
  return phone;
}

async function findSubscriptionByPhone(
  serviceClient: ReturnType<typeof createClient>,
  body: any
): Promise<SubscriptionRecord | null> {
  const phone = extractPhoneNumber(body);
  if (!phone) {
    console.log('No usable phone number found in callback for fallback lookup');
    return null;
  }
  console.log('Attempting phone-based fallback lookup with phone:', phone);

  // Find users with this phone number
  const phonesToTry = [phone];
  // Also try without leading 0
  if (phone.startsWith('0')) phonesToTry.push(phone.substring(1));
  // Also try with 254 prefix
  if (phone.startsWith('0')) phonesToTry.push('254' + phone.substring(1));
  // Also try with +254
  if (phone.startsWith('0')) phonesToTry.push('+254' + phone.substring(1));

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('user_id, phone')
    .in('phone', phonesToTry);

  if (!profiles || profiles.length === 0) {
    console.log('No profiles found for phone numbers:', phonesToTry.join(', '));
    return null;
  }

  const userIds = profiles.map(p => p.user_id);
  console.log('Found user IDs for phone:', userIds.join(', '));

  // Find the most recent past_due subscription for these users
  const { data: sub } = await serviceClient
    .from('subscriptions')
    .select('id, user_id, tier, price, currency')
    .in('user_id', userIds)
    .eq('status', 'past_due')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return sub || null;
}

function isSuccessfulPayment(body: any) {
  const status = String(
    body?.status ??
    body?.payment_status ??
    body?.message?.status ??
    body?.data?.status ??
    ''
  ).toLowerCase();

  const resultCode = body?.ResultCode ?? body?.result_code ?? body?.message?.ResultCode ?? body?.data?.ResultCode;

  return (
    resultCode === 0 ||
    resultCode === '0' ||
    ['completed', 'complete', 'success', 'successful', 'paid'].includes(status)
  );
}

async function sendAdminSubscriptionNotification(
  serviceClient: ReturnType<typeof createClient>,
  subscription: SubscriptionRecord,
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
  subscription: SubscriptionRecord,
  lookupId: string
) {
  await serviceClient
    .from('subscriptions')
    .update({
      status: 'canceled',
      ends_at: new Date().toISOString(),
    })
    .eq('user_id', subscription.user_id)
    .eq('status', 'active')
    .neq('id', subscription.id);

  const { error } = await serviceClient
    .from('subscriptions')
    .update({
      provider_sub_id: lookupId,
      status: 'active',
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', subscription.id);

  if (error) {
    console.error('Error activating subscription:', error);
    return;
  }

  console.log('Subscription activated for user:', subscription.user_id, 'tier:', subscription.tier, 'lookupId:', lookupId);

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
    let body: any;
    const contentType = req.headers.get('content-type') || '';
    const rawText = await req.text();
    console.log('SellaPay callback raw:', rawText, 'Content-Type:', contentType);

    if (contentType.includes('application/json')) {
      body = JSON.parse(rawText);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawText);
      body = Object.fromEntries(params.entries());
    } else {
      // Try JSON first, then form-encoded
      try {
        body = JSON.parse(rawText);
      } catch {
        try {
          const params = new URLSearchParams(rawText);
          body = Object.fromEntries(params.entries());
        } catch {
          body = {};
        }
      }
    }

    // Also merge any query parameters (some providers send data via URL)
    const url = new URL(req.url);
    if (url.searchParams.toString()) {
      const queryParams = Object.fromEntries(url.searchParams.entries());
      body = { ...queryParams, ...body };
      console.log('Merged query params:', JSON.stringify(queryParams));
    }

    console.log('SellaPay callback parsed:', JSON.stringify(body));

    const identifiers = getCandidateIdentifiers(body);
    if (!identifiers.length) {
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

    const isSuccess = isSuccessfulPayment(body);

    for (const lookupId of identifiers) {
      const { data: sub } = await serviceClient
        .from('subscriptions')
        .select('id, user_id, tier, price, currency')
        .eq('provider_sub_id', lookupId)
        .eq('status', 'past_due')
        .maybeSingle();

      if (!sub) {
        continue;
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
          console.log('Subscription canceled for:', sub.user_id, 'Reason:', body?.ResultDesc || body?.message?.ResultDesc || body?.status);
        }
      }

      return new Response(
        JSON.stringify({ success: true, matched_identifier: lookupId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No subscription found by identifiers:', identifiers.join(', '), '— trying phone fallback');

    const fallbackSub = await findSubscriptionByPhone(serviceClient, body);
    if (fallbackSub) {
      const fallbackLookupId = identifiers[0] || 'phone-fallback';
      console.log('Phone fallback matched subscription:', fallbackSub.id, 'for user:', fallbackSub.user_id);

      if (isSuccess) {
        await activateSubscription(serviceClient, fallbackSub, fallbackLookupId);
      } else {
        await serviceClient
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('id', fallbackSub.id);
        console.log('Subscription canceled (phone fallback) for:', fallbackSub.user_id);
      }

      return new Response(
        JSON.stringify({ success: true, matched_by: 'phone_fallback', matched_identifier: fallbackLookupId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('No pending subscription found by identifiers or phone fallback');
    return new Response(
      JSON.stringify({ error: 'Subscription not found', identifiers }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});