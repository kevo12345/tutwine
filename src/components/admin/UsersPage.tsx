import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, Ban, CheckCircle } from "lucide-react";
import { AdminUser } from "@/hooks/useAdminData";

interface UsersPageProps {
  users: AdminUser[];
  actionLoading: string | null;
  handleAction: (action: string, params: any, msg: string) => Promise<void>;
}

export default function UsersPage({ users, actionLoading, handleAction }: UsersPageProps) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} registered users</p>
        </div>
        <Button onClick={() => window.location.href = "/admin/create-user"} size="sm">
          + Create Account
        </Button>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Subscription</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Joined</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">No users found</TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.user_id} className="hover:bg-muted/20 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={u.photos?.[0] ?? ""} />
                        <AvatarFallback className="text-xs bg-primary/5">{u.display_name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.display_name ?? "No name"}</p>
                        <p className="text-[11px] text-muted-foreground">{u.city ?? ""}{u.country ? `, ${u.country}` : ""}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] capitalize font-normal">{u.tier}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.status === "active" ? "default" : "destructive"}
                      className={`text-[11px] font-normal ${u.status === "active" ? "bg-success/10 text-success border-success/20 hover:bg-success/20" : ""}`}
                    >
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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
                            variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                            disabled={actionLoading === u.user_id}
                            onClick={() => handleAction("suspend_user", { targetUserId: u.user_id }, "User suspended")}
                          >
                            <Ban className="mr-1 h-3 w-3" /> Suspend
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-success hover:text-success"
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
        </div>
      </Card>
    </div>
  );
}
