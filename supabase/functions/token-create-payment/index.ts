// Creates a real payment for a coin (token) purchase.
// Inserts a pending token_transactions row, then dispatches either a SellaPay
// M-Pesa STK push or a NOWPayments crypto payment. Tokens are ONLY credited by
// the callbacks / payment-status verification via `complete_token_purchase`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CUSTOM_COIN_MIN, isValidCoinPurchase } from '../_shared/coin-packages.ts';
import {
  getSellapayToken,
  cleanKenyanPhone,
  sellapayUserMessage,
  SellapayError,
  sellapayStkPush,
} from '../_shared/sellapay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';
const ALLOWED_CRYPTO = ['ltc', 'usdttrc20'];
const USDT_TRC20_MIN_USD = 8;
const USD_TO_KES = 130;
// 1 coin = $0.25, so $1 buys 4 coins.
const TOKEN_USD = 0.25;
const CUSTOM_MIN = CUSTOM_COIN_MIN;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    const provider = String(body?.provider ?? '');
    const phone = body?.phone ? String(body.phone) : '';
    const payCurrency = String(body?.pay_currency ?? 'ltc').toLowerCase();

    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'invalid amount' }, 400);
    if (!isValidCoinPurchase(amount)) {
      return json({ error: `Minimum custom purchase is ${CUSTOM_MIN} coins` }, 400);
    }
    const usdAmount = Math.round(amount * TOKEN_USD * 100) / 100;
    if (!['sellapay', 'nowpayments'].includes(provider)) {
      return json({ error: 'unsupported provider' }, 400);
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const { data: tx, error: txErr } = await service
      .from('token_transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        amount,
        payment_method: provider === 'sellapay' ? 'mpesa' : 'litecoin',
        status: 'pending',
      })
      .select('id')
      .single();
    if (txErr || !tx) {
      console.error('token tx insert failed', txErr);
      return json({ error: txErr?.message ?? 'Could not create transaction' }, 500);
    }

    if (provider === 'sellapay') {
      if (!phone) {
        await fail(service, tx.id);
        return json({ error: 'phone is required for M-Pesa' }, 400);
      }
      const amountKes = Math.max(1, Math.round(usdAmount * USD_TO_KES));
      try {
        const token = await getSellapayToken();
        const callbackUrl = `${supabaseUrl}/functions/v1/sellapay-callback?token_tx_id=${tx.id}`;
        const stk = await sellapayStkPush({
          token,
          phone: cleanKenyanPhone(phone),
          amount: amountKes,
          reference: String(tx.id).replace(/-/g, '').slice(0, 20),
          description: `TutWine ${amount} coins`,
          callbackUrl,
        });
        const providerRef =
          stk?.transaction_id ?? stk?.TransactionID ?? stk?.CheckoutRequestID ??
          stk?.checkout_request_id ?? stk?.message?.transaction_id ?? String(tx.id);
        await service
          .from('token_transactions')
          .update({ payment_ref: String(providerRef) })
          .eq('id', tx.id);
        return json({
          success: true,
          transaction_id: tx.id,
          amount,
          amount_kes: amountKes,
          currency: 'KES',
        });
      } catch (err) {
        await fail(service, tx.id);
        if (err instanceof SellapayError) {
          const { message, code } = sellapayUserMessage(err);
          return json({ error: message, code }, 503);
        }
        throw err;
      }
    }

    // ---- Crypto (NOWPayments) ----
    if (!ALLOWED_CRYPTO.includes(payCurrency)) {
      await fail(service, tx.id);
      return json({ error: 'Unsupported pay_currency. Allowed: ltc, usdttrc20' }, 400);
    }
    if (payCurrency === 'usdttrc20' && usdAmount < USDT_TRC20_MIN_USD) {
      await fail(service, tx.id);
      return json(
        {
          error: `USDT (TRC20) requires at least $${USDT_TRC20_MIN_USD} (${Math.ceil(USDT_TRC20_MIN_USD / TOKEN_USD)} coins). Choose Litecoin (LTC) for this amount.`,
          code: 'USDT_MIN_AMOUNT',
          min_usd: USDT_TRC20_MIN_USD,
        },
        400,
      );
    }

    const npKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!npKey) {
      await fail(service, tx.id);
      return json({ error: 'Crypto payments are not configured' }, 500);
    }

    const npRes = await fetch(`${NOWPAYMENTS_BASE}/payment`, {
      method: 'POST',
      headers: { 'x-api-key': npKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: usdAmount,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: tx.id,
        order_description: `TutWine ${amount} coins`,
        ipn_callback_url: `${supabaseUrl}/functions/v1/nowpayments-callback`,
      }),
    });
    const np = await npRes.json().catch(() => null);
    console.log('NOWPayments coin payment response:', JSON.stringify(np));
    if (!npRes.ok || !np?.payment_id) {
      await fail(service, tx.id);
      return json({ error: np?.message || 'Failed to create crypto payment', details: np }, 502);
    }

    await service
      .from('token_transactions')
      .update({ payment_ref: String(np.payment_id) })
      .eq('id', tx.id);

    return json({
      success: true,
      transaction_id: tx.id,
      amount,
      currency: 'USD',
      payment_id: String(np.payment_id),
      pay_address: np.pay_address,
      pay_amount: np.pay_amount,
      pay_currency: np.pay_currency,
    });
  } catch (err) {
    console.error('token-create-payment error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

async function fail(service: ReturnType<typeof createClient>, txId: string) {
  await service.rpc('fail_token_purchase', { _tx_id: txId, _payment_ref: null });
}
