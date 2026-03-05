import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heart, ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast.success("Check your email for a reset link!");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <button onClick={() => navigate("/login")} className="absolute left-4 top-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
          <CardTitle className="font-display text-2xl">Reset password</CardTitle>
          <CardDescription>We'll send you a link to reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Mail className="h-8 w-8 text-success" />
              </div>
              <p className="text-sm text-muted-foreground">Check your email at <strong>{email}</strong> for a reset link.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>Back to Login</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full gradient-warm border-0 text-primary-foreground shadow-glow">
                Send Reset Link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
