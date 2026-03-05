import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heart, Shield, MapPin, MessageCircle, Sparkles, Check, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TIER_PRICES } from "@/lib/constants";

const features = [
  { icon: Heart, title: "Smart Matching", desc: "Our algorithm finds people who share your interests and values." },
  { icon: Shield, title: "Safe & Verified", desc: "Photo verification, reporting tools, and 18+ only community." },
  { icon: MapPin, title: "Nearby Discovery", desc: "Find people near you with approximate distance—never exact locations." },
  { icon: MessageCircle, title: "Real-time Chat", desc: "Message your matches instantly with read receipts and typing indicators." },
];

const tiers = [
  {
    key: "basic" as const,
    features: ["100 profile views/day", "50 likes/day", "Standard filters", "Ad-free experience"],
    popular: false,
  },
  {
    key: "plus" as const,
    features: ["Unlimited views", "200 likes/day", "1 weekly boost", "Priority support", "Advanced filters"],
    popular: true,
  },
  {
    key: "pro" as const,
    features: ["Unlimited everything", "Daily boost", "See who liked you", "Priority in discovery", "Read receipts"],
    popular: false,
  },
];

const steps = [
  { num: "01", title: "Create Your Profile", desc: "Add photos, bio, and interests to stand out." },
  { num: "02", title: "Discover People", desc: "Swipe through profiles of people near you." },
  { num: "03", title: "Match & Chat", desc: "When you both like each other, start chatting!" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="gradient-warm rounded-xl p-1.5">
              <Heart className="h-5 w-5 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">PulseMatch</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Log in</Button>
            <Button size="sm" className="gradient-warm border-0 text-primary-foreground shadow-glow" onClick={() => navigate("/signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="mb-4 gradient-warm border-0 text-primary-foreground px-4 py-1.5 text-sm">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Now in your area
            </Badge>
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Find your
              <span className="text-gradient"> perfect match</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              PulseMatch connects you with real people nearby. Safe, modern dating with smart matching, real-time chat, and no games.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="gradient-warm border-0 text-primary-foreground shadow-glow text-base px-8" onClick={() => navigate("/signup")}>
                Start Matching <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="text-base">
                View Plans
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free to join · 18+ only · No spam</p>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-secondary/50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">How it works</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <motion.div key={s.num} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="text-5xl font-display font-extrabold text-gradient">{s.num}</div>
                <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Why PulseMatch?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-card hover:shadow-glow transition-shadow">
                <CardContent className="flex gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-warm">
                    <f.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-secondary/50 px-4 py-20" id="pricing">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Simple Pricing</h2>
          <p className="mt-3 text-center text-muted-foreground">Start free. Upgrade when you're ready.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {tiers.map((tier) => {
              const info = TIER_PRICES[tier.key];
              return (
                <Card key={tier.key} className={`relative overflow-hidden border-0 shadow-card ${tier.popular ? "ring-2 ring-primary shadow-glow" : ""}`}>
                  {tier.popular && (
                    <div className="absolute right-0 top-0 gradient-warm px-4 py-1 text-xs font-bold text-primary-foreground rounded-bl-xl">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="font-display">{info.label}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-display font-bold text-foreground">${info.usd}</span>
                      <span className="text-muted-foreground">/month</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-success" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`mt-6 w-full ${tier.popular ? "gradient-warm border-0 text-primary-foreground shadow-glow" : ""}`}
                      variant={tier.popular ? "default" : "outline"}
                      onClick={() => navigate("/signup")}
                    >
                      Get {info.label}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 font-display text-3xl font-bold">Your Safety Matters</h2>
          <p className="mt-3 text-muted-foreground">
            PulseMatch is 18+ only. We never show your exact location. Block and report any user instantly. Our team reviews flagged content within 24 hours.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-warm px-4 py-20">
        <div className="mx-auto max-w-3xl text-center text-primary-foreground">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to find your match?</h2>
          <p className="mt-3 opacity-90">Join thousands of people finding genuine connections on PulseMatch.</p>
          <Button
            size="lg"
            className="mt-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-base px-8"
            onClick={() => navigate("/signup")}
          >
            Create Free Account <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="gradient-warm rounded-lg p-1">
              <Heart className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-display font-bold">PulseMatch</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Safety</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 PulseMatch</p>
        </div>
      </footer>
    </div>
  );
}
