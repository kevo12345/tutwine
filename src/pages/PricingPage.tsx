import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Crown, Zap, Star, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TIER_PRICES } from "@/lib/constants";
import { toast } from "sonner";

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
    features: ["Unlimited everything", "Daily boost", "See who liked you", "Priority in discovery", "Read receipts", "Undo last swipe"],
    color: "bg-accent/10 text-accent",
  },
];

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="mx-auto max-w-lg px-4">
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

        <div className="space-y-4">
          {tiers.map((tier) => {
            const info = TIER_PRICES[tier.key];
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
                        <span className="text-2xl font-display font-bold text-foreground">${info.usd}</span>
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
                    onClick={() => toast.info("Payment integration coming soon!", { description: "Stripe checkout will be connected in the next phase." })}
                  >
                    Get {info.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cancel anytime. Prices shown in USD. Local pricing available.
        </p>
      </div>
    </div>
  );
}
