import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Shield, CreditCard, LogOut, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TUTWINE_URL = "https://tutwine.com";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [wallet, setWallet] = useState((profile as any)?.litecoin_wallet_address ?? "");
  const [savingWallet, setSavingWallet] = useState(false);

  const handleToggle = async (field: "hide_distance" | "hide_state", value: boolean) => {
    if (!user) return;
    await supabase.from("profiles").update({ [field]: value }).eq("user_id", user.id);
  };

  const handleSaveWallet = async () => {
    if (!user) return;
    setSavingWallet(true);
    const { error } = await supabase
      .from("profiles")
      .update({ litecoin_wallet_address: wallet.trim() || null } as any)
      .eq("user_id", user.id);
    setSavingWallet(false);
    if (error) toast.error(error.message);
    else toast.success("Litecoin wallet saved");
  };


  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out");
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "delete_own_account" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Sign out locally and redirect to tutwine.com
      await supabase.auth.signOut();
      window.location.href = TUTWINE_URL;
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setDeleting(false);
    }
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
              <Label htmlFor="ltc" className="text-sm">Litecoin Wallet Address</Label>
              <Input
                id="ltc"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Your LTC address (required for withdrawals)"
              />
              <Button size="sm" onClick={handleSaveWallet} disabled={savingWallet}>
                {savingWallet && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save wallet
              </Button>
            </CardContent>
          </Card>
        </div>



        {/* Account Actions */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Account Actions</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="p-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Log Out
              </Button>
            </CardContent>
            <CardContent className="border-t border-border p-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-3 text-sm text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>This action is <strong>permanent and cannot be undone</strong>. All your data, matches, messages, and photos will be deleted.</p>
                      <p>Type <strong>DELETE</strong> to confirm:</p>
                      <Input
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="Type DELETE"
                        className="mt-2"
                      />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirm !== "DELETE" || deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

        <p className="mb-20 text-center text-xs text-muted-foreground">Tutwine v1.0 · Terms · Privacy</p>
      </div>
    </AppLayout>
  );
}
