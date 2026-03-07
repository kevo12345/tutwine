import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and tier limits.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Settings className="h-4 w-4" />
              Subscription Tier Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Tier</TableHead>
                  <TableHead className="text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-xs font-semibold">Views/Day</TableHead>
                  <TableHead className="text-xs font-semibold">Likes/Day</TableHead>
                  <TableHead className="text-xs font-semibold">Boosts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { tier: "Free", price: "$0", views: "20", likes: "10", boosts: "0" },
                  { tier: "Basic", price: "$3/mo", views: "100", likes: "50", boosts: "0" },
                  { tier: "Plus", price: "$5/mo", views: "∞", likes: "200", boosts: "1/week" },
                  { tier: "Pro", price: "$10/mo", views: "∞", likes: "∞", boosts: "1/day" },
                ].map((t) => (
                  <TableRow key={t.tier}>
                    <TableCell className="font-medium text-sm">{t.tier}</TableCell>
                    <TableCell className="text-sm">{t.price}</TableCell>
                    <TableCell className="text-sm">{t.views}</TableCell>
                    <TableCell className="text-sm">{t.likes}</TableCell>
                    <TableCell className="text-sm">{t.boosts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Platform", value: "TutWine" },
              { label: "Version", value: "1.0.0" },
              { label: "Environment", value: "Production" },
              { label: "Backend", value: "Lovable Cloud" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
