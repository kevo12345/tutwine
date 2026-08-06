import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tokensToUsd } from "@/lib/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tokens required for the action */
  needed: number;
  /** Current token balance */
  balance: number;
  /** Short description of what they were trying to do */
  action?: string;
  /** When topping up to join a live, the session to auto-join after payment */
  joinSessionId?: string;
  /** Hours of access to buy after the top-up */
  joinHours?: number;
};

const PRESETS = [3, 5, 10];

export function InsufficientTokensDialog({
  open,
  onOpenChange,
  needed,
  balance,
  action = "continue",
  joinSessionId,
  joinHours,
}: Props) {
  const navigate = useNavigate();
  const short = Math.max(0, Math.ceil(needed - balance));

  const topUp = (amount?: number) => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (amount) params.set("amount", String(amount));
    if (joinSessionId) {
      params.set("join", joinSessionId);
      params.set("hours", String(Math.max(1, joinHours ?? 1)));
    }
    const qs = params.toString();
    navigate(qs ? `/buy-tokens?${qs}` : "/buy-tokens");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Coins className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Not enough coins</DialogTitle>
          <DialogDescription className="text-center">
            You need {needed} coin{needed === 1 ? "" : "s"} to {action}. Your balance is{" "}
            {balance} — top up {short} more to keep going.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 py-1">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => topUp(Math.max(amount, short))}
              className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-2 py-3 transition active:scale-95"
            >
              <span className="flex items-center gap-1 text-sm font-semibold">
                <Coins className="h-3.5 w-3.5 text-primary" />
                {Math.max(amount, short)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                ${tokensToUsd(Math.max(amount, short)).toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" size="lg" onClick={() => topUp()}>
            Top up coins
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
