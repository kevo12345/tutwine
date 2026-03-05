import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Users, Flag, Image, Settings, Crown, Shield, AlertTriangle, Eye, Ban, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MOCK_PROFILES } from "@/lib/mock-data";
import { toast } from "sonner";

const mockUsers = MOCK_PROFILES.map((p, i) => ({
  ...p,
  email: `${p.displayName.toLowerCase()}@email.com`,
  role: i === 0 ? "admin" : "member",
  tier: i % 3 === 0 ? "pro" : i % 2 === 0 ? "plus" : "free",
  status: i === 4 ? "suspended" : "active",
  joinedAt: "2026-01-15",
}));

const mockReports = [
  { id: "r1", reporter: "Sophia", target: "Marcus", reason: "Inappropriate messages", status: "pending", date: "2026-03-04" },
  { id: "r2", reporter: "Aisha", target: "Jake", reason: "Fake profile", status: "pending", date: "2026-03-03" },
  { id: "r3", reporter: "Luna", target: "Marcus", reason: "Harassment", status: "resolved", date: "2026-03-01" },
];

const mockPhotos = [
  { id: "ph1", user: "Marcus", url: MOCK_PROFILES[1].photos[0], status: "pending", flagReason: "Needs review" },
  { id: "ph2", user: "Luna", url: MOCK_PROFILES[4].photos[0], status: "pending", flagReason: "Auto-flagged" },
];

export default function AdminPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate("/discover")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage users, reports, and content</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Users", value: "1,247", icon: Users, color: "text-primary" },
            { label: "Reports", value: "12", icon: Flag, color: "text-warning" },
            { label: "Photo Queue", value: "8", icon: Image, color: "text-info" },
            { label: "Subscribers", value: "342", icon: Crown, color: "text-accent" },
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
          <TabsList className="w-full justify-start">
            <TabsTrigger value="users" className="gap-1"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1"><Flag className="h-3.5 w-3.5" /> Reports</TabsTrigger>
            <TabsTrigger value="photos" className="gap-1"><Image className="h-3.5 w-3.5" /> Photos</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-3.5 w-3.5" /> Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="border-0 shadow-card mt-4">
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
                  {mockUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.photos[0]} />
                            <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.displayName}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{u.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === "active" ? "default" : "destructive"} className={`text-xs ${u.status === "active" ? "bg-success/10 text-success border-0" : ""}`}>
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.joinedAt}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info("View user details")}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => toast.success("User suspended")}><Ban className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="border-0 shadow-card mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.reporter}</TableCell>
                      <TableCell className="text-sm font-medium">{r.target}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "pending" ? "default" : "secondary"} className={`text-xs ${r.status === "pending" ? "bg-warning/10 text-warning border-0" : ""}`}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success("Warning sent")}>Warn</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => toast.success("User banned")}>Ban</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success("Report dismissed")}>Dismiss</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="photos">
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {mockPhotos.map((ph) => (
                <Card key={ph.id} className="border-0 shadow-card overflow-hidden">
                  <div className="relative aspect-[3/4]">
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    <Badge className="absolute left-2 top-2 bg-warning/90 text-warning-foreground border-0 text-[10px]">
                      <AlertTriangle className="mr-1 h-3 w-3" /> {ph.flagReason}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">{ph.user}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-xs text-success" onClick={() => toast.success("Photo approved")}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-xs text-destructive" onClick={() => toast.success("Photo rejected")}>
                        <Ban className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border-0 shadow-card mt-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
