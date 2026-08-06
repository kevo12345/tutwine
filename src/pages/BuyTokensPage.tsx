import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coins, Loader2, Smartphone, Bitcoin, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PaymentProcessingOverlay } from "@/components/payments/PaymentProcessingOverlay";

type Method = "mpesa" | "litecoin";
const PRESETS = [3, 5];
const CUSTOM_MIN = 10;

export default function BuyTokensPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const requested = Number(searchParams.get("amount") ?? 0);
  const [selected, setSelected] = useState<number | "custom">(
    requested > 0 && !PRESETS.includes(requested) ? "custom" : requested > 0 ? requested : 3,
  );
  const [customAmount, setCustomAmount] = useState<string>(
    requested > 0 && !PRESETS.includes(requested) ? String(Math.max(requested, CUSTOM_MIN)) : "",
  );
  const [method, setMethod] = useState<Method>("mpesa");
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState<null | { orderId: string; amount: number }>(null);

  const balance = Number((profile as any)?.token_balance ?? 0);

  const amount =
    selected === "custom" ? Number(customAmount || 0) : Number(selected);
  const amountValid =
    selected === "custom" ? amount >= CUSTOM_MIN : PRESETS.includes(amount);

  const { data: txs } = useQuery({
    queryKey: ["token-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("token_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  async function handleBuy() {
    if (!user) return;
    if (!amountValid) {
      toast.error(
        selected === "custom"
          ? `Custom amount must be at least ${CUSTOM_MIN} tokens.`
          : "Pick a valid amount.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const { data: tx, error } = await supabase
        .from("token_transactions")
        .insert({
          user_id: user.id,
          type: "purchase",
          amount,
          payment_method: method,
          status: "pending",
        })
        .select()
        .single();
      if (error || !tx) throw error ?? new Error("Insert failed");

      const { data, error: fnErr } = await supabase.functions.invoke(
        "confirm-token-payment",
        { body: { transaction_id: tx.id, outcome: "completed" } },
      );
      if (fnErr) throw fnErr;

      // Verification (and crediting) happens server-side; the overlay waits for it.
      setProcessing({ orderId: tx.id, amount });
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["token-transactions", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-8">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-2xl font-bold">Buy Tokens</h1>
        </div>

        {/* Balance card */}
        <Card className="mb-4 border-0 shadow-card gradient-warm text-primary-foreground">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs opacity-80">Your balance</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">{balance}</span>
                <span className="text-sm opacity-90">tokens</span>
              </div>
              <p className="mt-1 text-[11px] opacity-75">
                1 token = $1 · spend only, no cash withdrawal
              </p>
            </div>
            <Coins className="h-10 w-10 opacity-80" />
          </CardContent>
        </Card>

        {/* Amount picker */}
        <p className="text-sm font-medium mb-2">Choose amount</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setSelected(p)}
              className={`rounded-xl border p-3 text-center transition ${
                selected === p
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="font-display text-xl font-bold">{p}</div>
              <div className="text-xs text-muted-foreground">${p}.00</div>
            </button>
          ))}
          <button
            onClick={() => setSelected("custom")}
            className={`rounded-xl border p-3 text-center transition ${
              selected === "custom"
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            }`}
          >
            <div className="font-display text-xl font-bold">Custom</div>
            <div className="text-xs text-muted-foreground">min ${CUSTOM_MIN}</div>
          </button>
        </div>

        {selected === "custom" && (
          <div className="mb-4 space-y-1">
            <Label htmlFor="custom">Custom amount (tokens)</Label>
            <Input
              id="custom"
              type="number"
              min={CUSTOM_MIN}
              step={1}
              inputMode="numeric"
              placeholder={`Minimum ${CUSTOM_MIN}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
            />
            {customAmount !== "" && amount < CUSTOM_MIN ? (
              <p className="text-xs text-destructive">
                Minimum custom amount is ${CUSTOM_MIN}.00
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You'll be charged ${amount || 0}.00
              </p>
            )}
          </div>
        )}

        {/* Method */}
        <p className="text-sm font-medium mb-2 mt-2">Payment method</p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setMethod("mpesa")}
            className={`flex items-center gap-2 rounded-xl border p-3 transition ${
              method === "mpesa" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="text-sm font-semibold">M-Pesa</div>
              <div className="text-[11px] text-muted-foreground">STK Push</div>
            </div>
          </button>
          <button
            onClick={() => setMethod("litecoin")}
            className={`flex items-center gap-2 rounded-xl border p-3 transition ${
              method === "litecoin" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Bitcoin className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="text-sm font-semibold">Litecoin</div>
              <div className="text-[11px] text-muted-foreground">On-chain</div>
            </div>
          </button>
        </div>

        <Button
          className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
          disabled={!amountValid || submitting}
          onClick={handleBuy}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>Buy {amount || 0} tokens · ${amount || 0}.00</>
          )}
        </Button>

        {/* Recent */}
        <div className="mt-8">
          <h2 className="text-sm font-medium mb-2">Recent transactions</h2>
          {txs && txs.length > 0 ? (
            <div className="space-y-2">
              {txs.map((t: any) => (
                <Card key={t.id} className="border-0 shadow-card">
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={t.status} />
                      <div>
                        <div className="text-sm font-semibold">
                          +{Number(t.amount)} tokens
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {t.payment_method} · {new Date(t.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No purchases yet.</p>
          )}
        </div>
      </div>

      {processing ? (
        <PaymentProcessingOverlay
          open
          paymentMethod={method === "mpesa" ? "mpesa" : "crypto"}
          purchaseType="tokens"
          orderId={processing.orderId}
          amount={processing.amount}
          currency="USD"
          successRedirect="/buy-tokens"
          retryCallback={() => setProcessing(null)}
          onClose={() => setProcessing(null)}
        />
      ) : null}
    </AppLayout>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-destructive" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}
