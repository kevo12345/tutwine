import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { LiveSuggestionBanner } from "./LiveSuggestionBanner";
import { usePresence } from "@/hooks/usePresence";
import { useLocationPrompt } from "@/hooks/useLocationPrompt";
import { useLikeNotifications } from "@/hooks/useLikeNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, X, Settings, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () => /Android/.test(navigator.userAgent);
const isMac = () => /Macintosh/.test(navigator.userAgent);

function getSettingsInstructions() {
  if (isIOS()) {
    return {
      title: "Enable Location on iPhone",
      steps: [
        "Open the Settings app on your iPhone",
        "Scroll down and tap Privacy & Security",
        "Tap Location Services and make sure it's turned on",
        "Scroll down and find your browser (Safari / Chrome)",
        "Tap it and select \"While Using the App\" or \"Ask Next Time\"",
        "Come back here and tap \"Try Again\"",
      ],
    };
  }
  if (isAndroid()) {
    return {
      title: "Enable Location on Android",
      steps: [
        "Open your phone's Settings app",
        "Tap Location and make sure it's turned on",
        "Go back to Settings → Apps → your browser",
        "Tap Permissions → Location → Allow",
        "Come back here and tap \"Try Again\"",
      ],
    };
  }
  if (isMac()) {
    return {
      title: "Enable Location on Mac",
      steps: [
        "Open System Settings → Privacy & Security → Location Services",
        "Make sure Location Services is turned on",
        "Find your browser in the list and check the box",
        "Also click the lock icon on the left side of the browser address bar",
        "Click \"Reset permission\" or allow location for this site",
        "Come back here and tap \"Try Again\"",
      ],
    };
  }
  return {
    title: "Enable Location in Browser",
    steps: [
      "Click the lock/info icon in your browser's address bar (left of the URL)",
      "Find \"Location\" in the permissions list",
      "Change it from \"Block\" to \"Allow\"",
      "Refresh the page, then tap \"Try Again\"",
    ],
  };
}

export function AppLayout({ children }: { children: ReactNode }) {
  usePresence();
  useLikeNotifications();
  const { hasLocation, requestLocation, locationStatus } = useLocationPrompt();
  const { profile } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const showLiveBanner = ["/discover", "/likes", "/chat"].some((p) => location.pathname === p || location.pathname.startsWith(p + "/")) && location.pathname !== "/live";



  const showBanner =
    profile?.onboarding_complete &&
    !hasLocation &&
    !dismissed &&
    !(profile?.latitude && profile?.longitude);

  const isDenied = locationStatus === "denied";
  const isRequesting = locationStatus === "requesting";
  const instructions = getSettingsInstructions();

  const handleTurnOn = () => {
    if (isDenied) {
      setShowGuide(true);
    } else {
      requestLocation();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {showBanner && (
        <div className={`flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-primary-foreground shrink-0 ${isDenied ? "bg-destructive" : "bg-primary"}`}>
          {isDenied ? (
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          ) : (
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          )}
          <p className="flex-1 text-xs sm:text-sm font-medium">
            {isDenied
              ? "Location blocked — tap to fix"
              : "Enable location to see who's nearby"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 text-[10px] sm:text-xs gap-1 h-7 sm:h-8 px-2 sm:px-3"
            onClick={handleTurnOn}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Requesting...</span>
              </>
            ) : isDenied ? (
              <>
                <Settings className="h-3 w-3" />
                Fix It
              </>
            ) : (
              "Turn On"
            )}
          </Button>
          <button onClick={() => setDismissed(true)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      )}
      {showLiveBanner && <div className="pt-2"><LiveSuggestionBanner /></div>}
      <main className="flex-1 min-h-0 relative overflow-y-auto mx-auto w-full max-w-lg pb-0 -webkit-overflow-scrolling-touch" style={{ WebkitOverflowScrolling: 'touch' }}>{children}</main>
      <BottomNav />

      {/* Location Settings Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {instructions.title}
            </DialogTitle>
            <DialogDescription>
              Location access was blocked. Follow these steps to enable it:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 pt-2">
            {instructions.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowGuide(false)}
            >
              Dismiss
            </Button>
            <Button
              className="flex-1 gradient-warm border-0 text-primary-foreground"
              onClick={() => {
                setShowGuide(false);
                requestLocation();
              }}
            >
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}