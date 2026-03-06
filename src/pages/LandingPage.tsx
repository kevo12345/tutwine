import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heart, Shield, MapPin, MessageCircle, Sparkles, Check, ArrowRight, Star, Users, Clock, TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TIER_PRICES } from "@/lib/constants";
import { useState, useEffect } from "react";

const features = [
  { icon: Heart, title: "Smart Matching", desc: "AI-powered algorithm analyses 47 compatibility factors to find people who truly complement you." },
  { icon: Shield, title: "Safe & Verified", desc: "Every profile is photo-verified. Our trust & safety team reviews flagged content in under 24 hours." },
  { icon: MapPin, title: "Nearby Discovery", desc: "See who's close — without revealing exact locations. Privacy-first design keeps you safe." },
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with read receipts. No waiting, no games — just real conversations." },
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
  { num: "01", title: "Create Your Profile", desc: "Takes 2 minutes. Add photos, bio, and interests to stand out." },
  { num: "02", title: "Discover People", desc: "Swipe through verified profiles of people near you — no bots, no fakes." },
  { num: "03", title: "Match & Chat", desc: "When you both like each other, start chatting instantly. It's that simple." },
];

const testimonials = [
  { name: "Sarah K.", age: 27, text: "I met my partner on Tutwine after just 2 weeks. The matching is actually smart — not random.", rating: 5 },
  { name: "James M.", age: 31, text: "Finally a dating app where people are real. No catfish, no bots. Highly recommend.", rating: 5 },
  { name: "Amina W.", age: 24, text: "The safety features gave me confidence to actually go on dates. Best decision I made this year!", rating: 5 },
];

