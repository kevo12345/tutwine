import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, Ban, CheckCircle, Trash2, Filter, Search, Copy, Download, MailCheck, MailWarning } from "lucide-react";
import { toast } from "sonner";
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
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (onboardingFilter === "complete" && u.onboarding_complete !== true) return false;
      if (onboardingFilter === "incomplete" && u.onboarding_complete) return false;
      if (!q) return true;
      return [u.display_name, u.email, u.emrand_id, u.city, u.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [users, onboardingFilter, query]);

  const incompleteCount = users.filter((u) => !u.onboarding_complete).length;

  const copyEmails = async () => {
    const emails = filteredUsers.map((u) => u.email).filter(Boolean).join(", ");
    if (!emails) return toast.error("No emails to copy");
    await navigator.clipboard.writeText(emails);
    toast.success(`Copied ${filteredUsers.filter((u) => u.email).length} emails`);
  };

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "EMRAND", "Tier", "Status", "Onboarding", "Joined"],
      ...filteredUsers.map((u) => [
        u.display_name ?? "",
        u.email ?? "",
        u.emrand_id ?? "",
        u.tier,
        u.status,
        u.onboarding_complete ? "complete" : "incomplete",
        new Date(u.created_at).toISOString().substring(0, 10),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tutwine-users-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registered Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} accounts · showing {filteredUsers.length}
            {incompleteCount > 0 && (
              <span className="text-warning"> · {incompleteCount} incomplete onboarding</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={copyEmails}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy emails
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button onClick={() => (window.location.href = "/admin/create-user")} size="sm">
            + Create Account
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, EMRAND, city…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
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
      </div>

      <Card className="overflow-hidden border border-border shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
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
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No users found</TableCell>
                </TableRow>
              )}
              {filteredUsers.map((u) => (
                <TableRow key={u.user_id} className="transition-colors hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={u.photos?.[0] ?? ""} />
                        <AvatarFallback className="bg-primary/5 text-xs">{u.display_name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.display_name ?? "No name"}</p>
                        <div className="flex items-center gap-2">
                          {u.emrand_id && (
                            <code className="text-[10px] font-semibold text-primary/80">#{u.emrand_id}</code>
                          )}
                          <p className="text-[11px] text-muted-foreground">{u.city ?? ""}{u.country ? `, ${u.country}` : ""}</p>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {u.email ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(u.email!);
                          toast.success("Email copied");
                        }}
                        className="group flex items-center gap-1.5 text-left"
                      >
                        {u.email_confirmed_at ? (
                          <MailCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                        ) : (
                          <MailWarning className="h-3.5 w-3.5 shrink-0 text-warning" />
                        )}
                        <span className="text-xs group-hover:underline">{u.email}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>

                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={u.photos?.[0] ?? ""} />
                        <AvatarFallback className="text-xs bg-primary/5">{u.display_name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.display_name ?? "No name"}</p>
                        <div className="flex items-center gap-2">
                          {(u as any).emrand_id && (
                            <code className="text-[10px] font-semibold text-primary/80">
                              #{(u as any).emrand_id}
                            </code>
                          )}
                          <p className="text-[11px] text-muted-foreground">{u.city ?? ""}{u.country ? `, ${u.country}` : ""}</p>
                        </div>
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
