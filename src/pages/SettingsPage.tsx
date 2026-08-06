import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, Shield, CreditCard, LogOut, ChevronRight, Loader2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TUTWINE_URL = "https://tutwine.com";

const isValidBep20 = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();

  const savedWallet = ((profile as any)?.usdt_wallet_address ?? "") as string;
  const [wallet, setWallet] = useState(savedWallet);
  const [savingWallet, setSavingWallet] = useState(false);
  const [editingWallet, setEditingWallet] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setWallet(((profile as any)?.usdt_wallet_address ?? "") as string);
  }, [profile]);


  const handleToggle = async (field: "hide_distance" | "hide_state", value: boolean) => {
    if (!user) return;
    await supabase.from("profiles").update({ [field]: value }).eq("user_id", user.id);
  };

  const handleSaveWallet = async () => {
    if (!user) return;
    setSavingWallet(true);
    const { error } = await supabase
      .from("profiles")
      .update({ usdt_wallet_address: wallet.trim() || null } as any)
      .eq("user_id", user.id);
    setSavingWallet(false);
    setConfirmOpen(false);
    if (error) toast.error(error.message);
    else {
      setEditingWallet(false);
      toast.success("USDT (BEP20) address saved");
    }
  };


  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
        </div>

        {/* Account */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Account</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Edit Profile</span>
              </div>
              <button onClick={() => navigate("/onboarding")} className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
            </CardContent>
            <CardContent className="flex items-center justify-between p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Subscription</span>
              </div>
              <button onClick={() => navigate("/pricing")} className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
            </CardContent>
          </Card>
        </div>

        {/* Privacy */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Privacy</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Hide my distance</span>
              </div>
              <Switch defaultChecked={profile?.hide_distance ?? false} onCheckedChange={(v) => handleToggle("hide_distance", v)} />
            </CardContent>
            <CardContent className="flex items-center justify-between p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Hide my state</span>
              </div>
              <Switch defaultChecked={profile?.hide_state ?? false} onCheckedChange={(v) => handleToggle("hide_state", v)} />
            </CardContent>
          </Card>
        </div>

        {/* Payouts */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Payouts</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="usdt" className="text-sm">USDT (BEP20) Address</Label>
              {!editingWallet ? (
                <div className="space-y-3">
                  <p className="break-all rounded-md bg-muted px-3 py-2 text-sm">
                    {savedWallet || <span className="text-muted-foreground">No USDT (BEP20) address saved yet</span>}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => { setWallet(savedWallet); setEditingWallet(true); }}>
                    <Pencil className="h-4 w-4 mr-2" /> {savedWallet ? "Edit address" : "Add address"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    id="usdt"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="0x... BEP20 (BNB Smart Chain) address"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Only USDT on BEP20 (BNB Smart Chain) is supported. Sending to an address on another
                    network will permanently lose your funds.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={savingWallet}>
                      {savingWallet && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save address
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setWallet(savedWallet); setEditingWallet(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm your USDT (BEP20) address</AlertDialogTitle>
              <AlertDialogDescription>
                Please double-check this is correct. Withdrawals sent to a wrong address cannot be
                recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="break-all rounded-md bg-muted px-3 py-2 text-sm font-mono">{wallet.trim()}</p>
            {!isValidBep20(wallet) && (
              <p className="text-[11px] text-destructive">
                This does not look like a BEP20 address (should start with 0x and be 42 characters).
                You can still save it, but make sure it is correct.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Let me edit it</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveWallet}>Yes, it's correct</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* Account Actions */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Account Actions</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="p-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Log Out
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mb-20 text-center text-xs text-muted-foreground">Tutwine v1.0 · Terms · Privacy</p>
      </div>
    </AppLayout>
  );
}
