import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Ban, CheckCircle } from "lucide-react";
import { AdminReport } from "@/hooks/useAdminData";

interface ReportsPageProps {
  reports: AdminReport[];
  actionLoading: string | null;
  handleAction: (action: string, params: any, msg: string) => Promise<void>;
}

export default function ReportsPage({ reports, actionLoading, handleAction }: ReportsPageProps) {
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pendingCount > 0 ? `${pendingCount} pending report${pendingCount > 1 ? "s" : ""} require attention` : "No pending reports"}
        </p>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Reporter</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Reported User</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Reason</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No reports</TableCell>
                </TableRow>
              )}
              {reports.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-sm">{r.reporter_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarImage src={r.target_photo ?? ""} />
                        <AvatarFallback className="text-[10px]">{r.target_name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{r.target_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-normal ${
                        r.status === "pending" ? "bg-warning/10 text-warning border-warning/20" :
                        r.status === "resolved" ? "bg-success/10 text-success border-success/20" :
                        ""
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                          disabled={actionLoading === r.id}
                          onClick={() => handleAction("ban_user", { targetUserId: r.target_user_id, reportId: r.id }, "User banned")}
                        >
                          <Ban className="mr-1 h-3 w-3" /> Ban
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-success hover:text-success"
                          disabled={actionLoading === r.id}
                          onClick={() => handleAction("resolve_report", { reportId: r.id }, "Report resolved")}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" /> Resolve
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
        </div>
      </Card>
    </div>
  );
}
