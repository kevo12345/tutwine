// Stub edge function that confirms a pending token purchase and credits balance.
// In production this endpoint will be wired to M-Pesa Daraja callbacks and a
// Litecoin webhook / blockchain listener. Until then it:
//   1. Verifies the caller is the transaction owner (dev mode) OR a trusted
//      webhook (skipped for the stub).
//   2. Calls `complete_token_purchase` with the service role, which is the
//      ONLY path that flips a transaction to `completed` and increments
//      `profiles.token_balance`.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  transaction_id?: string;
  payment_ref?: string;
  // Simulated outcome for the stub; real callbacks will infer this from the
  // provider payload.
  outcome?: "completed" | "failed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const { transaction_id, payment_ref, outcome = "completed" } = body;

    if (!transaction_id || typeof transaction_id !== "string") {
      return json({ error: "transaction_id required" }, 400);
    }
    if (outcome !== "completed" && outcome !== "failed") {
      return json({ error: "invalid outcome" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Dev-mode auth: require the caller to be the transaction owner so random
    // strangers can't complete other people's purchases while the real webhook
    // isn't wired yet. Real webhooks will replace this with signature checks.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "unauthorized" }, 401);
    }
    const callerId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: tx, error: txErr } = await admin
      .from("token_transactions")
      .select("id, user_id, status, type")
      .eq("id", transaction_id)
      .maybeSingle();
    if (txErr || !tx) return json({ error: "transaction not found" }, 404);
    if (tx.user_id !== callerId) return json({ error: "forbidden" }, 403);

    if (outcome === "failed") {
      await admin.rpc("fail_token_purchase", {
        _tx_id: transaction_id,
        _payment_ref: payment_ref ?? null,
      });
      return json({ status: "failed" });
    }

    const { data: result, error: rpcErr } = await admin.rpc(
      "complete_token_purchase",
      { _tx_id: transaction_id, _payment_ref: payment_ref ?? null },
    );
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    return json({ status: "completed", result });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
