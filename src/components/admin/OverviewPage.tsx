import { Card, CardContent } from "@/components/ui/card";
import { Users, Flag, TrendingUp, Crown, DollarSign, Activity } from "lucide-react";
import { AdminStats } from "@/hooks/useAdminData";

interface OverviewPageProps {
  stats: AdminStats | null;
}

export default function OverviewPage({ stats }: OverviewPageProps) {
  const statCards = [
    { label: "Total Users", value: stats?.totalUsers?.toLocaleString() ?? "—", icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending Reports", value: stats?.pendingReports?.toString() ?? "—", icon: Flag, color: "text-warning", bg: "bg-warning/10" },
    { label: "New Users (7d)", value: stats?.recentSignups?.toString() ?? "—", icon: TrendingUp, color: "text-info", bg: "bg-info/10" },
    { label: "Active Subscribers", value: stats?.subscribers?.toString() ?? "—", icon: Crown, color: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's what's happening with your platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`h-11 w-11 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Quick Actions</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Review pending reports", count: stats?.pendingReports ?? 0, href: "/admin/reports" },
                { label: "Create new user account", count: null, href: "/admin/create-user" },
                { label: "View payment history", count: null, href: "/admin/payments" },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-sm">{action.label}</span>
                  {action.count !== null && action.count > 0 && (
                    <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
                      {action.count}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Platform Status</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Database", status: "Operational", ok: true },
                { label: "Authentication", status: "Operational", ok: true },
                { label: "Edge Functions", status: "Operational", ok: true },
                { label: "Storage", status: "Operational", ok: true },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-success font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
