import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_NAME = 'TutWine';
const ADMIN_NOTIFICATION_EMAIL = 'payment@tutwine.com';
const ADMIN_NOTIFICATION_FROM = 'TutWine Billing <billing@mg.lovable.app>';
const ADMIN_NOTIFICATION_SUBJECT = 'New subscription activated';
const RECENT_PENDING_LOOKUP_WINDOW_MINUTES = 20;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SubscriptionRecord = {
  id: string;
  user_id: string;
  tier: string;
  status?: string | null;
  price?: number | string | null;
  currency?: string | null;
  created_at?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function getCandidateSubscriptionIds(body: any) {
  return Array.from(new Set([
    body?.subscription_id,
    body?.subscriptionId,
    body?.message?.subscription_id,
    body?.message?.subscriptionId,
    body?.data?.subscription_id,
    body?.data?.subscriptionId,
    body?.reference,
    body?.message?.reference,
    body?.data?.reference,
  ].filter(isUuid)));
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
  if (/^[a-f0-9]{40,}$/i.test(raw)) return null;

  let phone = raw.replace(/\s+/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  if (phone.startsWith('254')) phone = '0' + phone.substring(3);
  return phone;
}

function extractPaidAmount(body: any): number | null {
  const rawAmount = body?.amount ?? body?.data?.amount ?? body?.message?.amount;
  const amount = Number(rawAmount);
  return Number.isFinite(amount) ? amount : null;
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

  const phonesToTry = [phone];
  if (phone.startsWith('0')) {
    phonesToTry.push(phone.substring(1));
    phonesToTry.push('254' + phone.substring(1));
    phonesToTry.push('+254' + phone.substring(1));
  } else if (phone.startsWith('254')) {
    phonesToTry.push('0' + phone.substring(3));
    phonesToTry.push(phone.substring(3));
    phonesToTry.push('+' + phone);
  }

  const { data: sub } = await serviceClient
    .from('subscriptions')
    .select('id, user_id, tier, status, price, currency, created_at')
    .in('payment_phone', phonesToTry)
    .eq('status', 'past_due')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    console.log('Matched subscription by payment_phone:', sub.id, 'for user:', sub.user_id);
    return sub;
  }

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('user_id, phone')
    .in('phone', phonesToTry);

  if (!profiles || profiles.length === 0) {
    console.log('No subscriptions or profiles found for phone numbers:', phonesToTry.join(', '));
    return null;
  }

  const userIds = profiles.map((p) => p.user_id);
  console.log('Found user IDs for phone via profile:', userIds.join(', '));

  const { data: profileSub } = await serviceClient
    .from('subscriptions')
    .select('id, user_id, tier, status, price, currency, created_at')
    .in('user_id', userIds)
    .eq('status', 'past_due')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return profileSub || null;
}

async function findRecentPendingSubscriptionByAmount(
  serviceClient: ReturnType<typeof createClient>,
  body: any
): Promise<SubscriptionRecord | null> {
  const amount = extractPaidAmount(body);
  if (amount === null) {
    console.log('No usable payment amount found for recent pending fallback');
    return null;
  }

  const windowStart = new Date(Date.now() - RECENT_PENDING_LOOKUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: candidates, error } = await serviceClient
    .from('subscriptions')
    .select('id, user_id, tier, status, price, currency, created_at')
    .eq('status', 'past_due')
    .eq('provider', 'sellapay')
    .eq('price', amount)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Recent pending fallback query failed:', error);
    return null;
  }

  if (!candidates || candidates.length === 0) {
    console.log('No recent pending subscriptions found for amount fallback:', amount);
    return null;
  }

  if (candidates.length > 1) {
    console.log(
      'Recent amount fallback ambiguous for amount:',
      amount,
      'candidate subscription IDs:',
      candidates.map((candidate) => candidate.id).join(', ')
    );
    return null;
  }

  console.log('Matched subscription by recent amount fallback:', candidates[0].id, 'for user:', candidates[0].user_id);
  return candidates[0];
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
  lookupId: string,
  paymentPhone?: string | null
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

  const updatePayload: Record<string, unknown> = {
    provider_sub_id: lookupId,
    status: 'active',
    started_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (paymentPhone) {
    updatePayload.payment_phone = paymentPhone;
  }

  const { error } = await serviceClient
    .from('subscriptions')
    .update(updatePayload)
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

    const url = new URL(req.url);
    if (url.searchParams.toString()) {
      const queryParams = Object.fromEntries(url.searchParams.entries());
      body = { ...queryParams, ...body };
      console.log('Merged query params:', JSON.stringify(queryParams));
    }

    console.log('SellaPay callback parsed:', JSON.stringify(body));

    const subscriptionIds = getCandidateSubscriptionIds(body);
    const identifiers = getCandidateIdentifiers(body);
    if (!subscriptionIds.length && !identifiers.length) {
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
    const callbackPhone = extractPhoneNumber(body);

    for (const subscriptionId of subscriptionIds) {
      const { data: sub } = await serviceClient
        .from('subscriptions')
        .select('id, user_id, tier, status, price, currency, created_at')
        .eq('id', subscriptionId)
        .maybeSingle();

      if (!sub) {
        continue;
      }

      const directLookupId = identifiers[0] || subscriptionId;

      if (sub.status === 'active') {
        console.log('Subscription already active for direct callback match:', sub.id);
        return new Response(
          JSON.stringify({ success: true, matched_by: 'subscription_id', matched_identifier: directLookupId, already_processed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (sub.status !== 'past_due') {
        console.log('Subscription found by direct callback match but not pending:', sub.id, 'status:', sub.status);
        continue;
      }

      if (isSuccess) {
        await activateSubscription(serviceClient, sub, directLookupId, callbackPhone);
      } else {
        await serviceClient
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('id', sub.id);
        console.log('Subscription canceled for:', sub.user_id, 'matched by direct subscription id');
      }

      return new Response(
        JSON.stringify({ success: true, matched_by: 'subscription_id', matched_identifier: directLookupId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const lookupId of identifiers) {
      const { data: sub } = await serviceClient
        .from('subscriptions')
        .select('id, user_id, tier, status, price, currency, created_at')
        .eq('provider_sub_id', lookupId)
        .eq('status', 'past_due')
        .maybeSingle();

      if (!sub) {
        continue;
      }

      if (isSuccess) {
        await activateSubscription(serviceClient, sub, lookupId, callbackPhone);
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
      const fallbackLookupId = identifiers[0] || fallbackSub.id || 'phone-fallback';
      console.log('Phone fallback matched subscription:', fallbackSub.id, 'for user:', fallbackSub.user_id);

      if (isSuccess) {
        await activateSubscription(serviceClient, fallbackSub, fallbackLookupId, callbackPhone);
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

    console.log('Phone fallback failed — trying recent pending amount fallback');

    const recentPendingSub = await findRecentPendingSubscriptionByAmount(serviceClient, body);
    if (recentPendingSub) {
      const fallbackLookupId = identifiers[0] || recentPendingSub.id || 'recent-amount-fallback';
      console.log('Recent pending amount fallback matched subscription:', recentPendingSub.id, 'for user:', recentPendingSub.user_id);

      if (isSuccess) {
        await activateSubscription(serviceClient, recentPendingSub, fallbackLookupId, callbackPhone);
      } else {
        await serviceClient
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('id', recentPendingSub.id);
        console.log('Subscription canceled (recent amount fallback) for:', recentPendingSub.user_id);
      }

      return new Response(
        JSON.stringify({ success: true, matched_by: 'recent_amount_fallback', matched_identifier: fallbackLookupId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('No pending subscription found by subscription id, identifiers, phone fallback, or recent amount fallback');
    return new Response(
      JSON.stringify({ error: 'Subscription not found', subscriptionIds, identifiers }),
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