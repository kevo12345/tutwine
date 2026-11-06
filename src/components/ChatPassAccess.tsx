import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useChatAccess } from "@/hooks/useChatAccess";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_PASS_COINS, CHAT_PASS_HOURS } from "@/lib/chat-pass";

export function ChatPassAccess() {
  const { canChat, expiresAt, loading, error: accessError, refetch } = useChatAccess();
  const { profile, user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);
  const balance = Number(profile?.token_balance ?? 0);

  async function activate() {
    if (busy || !user) return;
    setBusy(true);
    setError("");
    try {
      const { error: purchaseError } = await supabase.rpc("purchase_chat_pass");
      if (purchaseError) throw purchaseError;
      await Promise.all([refreshProfile(), qc.invalidateQueries({ queryKey: ["chat-access", user.id] }), qc.invalidateQueries({ queryKey: ["token-transactions", user.id] })]);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Could not activate chat. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !profile || autoStarted.current || new URLSearchParams(location.search).get("unlock") !== "1") return;
    autoStarted.current = true;
    navigate(location.pathname, { replace: true });
    if (!canChat) {
      setOpen(true);
      if (balance >= CHAT_PASS_COINS) void activate();
    }
  }, [loading, profile, canChat, location.search]);

  if (loading) return <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;
  if (accessError) return <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry chat access</Button>;
  if (canChat) return expiresAt ? (
    <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Clock className="h-4 w-4" />Chat pass ends {new Date(expiresAt).toLocaleString()}</p>
  ) : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <p className="text-sm text-muted-foreground">All private chats · {CHAT_PASS_HOURS} hours</p>
        <Button size="sm" onClick={() => { setError(""); setOpen(true); }}><Coins className="mr-2 h-4 w-4" />Unlock · 1 coin</Button>
      </div>
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>12-hour chat pass</DialogTitle>
            <DialogDescription>Spend 1 coin ($0.25) for unlimited private messages in all conversations for 12 hours. The pass starts immediately after activation.</DialogDescription>
          </DialogHeader>
          <p className="text-sm">Your balance: {balance} coin{balance === 1 ? "" : "s"}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {balance >= CHAT_PASS_COINS ? (
              <Button disabled={busy} onClick={() => void activate()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}Activate · 1 coin</Button>
            ) : (
              <Button onClick={() => navigate(`/buy-tokens?amount=3&chat=${encodeURIComponent(location.pathname)}`)}>Buy 3 coins · $0.75</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}