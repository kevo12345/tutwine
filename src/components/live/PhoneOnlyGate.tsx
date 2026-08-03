import { useNavigate } from "react-router-dom";
import { Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsPhone } from "@/hooks/useIsPhone";
import { isNativeApp } from "@/lib/platform";

/**
 * Live streaming is phone-only (portrait camera experience). On desktop we show
 * a short notice instead of rendering the live view.
 */
export function PhoneOnlyGate({ children }: { children: React.ReactNode }) {
  const isPhone = useIsPhone();
  const native = isNativeApp();
  const navigate = useNavigate();

  if (native) return <>{children}</>;

  if (isPhone === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!isPhone) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center text-white">
        <Smartphone className="h-12 w-12 opacity-70" />
        <h1 className="text-xl font-bold">Live is available on mobile only</h1>
        <p className="max-w-sm text-sm text-white/70">
          Tutwine Live is built for a full-screen portrait camera, so hosting and watching lives
          only works on a phone. Open tutwine.com on your phone (or install the app) to go live or
          join a stream.
        </p>
        <Button variant="secondary" onClick={() => navigate("/live")}>
          Back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
