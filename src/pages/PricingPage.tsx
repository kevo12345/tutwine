import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowLeft, Crown, Zap, Star, Loader2, Phone } from "lucide-react";
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

const tiers = [
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
  basic: 400,
  plus: 650,
  pro: 1300,
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: currentTier } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectPlan = (tierKey: string) => {
    if (!user) {
      toast.info("Please sign in first to subscribe.");
      navigate("/login");
      return;
    }
    setSelectedTier(tierKey);
    setDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedTier || !phone) return;

    const cleanPhone = phone.replace(/\s+/g, "");
    if (!/^(0?[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(cleanPhone)) {
      toast.error("Enter a valid Safaricom phone number (e.g. 0712345678)");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sellapay-stk-push", {
        body: {
          phone: cleanPhone,
          amount: KES_PRICES[selectedTier],
          tier: selectedTier,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${TIER_PRICES[selectedTier as keyof typeof TIER_PRICES]?.label} plan activated!`, {
          description: "Check your phone and enter your M-Pesa PIN to complete payment. You're now on the " + TIER_PRICES[selectedTier as keyof typeof TIER_PRICES]?.label + " plan.",
          duration: 6000,
        });
        setDialogOpen(false);
        setPhone("");
        navigate("/discover");
      } else {
        toast.error(data?.error || "Payment failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
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

        <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          {tiers.map((tier) => {
            const info = TIER_PRICES[tier.key];
            const kesPrice = KES_PRICES[tier.key];
            return (
              <Card key={tier.key} className={`relative border-0 shadow-card overflow-hidden ${tier.popular ? "ring-2 ring-primary" : ""}`}>
                {tier.popular && (
                  <div className="absolute right-0 top-0 gradient-warm px-3 py-1 text-[10px] font-bold text-primary-foreground rounded-bl-xl uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${tier.color}`}>
                      <tier.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-lg">{info.label}</CardTitle>
                      <CardDescription>
                        <span className="text-2xl font-display font-bold text-foreground">KES {kesPrice}</span>
                        <span className="text-muted-foreground">/mo</span>
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
                    className={`mt-4 w-full ${tier.popular ? "gradient-warm border-0 text-primary-foreground shadow-glow" : ""}`}
                    variant={tier.popular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(tier.key)}
                  >
                    Get {info.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cancel anytime. Pay via M-Pesa. Prices in KES.
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Safaricom number (e.g. 0712345678 or 254712345678)
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                ⚠️ Your subscription will only activate after you complete the M-Pesa payment on your phone. If you cancel or don't enter your PIN, no charges will apply.
              </p>
            </div>
            <Button
              onClick={handlePayment}
              disabled={loading || !phone}
              className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending prompt...
                </>
              ) : (
                `Pay KES ${selectedTier ? KES_PRICES[selectedTier] : ""}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
