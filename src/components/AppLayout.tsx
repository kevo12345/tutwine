import { ReactNode, useState, useEffect } from "react";
import { BottomNav } from "./BottomNav";
import { usePresence } from "@/hooks/usePresence";
import { useLocationPrompt } from "@/hooks/useLocationPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  usePresence();
  const { hasLocation, requestLocation } = useLocationPrompt();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Show location banner if user has no location and hasn't dismissed
  const showBanner = profile?.onboarding_complete && !hasLocation && !dismissed && !(profile?.latitude && profile?.longitude);

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {showBanner && (
        <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shrink-0">
          <MapPin className="h-5 w-5 shrink-0" />
          <p className="flex-1 text-sm font-medium">
            Enable location to see who's nearby
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 text-xs"
            onClick={requestLocation}
          >
            Turn On
          </Button>
          <button onClick={() => setDismissed(true)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <main className="flex-1 overflow-y-auto mx-auto w-full max-w-lg pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
