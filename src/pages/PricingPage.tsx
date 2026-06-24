import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  ArrowLeft,
  Crown,
  Zap,
  Star,
  Heart,
  Loader2,
  Phone,
  Bitcoin,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TIER_PRICES } from "@/lib/constants";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tiers = [
  {
    key: "simp" as const,
    icon: Heart,
    features: ["100 profile views/day", "50 likes/day", "Standard filters", "Ad-free experience", "2 weeks only"],
    color: "bg-pink-500/10 text-pink-500",
    duration: "2 weeks",
  },
  {
    key: "basic" as const,
    icon: Zap,
    features: ["100 profile views/day", "50 likes/day", "Standard filters", "Ad-free experience"],
    color: "bg-info/10 text-info",
  },
  {
    key: "plus" as const,
    icon: Crown,
    features: ["Unlimited profile views", "200 likes/day", "1 weekly boost", "Priority support", "Advanced filters"],
    color: "bg-primary/10 text-primary",
    popular: true,
  },
  {
    key: "pro" as const,
    icon: Star,
    features: ["Unlimited everything", "Daily boost", "See who liked you", "Priority in discovery", "Read receipts", "Undo last swipe", "Video chat"],
    color: "bg-accent/10 text-accent",
  },
];

const KES_PRICES: Record<string, number> = {
  simp: 200,
  basic: 400,
  plus: 650,
  pro: 1300,
};

const USD_PRICES: Record<string, number> = {
  simp: 1.5,
  basic: 3,
  plus: 5,
  pro: 10,
};

