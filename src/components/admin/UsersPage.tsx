import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, Ban, CheckCircle, Trash2, Filter } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminUser } from "@/hooks/useAdminData";

interface UsersPageProps {
  users: AdminUser[];
  actionLoading: string | null;
  handleAction: (action: string, params: any, msg: string) => Promise<void>;
}

type OnboardingFilter = "all" | "complete" | "incomplete";

export default function UsersPage({ users, actionLoading, handleAction }: UsersPageProps) {
  const [onboardingFilter, setOnboardingFilter] = useState<OnboardingFilter>("all");

  const filteredUsers = users.filter((u) => {
    if (onboardingFilter === "complete") return u.onboarding_complete === true;
    if (onboardingFilter === "incomplete") return !u.onboarding_complete;
    return true;
  });

  const incompleteCount = users.filter((u) => !u.onboarding_complete).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} registered users
            {incompleteCount > 0 && (
              <span className="text-warning"> · {incompleteCount} incomplete onboarding</span>
            )}
          </p>
        </div>
        <Button onClick={() => window.location.href = "/admin/create-user"} size="sm">
          + Create Account
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "complete", "incomplete"] as OnboardingFilter[]).map((f) => (
          <Button
            key={f}
            variant={onboardingFilter === f ? "default" : "outline"}
            size="sm"
            className="text-xs capitalize"
            onClick={() => setOnboardingFilter(f)}
          >
            {f === "incomplete" && <Filter className="mr-1 h-3 w-3" />}
            {f === "all" ? "All Users" : f === "complete" ? "Onboarded" : "Incomplete Onboarding"}
          </Button>
        ))}
      </div>

      <Card className="border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Onboarding</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Subscription</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Joined</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No users found</TableCell>
                </TableRow>
              )}
              {filteredUsers.map((u) => (
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
                    <Badge
                      variant={u.onboarding_complete ? "default" : "secondary"}
                      className={`text-[11px] font-normal ${
                        u.onboarding_complete
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }`}
                    >
                      {u.onboarding_complete ? "Complete" : `Step ${(u.onboarding_step ?? 0) + 1}/${4}`}
                    </Badge>
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                            disabled={actionLoading === u.user_id}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{u.display_name ?? "this user"}</strong> and all their data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleAction("delete_user", { targetUserId: u.user_id }, "User deleted permanently")}
                            >
                              Delete Forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
