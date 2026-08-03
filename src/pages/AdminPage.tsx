import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Routes, Route } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import OverviewPage from "@/components/admin/OverviewPage";
import UsersPage from "@/components/admin/UsersPage";
import CreateUserPage from "@/components/admin/CreateUserPage";
import ReportsPage from "@/components/admin/ReportsPage";
import AnalyticsPage from "@/components/admin/AnalyticsPage";
import PaymentsPage from "@/components/admin/PaymentsPage";
import NowPaymentsIpnPage from "@/components/admin/NowPaymentsIpnPage";
import SupportInboxPage from "@/components/admin/SupportInboxPage";
import AdminSettingsPage from "@/components/admin/AdminSettingsPage";
import GiftCatalogPage from "@/components/admin/GiftCatalogPage";
import WithdrawalsPage from "@/components/admin/WithdrawalsPage";
import LiveMonitorPage from "@/components/admin/LiveMonitorPage";

import { useAdminData } from "@/hooks/useAdminData";

export default function AdminPage() {
  const navigate = useNavigate();
  const {
    isAdmin, stats, users, reports, analytics,
    loading, actionLoading, handleAction, callAdmin, refreshData,
  } = useAdminData();

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
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have admin privileges.</p>
        <Button onClick={() => navigate("/discover")}>Go Back</Button>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Routes>
        <Route index element={<OverviewPage stats={stats} />} />
        <Route path="users" element={<UsersPage users={users} actionLoading={actionLoading} handleAction={handleAction} />} />
        <Route path="create-user" element={<CreateUserPage callAdmin={callAdmin} refreshData={refreshData} />} />
        <Route path="reports" element={<ReportsPage reports={reports} actionLoading={actionLoading} handleAction={handleAction} />} />
        <Route path="analytics" element={<AnalyticsPage analytics={analytics} />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="nowpayments" element={<NowPaymentsIpnPage />} />
        <Route path="support" element={<SupportInboxPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="gift-catalog" element={<GiftCatalogPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="live-monitor" element={<LiveMonitorPage />} />

      </Routes>
    </AdminLayout>
  );
}