const CRYPTO_OPTIONS = [
  { value: "usdttrc20", label: "USDT (TRC20) — low fees" },
  { value: "usdterc20", label: "USDT (ERC20)" },
  { value: "usdcerc20", label: "USDC (ERC20)" },
  { value: "btc", label: "Bitcoin (BTC)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "trx", label: "Tron (TRX)" },
  { value: "ltc", label: "Litecoin (LTC)" },
  { value: "bnbbsc", label: "BNB (BSC)" },
];

type Method = null | "mpesa" | "crypto";

type CryptoPayment = {
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  network?: string;
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: currentTier } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // M-Pesa state
  const [phone, setPhone] = useState("");
  const [mpesaLoading, setMpesaLoading] = useState(false);

  // Crypto state
  const [payCurrency, setPayCurrency] = useState("usdttrc20");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoPayment, setCryptoPayment] = useState<CryptoPayment | null>(null);
  const [copied, setCopied] = useState(false);

  const resetDialog = () => {
    setMethod(null);
    setPhone("");
    setCryptoPayment(null);
    setPayCurrency("usdttrc20");
    setCopied(false);
  };

  const handleSelectPlan = (tierKey: string) => {
    if (!user) {
      toast.info("Please sign in first to subscribe.");
      navigate("/login");
      return;
    }
    setSelectedTier(tierKey);
    resetDialog();
    setDialogOpen(true);
  };

  const handleMpesaPayment = async () => {
    if (!selectedTier || !phone) return;
    const cleanPhone = phone.replace(/\s+/g, "");
    if (!/^(0?[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(cleanPhone)) {
      toast.error("Enter a valid Safaricom phone number (e.g. 0712345678)");
      return;
    }

    setMpesaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sellapay-stk-push", {
        body: { phone: cleanPhone, amount: KES_PRICES[selectedTier], tier: selectedTier },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("M-Pesa prompt sent!", {
          description: "Check your phone and enter your M-Pesa PIN. Your subscription will activate once payment is confirmed.",
          duration: 8000,
        });
        setDialogOpen(false);
        resetDialog();
      } else {
        toast.error(data?.error || "Payment failed. Please try again.");
      }
    } catch (err) {
      console.error("M-Pesa payment error:", err);
      toast.error("Payment failed. Please try again.");
    } finally {
      setMpesaLoading(false);
    }
  };

  const handleCryptoPayment = async () => {
    if (!selectedTier || !payCurrency) return;
    setCryptoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nowpayments-create-payment", {
        body: { tier: selectedTier, pay_currency: payCurrency },
      });
      if (error) throw error;
      if (data?.success) {
        setCryptoPayment({
          pay_address: data.pay_address,
          pay_amount: data.pay_amount,
          pay_currency: data.pay_currency,
          network: data.network,
        });
      } else {
        toast.error(data?.error || "Could not create crypto payment.");
      }
    } catch (err) {
      console.error("Crypto payment error:", err);
      toast.error("Could not create crypto payment. Try a different coin.");
    } finally {
      setCryptoLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 lg:max-w-5xl">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Upgrade</h1>
        </div>

        <div className="mb-6 rounded-2xl gradient-warm p-6 text-center text-primary-foreground">
          <Crown className="mx-auto h-10 w-10" />
          <h2 className="mt-3 font-display text-xl font-bold">Unlock Your Full Potential</h2>
          <p className="mt-2 text-sm opacity-90">Get more matches, see who likes you, and stand out.</p>
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-4 lg:gap-4 lg:space-y-0">
          {tiers.map((tier) => {
            const info = TIER_PRICES[tier.key];
            const kesPrice = KES_PRICES[tier.key];
            return (
              <Card key={tier.key} className={`relative border-0 shadow-card overflow-hidden ${currentTier === tier.key ? "ring-2 ring-success" : tier.popular ? "ring-2 ring-primary" : ""}`}>
                {currentTier === tier.key ? (
                  <div className="absolute right-0 top-0 bg-success px-3 py-1 text-[10px] font-bold text-success-foreground rounded-bl-xl uppercase tracking-wider">
                    Current Plan
                  </div>
                ) : tier.popular ? (
                  <div className="absolute right-0 top-0 gradient-warm px-3 py-1 text-[10px] font-bold text-primary-foreground rounded-bl-xl uppercase tracking-wider">
                    Most Popular
                  </div>
                ) : null}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${tier.color}`}>
                      <tier.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-lg">{info.label}</CardTitle>
                      <CardDescription>
                        <span className="text-2xl font-display font-bold text-foreground">KES {kesPrice}</span>
                        <span className="text-muted-foreground">/{tier.duration ? "2 wks" : "mo"}</span>
                        <span className="block text-xs text-muted-foreground">or ${USD_PRICES[tier.key]} in crypto</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-success shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`mt-4 w-full ${currentTier === tier.key ? "" : tier.popular ? "gradient-warm border-0 text-primary-foreground shadow-glow" : ""}`}
                    variant={currentTier === tier.key ? "secondary" : tier.popular ? "default" : "outline"}
                    disabled={currentTier === tier.key}
                    onClick={() => handleSelectPlan(tier.key)}
                  >
                    {currentTier === tier.key ? "Current Plan" : `Get ${info.label}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cancel anytime. Pay via M-Pesa (Kenya) or crypto (worldwide).
        </p>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {/* Step 1: choose method */}
          {method === null && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Choose payment method</DialogTitle>
                <DialogDescription>
                  {selectedTier && (
                    <span className="block font-semibold text-foreground">
                      {TIER_PRICES[selectedTier as keyof typeof TIER_PRICES]?.label} plan
                    </span>
                  )}
                  Pick how you'd like to pay.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setMethod("mpesa")}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-green-500/10 p-2 text-green-600">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">M-Pesa</div>
                      <div className="text-xs text-muted-foreground">
                        KES {selectedTier ? KES_PRICES[selectedTier] : ""} • Kenya only
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setMethod("crypto")}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                      <Bitcoin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Crypto (NOWPayments)</div>
                      <div className="text-xs text-muted-foreground">
                        ${selectedTier ? USD_PRICES[selectedTier] : ""} • Worldwide • BTC, USDT, ETH and more
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Step 2a: M-Pesa */}
          {method === "mpesa" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  Pay with M-Pesa
                </DialogTitle>
                <DialogDescription>
                  Enter your Safaricom number to receive the M-Pesa payment prompt.
                  {selectedTier && (
                    <span className="mt-1 block font-semibold text-foreground">
                      Amount: KES {KES_PRICES[selectedTier]} for {TIER_PRICES[selectedTier as keyof typeof TIER_PRICES]?.label} plan
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    maxLength={13}
                    disabled={mpesaLoading}
                  />
                  <p className="text-xs text-muted-foreground">Safaricom number (e.g. 0712345678 or 254712345678)</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Your subscription will only activate after you complete the M-Pesa payment on your phone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMethod(null)} disabled={mpesaLoading} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleMpesaPayment}
                    disabled={mpesaLoading || !phone}
                    className="flex-1 gradient-warm border-0 text-primary-foreground shadow-glow"
                  >
                    {mpesaLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      `Pay KES ${selectedTier ? KES_PRICES[selectedTier] : ""}`
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 2b: Crypto */}
          {method === "crypto" && !cryptoPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-amber-600" />
                  Pay with Crypto
                </DialogTitle>
                <DialogDescription>
                  Pick the coin you'd like to pay with.
                  {selectedTier && (
                    <span className="mt-1 block font-semibold text-foreground">
                      Amount: ${USD_PRICES[selectedTier]} for {TIER_PRICES[selectedTier as keyof typeof TIER_PRICES]?.label} plan
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Cryptocurrency</Label>
                  <Select value={payCurrency} onValueChange={setPayCurrency} disabled={cryptoLoading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRYPTO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    We'll generate a one-time deposit address. Your subscription activates automatically after the network confirms the payment (usually a few minutes).
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMethod(null)} disabled={cryptoLoading} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleCryptoPayment}
                    disabled={cryptoLoading}
                    className="flex-1 gradient-warm border-0 text-primary-foreground shadow-glow"
                  >
                    {cryptoLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate address"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Crypto address */}
          {method === "crypto" && cryptoPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-amber-600" />
                  Send {cryptoPayment.pay_amount} {cryptoPayment.pay_currency.toUpperCase()}
                </DialogTitle>
                <DialogDescription>
                  Send exactly this amount to the address below.
                  {cryptoPayment.network && (
                    <span className="mt-1 block text-foreground font-semibold">
                      Network: {cryptoPayment.network.toUpperCase()}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 text-xs text-muted-foreground">Amount</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-semibold">
                      {cryptoPayment.pay_amount} {cryptoPayment.pay_currency.toUpperCase()}
                    </span>
                    <button
                      onClick={() => copyToClipboard(String(cryptoPayment.pay_amount))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copy amount"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 text-xs text-muted-foreground">Deposit address</div>
                  <div className="flex items-center gap-2">
                    <span className="break-all font-mono text-xs flex-1">{cryptoPayment.pay_address}</span>
                    <button
                      onClick={() => copyToClipboard(cryptoPayment.pay_address)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Copy address"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cryptoPayment.pay_address)}`}
                    alt="Crypto address QR code"
                    className="rounded-lg border border-border"
                    width={200}
                    height={200}
                  />
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Send the <strong>exact amount</strong> on the correct network — wrong-network or short payments may not be credited automatically.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your subscription activates automatically once the network confirms the payment. You can close this window.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
