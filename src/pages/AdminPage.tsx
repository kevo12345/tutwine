import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Users, Flag, Crown, Shield, Eye, Ban, CheckCircle,
  Loader2, BarChart3, TrendingUp, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface AdminStats {
  totalUsers: number;
  pendingReports: number;
  subscribers: number;
  recentSignups: number;
}

interface AdminUser {
  user_id: string;
  display_name: string | null;
  photos: string[] | null;
  created_at: string;
  verified: boolean | null;
  city: string | null;
  country: string | null;
  tier: string;
  status: string;
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

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--warning))"];

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const callAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body });
    if (error) throw error;
    return data;
  };

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

      // Load all data in parallel
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
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  const handleAction = async (action: string, params: any, successMsg: string) => {
    setActionLoading(params.targetUserId ?? params.reportId ?? action);
    try {
      await callAdmin({ action, ...params });
      toast.success(successMsg);
      // Refresh data
      const [usersData, reportsData, statsData] = await Promise.all([
        callAdmin({ action: "get_users" }),
        callAdmin({ action: "get_reports" }),
        callAdmin({ action: "get_stats" }),
      ]);
      setUsers(usersData);
      setReports(reportsData);
      setStats(statsData);
    } catch (err: any) {
      toast.error(err.message);
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4">
        <Shield className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="font-display text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have admin privileges.</p>
        <Button onClick={() => navigate("/discover")}>Go Back</Button>
      </div>
    );
  }

  // Prepare chart data
  const signupChartData = analytics
    ? Object.entries(analytics.signupsByDay).map(([date, count]) => ({
        date: date.substring(5),
        signups: count,
      }))
    : [];

  const matchChartData = analytics
    ? Object.entries(analytics.matchesByDay).map(([date, count]) => ({
        date: date.substring(5),
        matches: count,
      }))
    : [];

  const tierChartData = analytics
    ? Object.entries(analytics.tierCounts).map(([tier, count]) => ({
        name: tier.charAt(0).toUpperCase() + tier.slice(1),
        value: count,
      }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate("/discover")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage users, reports, and analytics</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Users", value: stats?.totalUsers?.toLocaleString() ?? "—", icon: Users, color: "text-primary" },
            { label: "Pending Reports", value: stats?.pendingReports?.toString() ?? "—", icon: Flag, color: "text-warning" },
            { label: "New (7d)", value: stats?.recentSignups?.toString() ?? "—", icon: TrendingUp, color: "text-info" },
            { label: "Subscribers", value: stats?.subscribers?.toString() ?? "—", icon: Crown, color: "text-accent" },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-display font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="users" className="gap-1"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1"><Flag className="h-3.5 w-3.5" /> Reports</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-0 shadow-card mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.photos?.[0] ?? ""} />
                            <AvatarFallback>{u.display_name?.[0] ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.display_name ?? "No name"}</p>
                            <p className="text-xs text-muted-foreground">{u.city ?? ""}{u.country ? `, ${u.country}` : ""}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{u.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === "active" ? "default" : "destructive"}
                          className={`text-xs ${u.status === "active" ? "bg-success/10 text-success border-0" : ""}`}
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.status === "active" ? (
                            <>
                              <Button
                                variant="ghost" size="sm" className="h-7 text-xs"
                                disabled={actionLoading === u.user_id}
                                onClick={() => handleAction("warn_user", { targetUserId: u.user_id }, "Warning sent")}
                              >
                                <AlertTriangle className="mr-1 h-3 w-3" /> Warn
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                                disabled={actionLoading === u.user_id}
                                onClick={() => handleAction("suspend_user", { targetUserId: u.user_id }, "User suspended")}
                              >
                                <Ban className="mr-1 h-3 w-3" /> Suspend
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost" size="sm" className="h-7 text-xs text-success"
                              disabled={actionLoading === u.user_id}
                              onClick={() => handleAction("unsuspend_user", { targetUserId: u.user_id }, "User unsuspended")}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> Unsuspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="border-0 shadow-card mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No reports</TableCell></TableRow>
                  )}
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.reporter_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={r.target_photo ?? ""} />
                            <AvatarFallback>{r.target_name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{r.target_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "pending" ? "default" : "secondary"}
                          className={`text-xs ${r.status === "pending" ? "bg-warning/10 text-warning border-0" : ""}`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="sm" className="h-7 text-xs"
                              disabled={actionLoading === r.id}
                              onClick={() => handleAction("ban_user", { targetUserId: r.target_user_id, reportId: r.id }, "User banned")}
                            >
                              <Ban className="mr-1 h-3 w-3 text-destructive" /> Ban
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 text-xs"
                              disabled={actionLoading === r.id}
                              onClick={() => handleAction("resolve_report", { reportId: r.id }, "Report resolved")}
                            >
                              <CheckCircle className="mr-1 h-3 w-3 text-success" /> Resolve
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 text-xs"
                              disabled={actionLoading === r.id}
                              onClick={() => handleAction("dismiss_report", { reportId: r.id }, "Report dismissed")}
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              {/* Signups Chart */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Signups (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {signupChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={signupChartData}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-12">No signup data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Matches Chart */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Matches (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {matchChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={matchChartData}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="matches" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-12">No match data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Tiers */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Subscription Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {tierChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={tierChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {tierChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-12">No subscription data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Tier Limits Reference */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Tier Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tier</TableHead>
                        <TableHead>Views/Day</TableHead>
                        <TableHead>Likes/Day</TableHead>
                        <TableHead>Boosts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { tier: "Free", views: "20", likes: "10", boosts: "0" },
                        { tier: "Basic ($3)", views: "100", likes: "50", boosts: "0" },
                        { tier: "Plus ($5)", views: "∞", likes: "200", boosts: "1/week" },
                        { tier: "Pro ($10)", views: "∞", likes: "∞", boosts: "1/day" },
                      ].map((t) => (
                        <TableRow key={t.tier}>
                          <TableCell className="font-medium text-sm">{t.tier}</TableCell>
                          <TableCell className="text-sm">{t.views}</TableCell>
                          <TableCell className="text-sm">{t.likes}</TableCell>
                          <TableCell className="text-sm">{t.boosts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
