import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MailCheck, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithProvider } from "@/lib/oauth-helper";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
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
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border-0 shadow-card text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">Check your email</CardTitle>
            <CardDescription className="mt-2">
              We've sent a verification link to <strong>{form.email}</strong>. Click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive it? Check your spam folder or try again.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setEmailSent(false)}>
              Back to Sign Up
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute -top-40 left-0 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      <button onClick={() => navigate("/")} className="absolute left-4 top-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-8 flex items-center gap-2">
        <img src="/logo.jpeg" alt="Tutwine" className="h-10 w-10 rounded-xl object-cover" />
        <span className="font-display text-2xl font-bold">Tutwine</span>
      </div>

      <Card className="w-full max-w-sm border-0 shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Create account</CardTitle>
          <CardDescription>Let's Mingle — join Tutwine today</CardDescription>
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or sign up with</span></div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                const { error } = await signInWithProvider("google");
                if (error) toast.error(error.message);
              }}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                const { error } = await signInWithProvider("apple");
                if (error) toast.error(error.message);
              }}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Apple
            </Button>
          </div>

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
