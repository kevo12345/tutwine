import { supabase } from "@/integrations/supabase/client";

export type PaymentMethodKind = "mpesa" | "crypto";
export type PurchaseType = "subscription" | "tokens" | "live_ticket" | "gift" | "premium";
export type PaymentState =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "finished"
  | "failed"
  | "expired"
  | "timeout";

export type PendingPayment = {
  paymentMethod: PaymentMethodKind;
  purchaseType: PurchaseType;
  orderId: string;
  paymentId?: string | null;
  amount?: number | null;
  currency?: string | null;
  createdAt: number;
};

const KEY = "tutwine.pendingPayments";
const MAX_AGE_MS = 1000 * 60 * 60 * 6; // stop tracking after 6 hours

export async function fetchPaymentState(p: {
  paymentMethod: PaymentMethodKind;
  purchaseType: PurchaseType;
  orderId: string;
  paymentId?: string | null;
}): Promise<{ state: PaymentState; providerStatus?: string }> {
  const { data, error } = await supabase.functions.invoke("payment-status", {
    body: {
      purchase_type: p.purchaseType,
      order_id: p.orderId,
      payment_id: p.paymentId ?? null,
      payment_method: p.paymentMethod,
    },
  });
  if (error) throw error;
  return { state: (data?.state ?? "waiting") as PaymentState, providerStatus: data?.provider_status };
}

export function readPendingPayments(): PendingPayment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingPayment[];
    const fresh = list.filter((p) => Date.now() - p.createdAt < MAX_AGE_MS);
    if (fresh.length !== list.length) writePendingPayments(fresh);
    return fresh;
  } catch {
    return [];
  }
}

function writePendingPayments(list: PendingPayment[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function savePendingPayment(p: Omit<PendingPayment, "createdAt">) {
  const list = readPendingPayments().filter((x) => x.orderId !== p.orderId);
  list.push({ ...p, createdAt: Date.now() });
  writePendingPayments(list);
}

export function clearPendingPayment(orderId: string) {
  writePendingPayments(readPendingPayments().filter((p) => p.orderId !== orderId));
}

export function successMessage(purchaseType: PurchaseType): string {
  switch (purchaseType) {
    case "subscription":
      return "Your subscription is now active.";
    case "tokens":
      return "Your tokens have been added to your balance.";
    case "live_ticket":
      return "Your live-session access is ready.";
    case "gift":
      return "Your gift purchase was successful.";
    default:
      return "Your purchase was successful.";
  }
}
