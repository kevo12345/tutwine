import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Ticket, Gift, Wallet, Clock, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Radio,
    title: "Open your room",
    body: "Hosting is free for subscribers. Add a title, check your camera, and go live straight from your phone.",
  },
  {
    icon: Ticket,
    title: "Viewers buy time",
    body: "Anyone can join for 1 token per hour ($1/hr, dropping to $0.35/hr after 2 hours). Their pass expires automatically and they can renew in a tap.",
  },
  {
    icon: Gift,
    title: "Gifts come in",
    body: "Viewers send coin gifts from the gift tray during your live. Every gift pops on screen for the whole room.",
  },
  {
    icon: Wallet,
    title: "You get paid",
    body: "Gift earnings land in your available balance instantly — no waiting for the live to end.",
  },
];

export default function LiveHowItWorksPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-3xl font-bold tracking-tight">How Live works</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything about hosting, joining, and how the money is split.
        </p>

        <div className="mt-6 space-y-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">{s.title}</h2>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-xl font-bold text-foreground">The split</h2>
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Gifts</span>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
                60% host
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              For every gift sent, 60% of its coin value is credited to your earnings immediately and 40%
              stays with Tutwine to cover streaming, payments, and moderation.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <Ticket className="h-4 w-4 text-primary" />
              <span className="font-semibold">Tickets — 60% host / 40% Tutwine</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A ticket costs 1 coin per hour and only unlocks that one live. Every ticket a viewer buys is
              recorded as host earnings and split instantly: you keep 60%, Tutwine keeps 40% as the platform
              commission for streaming, payments, and moderation.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Ticket revenue</span>
                <span className="font-semibold text-foreground">100%</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Your share</span>
                <span className="font-semibold text-primary">60%</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tutwine commission</span>
                <span className="font-semibold text-foreground">40%</span>
              </li>
            </ul>
            <div className="mt-3 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Example</p>
              <p className="mt-1">$10 of tickets sold → you earn $6, Tutwine earns $4.</p>
              <p className="mt-1">
                20 viewers × 1 coin/hour = 20 coins → 12 coins to you, 8 coins to Tutwine.
              </p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Tickets last one hour. If your live runs longer, viewers renew automatically when they have
              coins — each renewal is another ticket split the same 60/40 way. A live that runs an hour or
              more keeps the full 60% split on tickets and gifts.
            </p>
          </div>


          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-semibold">Cashing out</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Convert earnings to tokens 1:1, or use them to renew your subscription.</li>
              <li>Withdraw to Litecoin from $100, with a 72-hour cooldown between requests.</li>
              <li>Tokens you buy are for spending in the app — they can't be withdrawn as cash.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold">House rules</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Keep it 18+ and consensual. Nudity, harassment, and impersonation end a live and can suspend
              payouts. Hosts can mute or remove any viewer at any time.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-2">
          <Button size="lg" className="rounded-xl font-semibold" onClick={() => navigate("/live")}>
            Back to Live
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl"
            onClick={() => navigate("/host/earnings")}
          >
            View my earnings
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
