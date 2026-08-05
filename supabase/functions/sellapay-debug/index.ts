import { getSellapayToken, sellapayBase, cleanKenyanPhone } from '../_shared/sellapay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const out: any = {};
  try {
    const url = new URL(req.url);
    const phone = cleanKenyanPhone(url.searchParams.get('phone') || '712345678');
    const amount = Number(url.searchParams.get('amount') || '1');
    const token = await getSellapayToken();
    out.tokenOk = true;

    // balance check
    const bal = await fetch(`${sellapayBase()}/getBalance`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    out.balance = { status: bal.status, body: (await bal.text()).slice(0, 300) };

    const payload = { phone, amount, reference: 'DBG001', description: 'debug' };

    const jsonRes = await fetch(`${sellapayBase()}/requestStkPush`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    out.json = { status: jsonRes.status, body: (await jsonRes.text()).slice(0, 500) };

    const form = new URLSearchParams({
      phone,
      amount: String(amount),
      reference: 'DBG002',
      description: 'debug',
    });
    const formRes = await fetch(`${sellapayBase()}/requestStkPush`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });
    out.form = { status: formRes.status, body: (await formRes.text()).slice(0, 500) };

    const qsRes = await fetch(
      `${sellapayBase()}/requestStkPush?${new URLSearchParams({ phone, amount: String(amount), reference: 'DBG003' })}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      },
    );
    out.query = { status: qsRes.status, body: (await qsRes.text()).slice(0, 500) };

    return new Response(JSON.stringify(out, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify(out, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
