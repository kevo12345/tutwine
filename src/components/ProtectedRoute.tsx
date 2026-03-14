import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, suspended, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (suspended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <ShieldX className="h-16 w-16 text-destructive/60" />
        <h1 className="text-2xl font-semibold">Account Suspended</h1>
        <p className="text-muted-foreground max-w-sm">
          Your account has been suspended due to a violation of our community guidelines. 
          If you believe this is a mistake, please contact support.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          Sign Out
        </Button>
      </div>
    );
  }

  // Redirect to onboarding if profile is not complete (except when already on onboarding)
  if (profile && !profile.onboarding_complete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
