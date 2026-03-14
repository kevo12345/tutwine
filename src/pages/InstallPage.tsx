import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Share, Smartphone, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6">
      <div className="mx-auto max-w-md">
        <button onClick={() => navigate(-1)} className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">Install Tutwine</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add Tutwine to your home screen for the best experience — instant access, offline support, and a native app feel.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-0 shadow-card">
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <p className="text-center font-medium">Tutwine is already installed!</p>
              <p className="text-center text-sm text-muted-foreground">
                You can open it from your home screen.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2 text-base">
            <Download className="h-5 w-5" /> Install Tutwine
          </Button>
        ) : isIOS ? (
          <Card className="border-0 shadow-card">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">How to install on iPhone</h2>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span>Tap the <Share className="inline h-4 w-4 text-primary" /> <strong className="text-foreground">Share</strong> button in Safari</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span>Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  <span>Tap <strong className="text-foreground">Add</strong> to confirm</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-card">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">How to install</h2>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span>Open the browser menu (⋮ or ⋯)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span>Tap <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home Screen</strong></span>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 space-y-3">
          <h3 className="font-display text-sm font-semibold text-muted-foreground">Why install?</h3>
          {[
            "Launch instantly from your home screen",
            "Works offline & loads faster",
            "Full-screen experience, no browser bars",
            "Get notified about new matches",
          ].map((text) => (
            <div key={text} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
