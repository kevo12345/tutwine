// Shared SellaPay client.
// Docs: https://github.com/silvavalleyafrica/sellapay-api-docs
//
// The provider intermittently answers `POST /api/v1/authorize` with HTTP 200 and an
// EMPTY body (their PHP layer dies before echoing JSON). Retrying, and falling back
// to the other published API versions, recovers from that in most cases. When every
// attempt still comes back empty it is a provider-side outage, so we throw a typed
// error the callers turn into an actionable message instead of a generic 500.

// Per their docs only `v1` exists (v2/v3 are listed as "planned"), and POST /authorize is
// rate limited to 10 requests per minute per IP — so we hit the single documented endpoint
// with a small backoff instead of fanning out across hosts/versions.
const API_BASE = 'https://pay.sellapay.co.ke/api/v1';
const AUTH_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

export const SELLAPAY_UNAVAILABLE = 'SELLAPAY_UNAVAILABLE';

export class SellapayError extends Error {
  code: string;
  constructor(message: string, code = SELLAPAY_UNAVAILABLE) {
    super(message);
    this.code = code;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Base URL of the API version that last authorized successfully. */
let activeBase = API_BASE;

export function sellapayBase() {
  return activeBase;
}

export async function getSellapayToken(): Promise<string> {
  const apiKey = Deno.env.get('SELLAPAY_API_KEY');
  const apiSecret = Deno.env.get('SELLAPAY_SECRET_KEY');
  if (!apiKey || !apiSecret) {
    throw new SellapayError('SellaPay credentials are not configured', 'SELLAPAY_NO_CREDENTIALS');
  }

  let lastDetail = 'no response';

  for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt++) {
    const label = `attempt ${attempt}`;
    let res: Response;
    try {
      res = await fetchWithTimeout(`${API_BASE}/authorize`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'X-API-SECRET': apiSecret,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Tutwine/1.0',
        },
        body: JSON.stringify({}),
      });
    } catch (e) {
      lastDetail = `network error: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`SellaPay authorize ${label}: ${lastDetail}`);
      await sleep(750 * attempt);
      continue;
    }

    const raw = (await res.text()).trim();
    console.log(
      `SellaPay authorize ${label}: status ${res.status}, body ${raw ? raw.slice(0, 200) : 'empty'}`,
    );

    if (res.status === 401 || res.status === 403) {
      throw new SellapayError(
        'SellaPay rejected the configured API key/secret. The credentials need to be updated.',
        'SELLAPAY_BAD_CREDENTIALS',
      );
    }

    if (raw) {
      try {
        const data = JSON.parse(raw);
        const accessToken = data.access_token || data.token;
        if (accessToken) return accessToken as string;
        lastDetail = data.error || data.message || raw.slice(0, 200);
      } catch {
        lastDetail = `non-JSON response: ${raw.slice(0, 200)}`;
      }
    } else {
      lastDetail = `HTTP ${res.status} with empty body`;
    }

    await sleep(750 * attempt);
  }

  throw new SellapayError(
    `SellaPay authorization endpoint is not responding (${lastDetail}). This is an outage on SellaPay's side — M-Pesa is temporarily unavailable.`,
  );
}

export function cleanKenyanPhone(phone: string) {
  let p = String(phone).replace(/\s+/g, '').replace(/^(\+?254)/, '');
  if (p.startsWith('0')) p = p.substring(1);
  return p;
}

/** User-facing message for a SellaPay failure. */
export function sellapayUserMessage(err: unknown): { message: string; code: string } {
  if (err instanceof SellapayError) {
    if (err.code === 'SELLAPAY_NO_CREDENTIALS') {
      return { message: 'M-Pesa is not configured yet. Please pay with crypto or try again later.', code: err.code };
    }
    if (err.code === 'SELLAPAY_BAD_CREDENTIALS') {
      return {
        message: 'M-Pesa payments are temporarily unavailable (provider credentials rejected). Please pay with crypto for now.',
        code: err.code,
      };
    }
    return {
      message: 'M-Pesa is temporarily unavailable — our payment provider (SellaPay) is not responding. Please try again in a few minutes or pay with crypto.',
      code: err.code,
    };
  }
  return { message: err instanceof Error ? err.message : 'Unknown error', code: 'UNKNOWN' };
}

/**
 * Initiate an M-Pesa STK push.
 * IMPORTANT: SellaPay's /requestStkPush only reads form-encoded fields
 * (a JSON body returns `{"error":"Amount and phone is required"}`).
 */
export async function sellapayStkPush(params: {
  token: string;
  phone: string;
  amount: number;
  reference: string;
  description: string;
  callbackUrl?: string;
}): Promise<{ ok: boolean; status: number; raw: string; data: any }> {
  const body = new URLSearchParams({
    phone: params.phone,
    amount: String(params.amount),
    reference: params.reference.slice(0, 20),
    description: params.description,
  });
  if (params.callbackUrl) {
    body.set('callbackUrl', params.callbackUrl);
    body.set('callback_url', params.callbackUrl);
  }

  const res = await fetchWithTimeout(`${sellapayBase()}/requestStkPush`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const raw = (await res.text()).trim();
  let data: any = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = { raw }; }
  }
  const ok = res.ok && !!data && data.error == null && data.r_status !== false;
  console.log('SellaPay STK push:', res.status, raw.slice(0, 400));
  return { ok, status: res.status, raw, data };
}

/**
 * Best-effort transaction status lookup.
 * SellaPay's docs only guarantee callbacks, so we probe the documented status
 * routes and return a normalised verdict. `unknown` means "keep waiting".
 */
export async function sellapayTransactionStatus(
  reference: string,
): Promise<'success' | 'failed' | 'unknown'> {
  let token: string;
  try {
    token = await getSellapayToken();
  } catch {
    return 'unknown';
  }

  const paths = [
    `/transactionStatus?reference=${encodeURIComponent(reference)}`,
    `/checkTransaction?reference=${encodeURIComponent(reference)}`,
    `/transaction/${encodeURIComponent(reference)}`,
  ];

  for (const path of paths) {
    try {
      const res = await fetchWithTimeout(`${sellapayBase()}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const raw = (await res.text()).trim();
      if (!res.ok || !raw) continue;
      let data: any;
      try { data = JSON.parse(raw); } catch { continue; }
      const node = data?.data ?? data?.message ?? data;
      const status = String(node?.status ?? node?.payment_status ?? '').toLowerCase();
      const code = node?.ResultCode ?? node?.result_code;
      if (code === 0 || code === '0' ||
          ['completed', 'complete', 'success', 'successful', 'paid'].includes(status)) {
        return 'success';
      }
      if (['failed', 'cancelled', 'canceled', 'expired', 'rejected'].includes(status)) {
        return 'failed';
      }
      return 'unknown';
    } catch {
      // try the next candidate route
    }
  }
  return 'unknown';
}