// Animated counter hook
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, setStarted };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const matchCounter = useCounter(52000);
  const activeCounter = useCounter(8400);
  const ratingCounter = useCounter(48);

  // Simulated "live" activity for social proof
  const [liveSignups, setLiveSignups] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setLiveSignups((n) => n + 1), 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="Tutwine" className="h-9 w-9 rounded-xl object-cover" />
            <span className="font-display text-xl font-bold">Tutwine</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Urgency micro-banner */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <span className="h-2 w-2 rounded-full bg-success" />
              {8400 + liveSignups} people online now
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Log in</Button>
            <Button size="sm" className="gradient-warm border-0 text-primary-foreground shadow-glow" onClick={() => navigate("/signup")}>
              Get Started — Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — Desire + Urgency */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="mb-4 gradient-warm border-0 text-primary-foreground px-4 py-1.5 text-sm">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> 🔥 Trending in your area
            </Badge>
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Stop swiping.
              <span className="text-gradient"> Start connecting.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Tutwine uses <strong>47 compatibility factors</strong> to match you with real, verified people nearby.
              No bots. No catfish. Just genuine connections.
            </p>

            {/* Social proof numbers */}
            <motion.div
              className="mt-8 flex justify-center gap-8 sm:gap-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onViewportEnter={() => {
                matchCounter.setStarted(true);
                activeCounter.setStarted(true);
                ratingCounter.setStarted(true);
              }}
            >
              <div className="text-center">
                <p className="font-display text-3xl font-extrabold text-gradient">{matchCounter.count.toLocaleString()}+</p>
                <p className="text-xs text-muted-foreground mt-1">Matches made</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-extrabold text-gradient">{activeCounter.count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Online now</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-extrabold text-gradient">{(ratingCounter.count / 10).toFixed(1)}★</p>
                <p className="text-xs text-muted-foreground mt-1">User rating</p>
              </div>
            </motion.div>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="gradient-warm border-0 text-primary-foreground shadow-glow text-base px-8" onClick={() => navigate("/signup")}>
                Create Free Account <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="text-base">
                View Plans
              </Button>
            </div>
            {/* Trust + scarcity */}
            <div className="mt-4 flex flex-col items-center gap-1">
              <p className="text-sm text-muted-foreground">✅ Free forever · 🔒 18+ verified · ⚡ 2 min signup</p>
              <p className="text-xs text-muted-foreground/70">
                <Clock className="inline h-3 w-3 mr-0.5" />
                Limited: Free accounts include 30 daily likes — <button onClick={() => navigate("/pricing")} className="text-primary underline">upgrade anytime</button>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social proof bar — Authority */}
      <section className="border-y border-border bg-card px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 sm:gap-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-success" />
            <span>256-bit encryption</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-info" />
            <span>50,000+ verified users</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>3x more matches than average</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-warning" />
            <span>Response in under 5 min</span>
          </div>
        </div>
      </section>

      {/* How it works — Simplicity bias */}
      <section className="bg-secondary/50 px-4 py-20" aria-labelledby="how-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="how-heading" className="text-center font-display text-3xl font-bold sm:text-4xl">
            3 steps. 2 minutes. Unlimited potential.
          </h2>
          <p className="mt-3 text-center text-muted-foreground">Most users get their first match within 24 hours.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div key={s.num} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                <div className="text-5xl font-display font-extrabold text-gradient">{s.num}</div>
                <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — Benefit-driven copy */}
      <section className="px-4 py-20" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="features-heading" className="text-center font-display text-3xl font-bold sm:text-4xl">Why 50,000+ choose Tutwine</h2>
          <p className="mt-3 text-center text-muted-foreground">Every feature is designed to help you find someone worth your time.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="border-0 shadow-card hover:shadow-glow transition-shadow">
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — Social proof */}
      <section className="bg-secondary/50 px-4 py-20" aria-labelledby="testimonials-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="testimonials-heading" className="text-center font-display text-3xl font-bold sm:text-4xl">Real stories. Real connections.</h2>
          <p className="mt-3 text-center text-muted-foreground">Don't just take our word for it.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="border-0 shadow-card h-full">
                  <CardContent className="p-6">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-sm italic text-foreground">"{t.text}"</p>
                    <p className="mt-4 text-sm font-medium text-muted-foreground">{t.name}, {t.age}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — Anchoring + decoy effect */}
      <section className="px-4 py-20" id="pricing" aria-labelledby="pricing-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="pricing-heading" className="text-center font-display text-3xl font-bold sm:text-4xl">Invest in your love life</h2>
          <p className="mt-3 text-center text-muted-foreground">Start free. Upgrade when you're ready for more matches.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {tiers.map((tier) => {
              const info = TIER_PRICES[tier.key];
              return (
                <Card key={tier.key} className={`relative overflow-hidden border-0 shadow-card ${tier.popular ? "ring-2 ring-primary shadow-glow scale-105" : ""}`}>
                  {tier.popular && (
                    <div className="absolute right-0 top-0 gradient-warm px-4 py-1 text-xs font-bold text-primary-foreground rounded-bl-xl">
                      ⚡ Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="font-display">{info.label}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-display font-bold text-foreground">${info.usd}</span>
                      <span className="text-muted-foreground">/month</span>
                      {tier.key === "plus" && (
                        <span className="ml-2 text-xs text-success font-medium">Best value</span>
                      )}
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
                      {tier.popular ? "Get Started Now" : `Get ${info.label}`}
                    </Button>
                    {tier.popular && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Cancel anytime · No hidden fees</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Safety — Trust */}
      <section className="bg-secondary/50 px-4 py-20" aria-labelledby="safety-heading">
        <div className="mx-auto max-w-3xl text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h2 id="safety-heading" className="mt-4 font-display text-3xl font-bold">Your safety is non-negotiable</h2>
          <p className="mt-3 text-muted-foreground">
            Tutwine is <strong>18+ only</strong>. We never show your exact location. Block and report any user instantly.
            Our trust & safety team reviews flagged content within 24 hours. Your data is encrypted with bank-level security.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Badge variant="secondary" className="text-xs">🔒 End-to-end encrypted</Badge>
            <Badge variant="secondary" className="text-xs">📸 Photo verified</Badge>
            <Badge variant="secondary" className="text-xs">🚫 Zero tolerance for abuse</Badge>
            <Badge variant="secondary" className="text-xs">🛡️ GDPR compliant</Badge>
          </div>
        </div>
      </section>

      {/* Final CTA — Loss aversion + urgency */}
      <section className="gradient-warm px-4 py-20">
        <div className="mx-auto max-w-3xl text-center text-primary-foreground">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Your next great connection is waiting</h2>
          <p className="mt-3 opacity-90">
            Every minute you wait, someone near you is matching with someone else.
            Join <strong>50,000+ singles</strong> who stopped scrolling and started connecting.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-base px-8 shadow-lg"
            onClick={() => navigate("/signup")}
          >
            Create Free Account — Takes 2 Minutes <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <p className="mt-3 text-sm opacity-75">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Footer with semantic HTML */}
      <footer className="border-t border-border px-4 py-8" role="contentinfo">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="Tutwine" className="h-7 w-7 rounded-lg object-cover" />
            <span className="font-display font-bold">Tutwine</span>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Safety</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </nav>
          <p className="text-sm text-muted-foreground">© 2026 PulseMatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
