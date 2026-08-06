import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import {
  clearPendingPayment,
  fetchPaymentState,
  savePendingPayment,
  successMessage,
  type PaymentMethodKind,
  type PaymentState,
  type PurchaseType,
} from "@/lib/payments";

const POLL_MS = 3000;
const SLOW_AFTER_MS = 90_000;

export type PaymentProcessingOverlayProps = {
  open: boolean;
  paymentMethod: PaymentMethodKind;
  purchaseType: PurchaseType;
  paymentId?: string | null;
  orderId: string;
  amount?: number | null;
  currency?: string | null;
  successRedirect?: string;
  retryCallback?: () => void;
  onClose?: () => void;
};

const STEPS = ["Payment submitted", "Verifying payment", "Activating purchase", "Redirecting"];

type Phase = "processing" | "slow" | "success" | "failed";

export function PaymentProcessingOverlay({
  open,
  paymentMethod,
  purchaseType,
  paymentId,
  orderId,
  amount,
  currency,
  successRedirect,
  retryCallback,
  onClose,
}: PaymentProcessingOverlayProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [state, setState] = useState<PaymentState>("waiting");
  const [phase, setPhase] = useState<Phase>("processing");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const stopped = useRef(false);

  const defaultRedirect = useMemo(() => {
    switch (purchaseType) {
      case "subscription":
        return "/discover";
      case "tokens":
        return "/buy-tokens";
      default:
        return "/discover";
    }
  }, [purchaseType]);

  const redirectTo = successRedirect || defaultRedirect;

  const finish = useCallback(() => {
    stopped.current = true;
    clearPendingPayment(orderId);
    qc.invalidateQueries();
    setTimeout(() => {
      onClose?.();
      navigate(redirectTo);
    }, 1500);
  }, [navigate, onClose, orderId, qc, redirectTo]);

  // Poll the backend for the real payment status.
  useEffect(() => {
    if (!open) return;
    stopped.current = false;
    startedAt.current = Date.now();
    setState("waiting");
    setPhase("processing");

    savePendingPayment({ paymentMethod, purchaseType, orderId, paymentId, amount, currency });

    let timer: number | undefined;

    const tick = async () => {
      if (stopped.current) return;
      try {
        const { state: next } = await fetchPaymentState({
          paymentMethod,
          purchaseType,
          orderId,
          paymentId,
        });
        if (stopped.current) return;
        setState(next);

        if (next === "finished") {
          setPhase("success");
          finish();
          return;
        }
        if (next === "failed" || next === "expired" || next === "timeout") {
          stopped.current = true;
          setPhase("failed");
          return;
        }
        if (Date.now() - startedAt.current > SLOW_AFTER_MS) {
          setPhase("slow");
        }
      } catch {
        // Network hiccup — keep polling.
      }
      if (!stopped.current) timer = window.setTimeout(tick, POLL_MS);
    };

    tick();

    return () => {
      stopped.current = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, paymentId, paymentMethod, purchaseType]);

  if (!open) return null;

  const activeStep =
    phase === "success" ? 3 : state === "confirmed" ? 2 : state === "waiting" ? 1 : state === "confirming" ? 1 : 1;

  const keepWaiting = () => {
    startedAt.current = Date.now();
    stopped.current = false;
    setPhase("processing");
  };

  const continueBrowsing = () => {
    onClose?.();
    navigate("/discover");
  };

  const recheck = async () => {
    if (busy) return;
    setBusy(true);
    stopped.current = false;
    setPhase("processing");
    startedAt.current = Date.now();
    setBusy(false);
  };

  const tryAgain = () => {
    if (busy) return;
    setBusy(true);
    clearPendingPayment(orderId);
    onClose?.();
    retryCallback?.();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm px-5 py-8 overflow-y-auto">
      <div className="w-full max-w-sm text-center">
        {phase === "success" ? (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success/15 animate-in zoom-in duration-500">
              <Check className="h-10 w-10 text-success" strokeWidth={3} />
            </div>
            <h2 className="font-display text-2xl font-bold">Payment confirmed</h2>
            <p className="mt-2 text-sm text-muted-foreground">{successMessage(purchaseType)}</p>
            <p className="mt-4 text-sm font-medium text-primary">Redirecting you now…</p>
          </>
        ) : phase === "failed" ? (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-9 w-9 text-destructive" />
            </div>
            <h2 className="font-display text-2xl font-bold">Payment not confirmed</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn’t verify your payment.</p>
            <div className="mt-4 rounded-xl border border-border bg-card p-4 text-left">
              <p className="text-xs font-semibold">Possible reasons</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Payment not received</li>
                <li>• Wrong amount</li>
                <li>• Wrong payment network</li>
                <li>• Payment request expired</li>
              </ul>
            </div>
            <div className="mt-5 space-y-2">
              <Button
                className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
                disabled={busy}
                onClick={tryAgain}
              >
                Try Again
              </Button>
              <Button variant="outline" className="w-full" disabled={busy} onClick={recheck}>
                Check Payment Status
              </Button>
              <Button variant="ghost" className="w-full" onClick={continueBrowsing}>
                Try Later
              </Button>
            </div>
          </>
        ) : phase === "slow" ? (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-9 w-9 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold">Still confirming your payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment has been detected. We’re waiting for the payment provider or blockchain to
              finish confirming it. This may take a few minutes.
            </p>
            <div className="mt-5 space-y-2">
              <Button
                className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
                onClick={keepWaiting}
              >
                Keep Waiting
              </Button>
              <Button variant="outline" className="w-full" onClick={continueBrowsing}>
                Continue Browsing
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <span className="absolute inset-0 rounded-full border-2 border-primary/30" />
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold">Verifying your payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we securely confirm your payment.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 text-left">
              {STEPS.map((label, i) => {
                const done = i < activeStep;
                const active = i === activeStep;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        done
                          ? "border-success bg-success/15"
                          : active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/40"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
                      ) : active ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        done ? "text-foreground" : active ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {amount ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {currency ? `${currency.toUpperCase()} ` : ""}
                {amount} · {paymentMethod === "mpesa" ? "M-Pesa" : "Crypto"}
              </p>
            ) : null}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              You’ll be redirected automatically once your payment is confirmed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentProcessingOverlay;
