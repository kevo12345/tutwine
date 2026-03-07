import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Analytics } from "@/hooks/useAdminData";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--warning))"];

interface AnalyticsPageProps {
  analytics: Analytics | null;
}

export default function AnalyticsPage({ analytics }: AnalyticsPageProps) {
  const signupChartData = analytics
    ? Object.entries(analytics.signupsByDay).map(([date, count]) => ({ date: date.substring(5), signups: count }))
    : [];

  const matchChartData = analytics
    ? Object.entries(analytics.matchesByDay).map(([date, count]) => ({ date: date.substring(5), matches: count }))
    : [];

  const tierChartData = analytics
    ? Object.entries(analytics.tierCounts).map(([tier, count]) => ({
        name: tier.charAt(0).toUpperCase() + tier.slice(1), value: count,
      }))
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform performance and growth metrics.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signups — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {signupChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={signupChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-16">No signup data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Matches — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {matchChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={matchChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="matches" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-16">No match data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {tierChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
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
              <p className="text-center text-sm text-muted-foreground py-16">No subscription data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tier Limits Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Tier</TableHead>
                  <TableHead className="text-xs font-semibold">Views/Day</TableHead>
                  <TableHead className="text-xs font-semibold">Likes/Day</TableHead>
                  <TableHead className="text-xs font-semibold">Boosts</TableHead>
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
    </div>
  );
}
