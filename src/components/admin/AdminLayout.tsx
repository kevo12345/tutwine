import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Flag, BarChart3, CreditCard, UserPlus,
  Settings, LogOut, ChevronLeft, Bell, Search, MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Create Account", url: "/admin/create-user", icon: UserPlus },
  { title: "Reports", url: "/admin/reports", icon: Flag },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Support", url: "/admin/support", icon: MessageCircle },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        {!collapsed && (
          <>
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">T</span>
            </div>
            <div>
              <p className="text-sm font-semibold">TutWine</p>
              <p className="text-[10px] text-muted-foreground">Admin Console</p>
            </div>
          </>
        )}
        {collapsed && (
          <div className="mx-auto h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">T</span>
          </div>
        )}
      </div>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={`transition-colors ${
                      isActive(item.url)
                        ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto border-t border-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/discover")}
              tooltip="Back to App"
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Back to App</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}

function AdminTopbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users, reports..."
            className="h-8 w-64 pl-8 text-sm bg-muted/50 border-0"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile?.photos?.[0] ?? ""} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {profile?.display_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "A"}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-xs font-medium leading-tight">{profile?.display_name ?? "Admin"}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => { signOut(); navigate("/"); }}
        >
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}

function AdminFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>© {new Date().getFullYear()} TutWine. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <span>Admin Console v1.0</span>
          <Separator orientation="vertical" className="h-3" />
          <a href="/support" className="hover:text-foreground transition-colors">Support</a>
          <Separator orientation="vertical" className="h-3" />
          <span className="text-success flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
            System Online
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <AdminTopbar />
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
          <AdminFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}
