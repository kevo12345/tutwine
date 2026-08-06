import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearPendingPayment,
  fetchPaymentState,
  readPendingPayments,
  successMessage,
} from "@/lib/payments";

const CHECK_MS = 15_000;

/**
 * Keeps verifying payments the user left in the background ("Continue Browsing" /
 * "Try Later") and notifies them in-app once the backend confirms them.
 */
export function PendingPaymentWatcher() {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!user) return;
    let timer: number | undefined;

    const sweep = async () => {
      if (running.current) return;
      running.current = true;
      try {
        for (const p of readPendingPayments()) {
          try {
            const { state } = await fetchPaymentState(p);
            if (state === "finished") {
              clearPendingPayment(p.orderId);
              await refreshProfile?.();
              qc.invalidateQueries();
              toast.success("Payment confirmed", { description: successMessage(p.purchaseType) });
            } else if (state === "failed" || state === "expired") {
              clearPendingPayment(p.orderId);
            }
          } catch {
            /* retry on the next sweep */
          }
        }
      } finally {
        running.current = false;
      }
      timer = window.setTimeout(sweep, CHECK_MS);
    };

    timer = window.setTimeout(sweep, CHECK_MS);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}

export default PendingPaymentWatcher;
