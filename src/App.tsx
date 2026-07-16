import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TikTokPixel } from "@/components/TikTokPixel";
import { MetaPixel } from "@/components/MetaPixel";
import { Loader2 } from "lucide-react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdLandingPage = lazy(() => import("./pages/AdLandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const ChatListPage = lazy(() => import("./pages/ChatListPage"));
const ChatThreadPage = lazy(() => import("./pages/ChatThreadPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const LikesPage = lazy(() => import("./pages/LikesPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const LivePage = lazy(() => import("./pages/LivePage"));
const GoLiveSetupPage = lazy(() => import("./pages/GoLiveSetupPage"));
const LiveRoomPage = lazy(() => import("./pages/LiveRoomPage"));
const BuyTokensPage = lazy(() => import("./pages/BuyTokensPage"));
const LivesPage = lazy(() => import("./pages/LivesPage"));
const LiveViewPage = lazy(() => import("./pages/LiveViewPage"));
const HostEarningsPage = lazy(() => import("./pages/HostEarningsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TikTokPixel />
        <MetaPixel />
        <ScrollToTop />
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/welcome/:audience" element={<AdLandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
              <Route path="/likes" element={<ProtectedRoute><LikesPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatListPage /></ProtectedRoute>} />
              <Route path="/chat/:matchId" element={<ProtectedRoute><ChatThreadPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/live" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
              <Route path="/live/start" element={<ProtectedRoute><GoLiveSetupPage /></ProtectedRoute>} />
              <Route path="/live/:sessionId" element={<ProtectedRoute><LiveRoomPage /></ProtectedRoute>} />
              <Route path="/buy-tokens" element={<ProtectedRoute><BuyTokensPage /></ProtectedRoute>} />
              <Route path="/lives" element={<ProtectedRoute><LivesPage /></ProtectedRoute>} />
              <Route path="/lives/:shareLink" element={<LiveViewPage />} />
              <Route path="/host/earnings" element={<ProtectedRoute><HostEarningsPage /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/install" element={<InstallPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
