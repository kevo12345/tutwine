import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Bell, Shield, CreditCard, LogOut, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const settingSections = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Edit Profile", action: "navigate", path: "/profile/edit" },
      { icon: CreditCard, label: "Subscription", action: "navigate", path: "/pricing" },
    ],
  },
  {
    title: "Privacy",
    items: [
      { icon: Shield, label: "Hide my distance", action: "toggle", key: "hideDistance" },
      { icon: Shield, label: "Hide my state", action: "toggle", key: "hideState" },
    ],
  },
  {
    title: "Notifications",
    items: [
      { icon: Bell, label: "New matches", action: "toggle", key: "notifyMatches" },
      { icon: Bell, label: "New messages", action: "toggle", key: "notifyMessages" },
      { icon: Bell, label: "Likes received", action: "toggle", key: "notifyLikes" },
    ],
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
        </div>

        {settingSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">{section.title}</h2>
            <Card className="border-0 shadow-card overflow-hidden">
              {section.items.map((item, i) => (
                <CardContent key={i} className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {item.action === "toggle" ? (
                    <Switch defaultChecked={item.key === "notifyMatches" || item.key === "notifyMessages"} />
                  ) : (
                    <button onClick={() => navigate(item.path!)} className="text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </CardContent>
              ))}
            </Card>
          </div>
        ))}

        {/* Danger zone */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Account Actions</h2>
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="p-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={() => { toast.success("Logged out"); navigate("/"); }}>
                <LogOut className="h-4 w-4" /> Log Out
              </Button>
            </CardContent>
            <CardContent className="border-t border-border p-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-sm text-destructive hover:text-destructive" onClick={() => toast.error("Account deletion requires confirmation via email.")}>
                <Trash2 className="h-4 w-4" /> Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mb-20 text-center text-xs text-muted-foreground">PulseMatch v1.0 · Terms · Privacy</p>
      </div>
    </AppLayout>
  );
}
