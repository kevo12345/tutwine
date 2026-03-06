import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", displayName: "" });

  // Redirect if already logged in
  if (user) { navigate("/discover", { replace: true }); return null; }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ageConfirmed) { toast.error("You must confirm you are 18+ to join."); return; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords don't match."); return; }
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters."); return; }

    setLoading(true);
    const { error } = await signUp(form.email, form.password, form.displayName);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Let's set up your profile.");
    navigate("/onboarding");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute -top-40 left-0 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      <button onClick={() => navigate("/")} className="absolute left-4 top-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-8 flex items-center gap-2">
        <div className="gradient-warm rounded-xl p-2">
          <Heart className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
        </div>
        <span className="font-display text-2xl font-bold">PulseMatch</span>
      </div>

      <Card className="w-full max-w-sm border-0 shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Create account</CardTitle>
          <CardDescription>Join PulseMatch and find real connections</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" placeholder="How others will see you" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-secondary p-3">
              <Checkbox id="age" checked={ageConfirmed} onCheckedChange={(v) => setAgeConfirmed(v === true)} className="mt-0.5" />
              <Label htmlFor="age" className="text-sm font-normal leading-snug">
                I confirm that I am <strong>18 years or older</strong> and agree to the Terms of Service and Privacy Policy.
              </Label>
            </div>
            <Button type="submit" className="w-full gradient-warm border-0 text-primary-foreground shadow-glow" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} className="text-primary font-medium hover:underline">
              Log in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
