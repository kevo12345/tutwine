import seriousDatingHero from "@/assets/ad-serious-dating-clean.jpg";
import youngProfessionalsHero from "@/assets/ad-young-professionals.jpg";
import newInTownHero from "@/assets/ad-new-in-town.jpg";
import singleParentsHero from "@/assets/ad-single-parents.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Briefcase, Heart, Shield, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

type AudienceKey = "serious-dating" | "young-professionals" | "new-in-town" | "single-parents";

type HighlightIcon = typeof Heart;

type AudienceConfig = {
  badge: string;
  headline: string;
  subheadline: string;
  cta: string;
  heroImage: string;
  heroAlt: string;
  proof: string[];
  highlights: { icon: HighlightIcon; title: string; description: string }[];
};

const audienceConfig: Record<AudienceKey, AudienceConfig> = {
  "serious-dating": {
    badge: "Built for real relationships",
    headline: "Meet people who are actually ready for something serious.",
    subheadline: "Skip the endless chatting and connect with verified singles who want commitment, chemistry, and genuine conversation.",
    cta: "Start Meeting Serious Singles",
    heroImage: seriousDatingHero,
    heroAlt: "Elegant couple enjoying a romantic candlelit dinner",
    proof: ["Verified profiles", "Photo-first matching", "Fast signup"],
    highlights: [
      { icon: Heart, title: "Intentional matches", description: "Profile prompts and compatibility signals help you meet people looking for the same thing." },
      { icon: Shield, title: "Safer dating", description: "Age-gated signup, profile reporting, and privacy-first location settings reduce noise and risk." },
      { icon: Sparkles, title: "Designed to convert", description: "Clear onboarding and fewer distractions make it easier to register and start discovering." },
    ],
  },
  "young-professionals": {
    badge: "For ambitious, social adults",
    headline: "Find your person between meetings, workouts, and weekend plans.",
    subheadline: "A clean, fast dating experience for busy professionals who want quality matches without wasting time.",
    cta: "Join Busy Professionals",
    heroImage: youngProfessionalsHero,
    heroAlt: "Stylish professionals meeting on a rooftop at sunset",
    proof: ["Quick onboarding", "Nearby discovery", "Conversation-first"],
    highlights: [
      { icon: Briefcase, title: "Time-saving signup", description: "Get from ad click to account creation in minutes with a simple registration flow." },
      { icon: Users, title: "Higher-quality pool", description: "Audience-matched landing copy helps attract the kind of members your campaign is targeting." },
      { icon: Heart, title: "Better first matches", description: "Strong profile guidance helps new users look more complete from day one." },
    ],
  },
  "new-in-town": {
    badge: "Perfect for fresh starts",
    headline: "New city, new energy, new people worth meeting.",
    subheadline: "Whether you just moved or want a new circle, Tutwine helps you meet nearby people faster without awkward guesswork.",
    cta: "Meet People Nearby",
    heroImage: newInTownHero,
    heroAlt: "Two people meeting for coffee in a lively city neighborhood",
    proof: ["Local discovery", "Real profiles", "Instant chat after match"],
    highlights: [
      { icon: Users, title: "Built for local connection", description: "Distance-based discovery makes it easy to meet people in your area right away." },
      { icon: Sparkles, title: "Warm first impression", description: "Landing page messaging matches relocation and fresh-start campaigns for stronger relevance." },
      { icon: Shield, title: "Private by default", description: "Approximate location controls help users feel safe while exploring a new environment." },
    ],
  },
  "single-parents": {
    badge: "Dating that respects your life",
    headline: "Meaningful connections for single parents who value maturity and intention.",
    subheadline: "No games, no endless swiping — just a more thoughtful way to meet people who appreciate your pace and priorities.",
    cta: "Start with Intention",
    heroImage: singleParentsHero,
    heroAlt: "Mature couple sharing coffee in a calm welcoming cafe",
    proof: ["Respectful community", "Fast registration", "Clear intentions"],
    highlights: [
      { icon: Heart, title: "More intentional dating", description: "Speak to users looking for emotional maturity and genuine connection from the first click." },
      { icon: Shield, title: "Trust-focused experience", description: "Verification and reporting tools support a safer, calmer dating environment." },
      { icon: Users, title: "Audience-fit campaigns", description: "Dedicated copy and CTA improve relevance for parent-focused ads and social campaigns." },
    ],
  },
};

const defaultAudience: AudienceKey = "serious-dating";

export default function AdLandingPage() {
  const navigate = useNavigate();
  const { audience } = useParams<{ audience?: AudienceKey }>();

  const config = useMemo(() => {
    if (audience && audience in audienceConfig) {
      return { key: audience as AudienceKey, ...audienceConfig[audience as AudienceKey] };
    }

    return { key: defaultAudience, ...audienceConfig[defaultAudience] };
  }, [audience]);

  return (
    <main className="min-h-screen bg-background">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <img src={config.heroImage} alt={config.heroAlt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-foreground/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/50 via-foreground/65 to-background/20" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-primary-foreground/80 transition-opacity hover:opacity-100">
              <img src="/logo.jpeg" alt="Tutwine" className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-display text-lg font-semibold text-primary-foreground">tutwine</span>
            </button>
            <Button variant="outline" className="border-primary-foreground/30 bg-card/10 text-primary-foreground hover:bg-card/20" onClick={() => navigate("/login")}>Log in</Button>
          </div>

          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-3xl">
              <Badge className="mb-5 border-0 gradient-warm px-4 py-1.5 text-sm text-primary-foreground">
                {config.badge}
              </Badge>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-primary-foreground sm:text-6xl">
                {config.headline}
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-primary-foreground/80 sm:text-xl">
                {config.subheadline}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {config.proof.map((item) => (
                  <span key={item} className="rounded-full border border-primary-foreground/20 bg-card/10 px-4 py-2 text-sm text-primary-foreground/90 backdrop-blur-sm">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gradient-warm border-0 px-8 text-base text-primary-foreground shadow-glow" onClick={() => navigate(`/signup?audience=${config.key}`)}>
                  {config.cta} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-card/10 text-base text-primary-foreground hover:bg-card/20" onClick={() => navigate("/pricing")}>
                  View Plans
                </Button>
              </div>
            </div>

            <Card className="border-border/40 bg-card/85 shadow-card backdrop-blur-md">
              <CardContent className="p-6 sm:p-8">
                <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Why this page converts</p>
                <div className="space-y-5">
                  {config.highlights.map((item) => (
                    <div key={item.title} className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-warm">
                        <item.icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-bold text-foreground">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-3xl bg-secondary p-5">
                  <p className="text-sm text-secondary-foreground">
                    <strong className="text-foreground">Campaign tip:</strong> send each ad set to its own URL like
                    <span className="mx-1 font-medium text-foreground">/welcome/{config.key}</span>
                    so the headline, promise, and CTA match the creative.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
