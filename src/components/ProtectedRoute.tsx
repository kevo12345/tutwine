import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, suspended, signOut } = useAuth();
  const location = useLocation();

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  if (loading || isAdminLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        {/* Content skeleton */}
        <div className="flex-1 flex flex-col items-center gap-4 p-6 pt-10">
          <Skeleton className="h-[320px] w-full max-w-sm rounded-2xl" />
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
        </div>
        {/* Bottom nav skeleton */}
        <div className="flex items-center justify-around border-t border-border px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded" />
          ))}
        </div>
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

  // Skip onboarding redirect for admin users
  if (profile && !profile.onboarding_complete && !isAdmin && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
