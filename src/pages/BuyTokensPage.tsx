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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Coins,
  Loader2,
  Smartphone,
  Bitcoin,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentProcessingOverlay } from "@/components/payments/PaymentProcessingOverlay";

type Method = "mpesa" | "crypto";
type PayCurrency = "ltc" | "usdttrc20";
const PRESETS = [3, 5];
const CUSTOM_MIN = 10;
const USD_TO_KES = 130;
const USDT_MIN_USD = 8;

export default function BuyTokensPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const requested = Number(searchParams.get("amount") ?? 0);
  const joinSessionId = searchParams.get("join");
  const joinHours = Number(searchParams.get("hours") ?? 1);

  const [selected, setSelected] = useState<number | "custom">(
    requested > 0 && !PRESETS.includes(requested) ? "custom" : requested > 0 ? requested : 3,
  );
  const [customAmount, setCustomAmount] = useState<string>(
    requested > 0 && !PRESETS.includes(requested) ? String(Math.max(requested, CUSTOM_MIN)) : "",
  );
  const [method, setMethod] = useState<Method>("mpesa");
  const [phone, setPhone] = useState("");
  const [payCurrency, setPayCurrency] = useState<PayCurrency>("ltc");
  const [submitting, setSubmitting] = useState(false);
  const [mpesaRequest, setMpesaRequest] = useState<null | { txId: string; amountKes: number }>(null);
  const [cryptoPayment, setCryptoPayment] = useState<null | {
    txId: string;
    paymentId: string;
    payAddress: string;
    payAmount: number;
    payCurrency: string;
  }>(null);
  const [processing, setProcessing] = useState<null | {
    orderId: string;
    paymentId?: string | null;
    amount: number;
    currency: string;
    method: Method;
  }>(null);

  const balance = Number((profile as any)?.token_balance ?? 0);

  const amount = selected === "custom" ? Number(customAmount || 0) : Number(selected);
  const amountValid = selected === "custom" ? amount >= CUSTOM_MIN : PRESETS.includes(amount);
  const usdtBelowMin = amount < USDT_MIN_USD;
  const effectiveCurrency: PayCurrency = usdtBelowMin ? "ltc" : payCurrency;

  const successRedirect = joinSessionId
    ? `/live/${joinSessionId}?join=${Math.max(1, joinHours)}`
    : "/buy-tokens";

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

  function resetRequests() {
    setMpesaRequest(null);
    setCryptoPayment(null);
  }

  async function startPayment() {
    if (!user) return;
    if (!amountValid) {
      toast.error(
        selected === "custom"
          ? `Custom amount must be at least ${CUSTOM_MIN} coins.`
          : "Pick a valid amount.",
      );
      return;
    }
    if (method === "mpesa" && !phone.trim()) {
      toast.error("Enter your Safaricom number to receive the M-Pesa prompt.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("token-create-payment", {
        body:
          method === "mpesa"
            ? { amount, provider: "sellapay", phone: phone.replace(/\s+/g, "") }
            : { amount, provider: "nowpayments", pay_currency: effectiveCurrency },
      });
      if (error) {
        const detail = (data as any)?.error;
        throw new Error(detail ?? error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      qc.invalidateQueries({ queryKey: ["token-transactions", user.id] });

      if (method === "mpesa") {
        setMpesaRequest({ txId: data.transaction_id, amountKes: data.amount_kes });
        toast.success("M-Pesa request sent", {
          description:
            "Check your phone and enter your M-Pesa PIN, then tap “I’ve Completed the Payment”.",
        });
      } else {
        setCryptoPayment({
          txId: data.transaction_id,
          paymentId: data.payment_id,
          payAddress: data.pay_address,
          payAmount: Number(data.pay_amount),
          payCurrency: String(data.pay_currency ?? effectiveCurrency).toUpperCase(),
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the payment");
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
          <h1 className="font-display text-2xl font-bold">Buy Coins</h1>
        </div>

        {joinSessionId ? (
          <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
            Once your payment is confirmed we'll take you straight into the live you were joining.
          </div>
        ) : null}

        {/* Balance card */}
        <Card className="mb-4 border-0 shadow-card gradient-warm text-primary-foreground">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs opacity-80">Your balance</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">{balance}</span>
                <span className="text-sm opacity-90">coins</span>
              </div>
              <p className="mt-1 text-[11px] opacity-75">
                1 coin = $1 · spend only, no cash withdrawal
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
              onClick={() => {
                setSelected(p);
                resetRequests();
              }}
              className={`rounded-xl border p-3 text-center transition ${
                selected === p ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <div className="font-display text-xl font-bold">{p}</div>
              <div className="text-xs text-muted-foreground">${p}.00</div>
            </button>
          ))}
          <button
            onClick={() => {
              setSelected("custom");
              resetRequests();
            }}
            className={`rounded-xl border p-3 text-center transition ${
              selected === "custom" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <div className="font-display text-xl font-bold">Custom</div>
            <div className="text-xs text-muted-foreground">min ${CUSTOM_MIN}</div>
          </button>
        </div>

        {selected === "custom" && (
          <div className="mb-4 space-y-1">
            <Label htmlFor="custom">Custom amount (coins)</Label>
            <Input
              id="custom"
              type="number"
              min={CUSTOM_MIN}
              step={1}
              inputMode="numeric"
              placeholder={`Minimum ${CUSTOM_MIN}`}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^0-9]/g, ""));
                resetRequests();
              }}
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
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => {
              setMethod("mpesa");
              resetRequests();
            }}
            className={`flex items-center gap-2 rounded-xl border p-3 transition ${
              method === "mpesa" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="text-sm font-semibold">M-Pesa</div>
              <div className="text-[11px] text-muted-foreground">
                KES {Math.round((amount || 0) * USD_TO_KES)}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setMethod("crypto");
              resetRequests();
            }}
            className={`flex items-center gap-2 rounded-xl border p-3 transition ${
              method === "crypto" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Bitcoin className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="text-sm font-semibold">Crypto</div>
              <div className="text-[11px] text-muted-foreground">LTC / USDT</div>
            </div>
          </button>
        </div>

        {method === "mpesa" ? (
          <div className="mb-4 space-y-2">
            <Label htmlFor="phone">Safaricom number</Label>
            <Input
              id="phone"
              type="tel"
              maxLength={13}
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              You'll get an M-Pesa prompt for KES {Math.round((amount || 0) * USD_TO_KES)}. Coins are
              added only after the payment is confirmed.
            </p>
          </div>
        ) : (
          <div className="mb-4 space-y-2">
            <Label>Cryptocurrency</Label>
            <Select
              value={effectiveCurrency}
              onValueChange={(v) => {
                setPayCurrency(v as PayCurrency);
                resetRequests();
              }}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ltc">Litecoin (LTC)</SelectItem>
                <SelectItem value="usdttrc20" disabled={usdtBelowMin}>
                  USDT (TRC20){usdtBelowMin ? ` — min $${USDT_MIN_USD}` : ""}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              We'll generate a wallet address for ${amount || 0}.00. Coins land after the network
              confirms your transfer.
            </p>
          </div>
        )}

        {/* Crypto invoice */}
        {cryptoPayment ? (
          <Card className="mb-4 border-0 shadow-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold">
                Send exactly {cryptoPayment.payAmount} {cryptoPayment.payCurrency}
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2">
                <code className="min-w-0 flex-1 break-all text-[11px]">
                  {cryptoPayment.payAddress}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(cryptoPayment.payAddress);
                    toast.success("Address copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
                onClick={() =>
                  setProcessing({
                    orderId: cryptoPayment.txId,
                    paymentId: cryptoPayment.paymentId,
                    amount,
                    currency: "USD",
                    method: "crypto",
                  })
                }
              >
                I’ve Sent the Payment
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* M-Pesa confirm */}
        {mpesaRequest ? (
          <Button
            className="mb-3 w-full gradient-warm border-0 text-primary-foreground shadow-glow"
            onClick={() =>
              setProcessing({
                orderId: mpesaRequest.txId,
                amount: mpesaRequest.amountKes,
                currency: "KES",
                method: "mpesa",
              })
            }
          >
            I’ve Completed the Payment
          </Button>
        ) : null}

        <Button
          variant={mpesaRequest || cryptoPayment ? "outline" : "default"}
          className={
            mpesaRequest || cryptoPayment
              ? "w-full"
              : "w-full gradient-warm border-0 text-primary-foreground shadow-glow"
          }
          disabled={!amountValid || submitting}
          onClick={startPayment}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mpesaRequest || cryptoPayment ? (
            "Resend payment request"
          ) : method === "mpesa" ? (
            `Pay KES ${Math.round((amount || 0) * USD_TO_KES)} · ${amount || 0} coins`
          ) : (
            `Pay $${amount || 0}.00 in crypto · ${amount || 0} coins`
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
                        <div className="text-sm font-semibold">+{Number(t.amount)} coins</div>
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
          paymentMethod={processing.method}
          purchaseType="tokens"
          orderId={processing.orderId}
          paymentId={processing.paymentId ?? null}
          amount={processing.amount}
          currency={processing.currency}
          successRedirect={successRedirect}
          retryCallback={() => {
            setProcessing(null);
            resetRequests();
          }}
          onClose={() => {
            setProcessing(null);
            void refreshProfile();
          }}
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
