import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AdminStats {
  totalUsers: number;
  pendingReports: number;
  subscribers: number;
  recentSignups: number;
  onlineNow?: number;
  liveNow?: number;
  totalMatches?: number;
  ticketsSold?: number;
  giftsSent?: number;
  giftTokens?: number;
  tokensSold?: number;
  platformEarnings?: number;
  hostEarnings?: number;
  availableEarnings?: number;
  lifetimeEarnings?: number;
  coinsInCirculation?: number;
  pendingWithdrawalCount?: number;
  pendingWithdrawalTokens?: number;
  paidWithdrawalTokens?: number;
  tierCounts?: Record<string, number>;
  series?: { date: string; signups: number; revenue: number }[];
}

interface AdminUser {
  user_id: string;
  display_name: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  emrand_id?: string | null;
  photos: string[] | null;
  created_at: string;
  verified: boolean | null;
  city: string | null;
  country: string | null;
  tier: string;
  status: string;
  onboarding_complete: boolean | null;
  onboarding_step: number | null;
}


interface AdminReport {
  id: string;
  reporter_id: string;
  target_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter_name: string;
  target_name: string;
  target_photo: string | null;
}

interface Analytics {
  signupsByDay: Record<string, number>;
  tierCounts: Record<string, number>;
  matchesByDay: Record<string, number>;
}

export function useAdminData() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const callAdmin = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body });
    if (error) throw error;
    return data;
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [statsData, usersData, reportsData, analyticsData] = await Promise.all([
        callAdmin({ action: "get_stats" }),
        callAdmin({ action: "get_users" }),
        callAdmin({ action: "get_reports" }),
        callAdmin({ action: "get_analytics" }),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setReports(reportsData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      toast.error("Failed to load admin data: " + err.message);
    }
  }, [callAdmin]);

  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      if (!data) { setLoading(false); return; }
      await refreshData();
      setLoading(false);
    };
    checkAdmin();
  }, [user, refreshData]);

  const handleAction = useCallback(async (action: string, params: any, successMsg: string) => {
    setActionLoading(params.targetUserId ?? params.reportId ?? action);
    try {
      await callAdmin({ action, ...params });
      toast.success(successMsg);
      await refreshData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setActionLoading(null);
  }, [callAdmin, refreshData]);

  return {
    isAdmin, stats, users, reports, analytics,
    loading, actionLoading, handleAction, callAdmin, refreshData,
  };
}

export type { AdminStats, AdminUser, AdminReport, Analytics };
