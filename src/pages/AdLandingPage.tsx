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
  emotionalNote: string;
  cta: string;
  heroImage: string;
  heroAlt: string;
  proof: string[];
  highlights: { icon: HighlightIcon; title: string; description: string }[];
};

const audienceConfig: Record<AudienceKey, AudienceConfig> = {
  "serious-dating": {
    badge: "Built for real relationships",
    headline: "Meet someone who feels easy to talk to — and worth showing up for.",
    subheadline: "Tutwine helps you connect with real people who want something genuine, warm, and lasting — not just another empty chat.",
    emotionalNote: "Because the best connections start with honesty, comfort, and a little spark.",
    cta: "Start Something Real",
    heroImage: seriousDatingHero,
    heroAlt: "Elegant couple enjoying a romantic candlelit dinner",
    proof: ["Verified profiles", "Warm first impressions", "Fast signup"],
    highlights: [
      { icon: Heart, title: "More human matches", description: "Profiles are shaped to feel personal, so every conversation starts with more depth and less guesswork." },
      { icon: Shield, title: "Safer from the first hello", description: "Privacy tools and clear reporting help people feel more comfortable opening up." },
      { icon: Sparkles, title: "Built for genuine chemistry", description: "A softer, more intentional flow helps people join with the right expectations." },
    ],
  },
  "young-professionals": {
    badge: "For ambitious, social adults",
    headline: "Find someone who fits your rhythm — and feels good to come home to.",
    subheadline: "For busy people who still want real connection, Tutwine makes it easier to meet someone genuine without wasting energy.",
    emotionalNote: "A modern dating experience that feels effortless, warm, and worth your time.",
    cta: "Meet Someone Genuine",
    heroImage: youngProfessionalsHero,
    heroAlt: "Stylish professionals meeting on a rooftop at sunset",
    proof: ["Quick onboarding", "Quality matches", "Real conversations"],
    highlights: [
      { icon: Briefcase, title: "Simple to start", description: "A cleaner path from ad click to signup keeps the experience calm, polished, and inviting." },
      { icon: Users, title: "People you can picture yourself with", description: "Audience-matched messaging helps attract users who feel aligned with your lifestyle." },
      { icon: Heart, title: "Less noise, more connection", description: "The page focuses on warmth and clarity instead of hype, so the experience feels more real." },
    ],
  },
  "new-in-town": {
    badge: "Perfect for fresh starts",
    headline: "New place, new energy, and new people who can make it feel like home.",
    subheadline: "Whether you just moved or simply want a new chapter, Tutwine helps you meet nearby people in a way that feels natural and welcoming.",
    emotionalNote: "Sometimes one good conversation is all it takes to make a city feel smaller.",
    cta: "Meet People Nearby",
    heroImage: newInTownHero,
    heroAlt: "Two people meeting for coffee in a lively city neighborhood",
    proof: ["Local discovery", "Friendly first matches", "Instant chat"],
    highlights: [
      { icon: Users, title: "A warmer first step", description: "The experience feels less like swiping strangers and more like meeting people already close to your world." },
      { icon: Sparkles, title: "Built for fresh beginnings", description: "The page speaks to curiosity, comfort, and possibility — not pressure." },
      { icon: Shield, title: "Private while you explore", description: "Location privacy gives people confidence while they settle in and connect." },
    ],
  },
  "single-parents": {
    badge: "Dating that respects your life",
    headline: "Meet someone who understands your pace, your priorities, and your heart.",
    subheadline: "Tutwine creates a calmer, more intentional dating experience for people who want something genuine without the pressure or games.",
    emotionalNote: "Real connection can still feel light, hopeful, and beautifully simple.",
    cta: "Begin with Intention",
    heroImage: singleParentsHero,
    heroAlt: "Mature couple sharing coffee in a calm welcoming cafe",
    proof: ["Respectful community", "Gentle signup", "Clear intentions"],
    highlights: [
      { icon: Heart, title: "Emotionally grounded", description: "The tone is softer and more reassuring, making the experience feel respectful from the first click." },
      { icon: Shield, title: "Trust you can feel", description: "Safety and clarity stay visible without making the page feel cold or clinical." },
      { icon: Users, title: "Made for real life", description: "Everything is framed around connection, maturity, and feeling understood." },
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
          <img src={config.heroImage} alt={config.heroAlt} className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-foreground/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 via-foreground/18 to-foreground/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/18 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-primary-foreground/90 transition-opacity hover:opacity-100">
              <img src="/logo.jpeg" alt="Tutwine" className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-display text-lg font-semibold text-primary-foreground">tutwine</span>
            </button>
            <Button variant="outline" className="border-primary-foreground/30 bg-card/15 text-primary-foreground hover:bg-card/25" onClick={() => navigate("/login")}>Log in</Button>
          </div>

          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-3xl rounded-[2rem] border border-primary-foreground/15 bg-card/8 p-6 backdrop-blur-[3px] sm:p-8">
              <Badge className="mb-5 border-0 gradient-warm px-4 py-1.5 text-sm text-primary-foreground">
                {config.badge}
              </Badge>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-primary-foreground sm:text-6xl">
                {config.headline}
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-primary-foreground/90 sm:text-xl">
                {config.subheadline}
              </p>
              <p className="mt-4 max-w-xl text-base italic text-primary-foreground/80 sm:text-lg">
                {config.emotionalNote}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {config.proof.map((item) => (
                  <span key={item} className="rounded-full border border-primary-foreground/20 bg-card/15 px-4 py-2 text-sm text-primary-foreground/95 backdrop-blur-sm">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gradient-warm border-0 px-8 text-base text-primary-foreground shadow-glow" onClick={() => navigate(`/signup?audience=${config.key}`)}>
                  {config.cta} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-card/15 text-base text-primary-foreground hover:bg-card/25" onClick={() => navigate("/pricing")}>
                  View Plans
                </Button>
              </div>
            </div>

            <Card className="border-border/25 bg-card/72 shadow-card backdrop-blur-md">
              <CardContent className="p-6 sm:p-8">
                <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Why it feels right</p>
                <p className="mb-6 max-w-md text-sm leading-6 text-muted-foreground">
                  A warmer first impression helps people trust the app faster and imagine themselves inside it.
                </p>
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
                <div className="mt-8 rounded-3xl bg-secondary/90 p-5">
                  <p className="text-sm text-secondary-foreground">
                    <strong className="text-foreground">Campaign tip:</strong> send each ad set to its own URL like
                    <span className="mx-1 font-medium text-foreground">/welcome/{config.key}</span>
                    so the story, image, and CTA feel consistent from ad to signup.
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
