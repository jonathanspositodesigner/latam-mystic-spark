import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import React, { Suspense } from "react";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CreditsProvider } from "./contexts/CreditsContext";
import { AIJobProvider } from "./contexts/AIJobContext";

import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const ProfileSettings = React.lazy(() => import("./pages/ProfileSettings"));

// Admin pages
const AdminLogin = React.lazy(() => import("./pages/AdminLogin"));
const AdminHub = React.lazy(() => import("./pages/AdminHub"));
const AdminUpload = React.lazy(() => import("./pages/AdminUpload"));
const AdminManageImages = React.lazy(() => import("./pages/AdminManageImages"));
const AdminManageArtes = React.lazy(() => import("./pages/AdminManageArtes"));
const AdminCommunityReview = React.lazy(() => import("./pages/AdminCommunityReview"));
const AdminArtesReview = React.lazy(() => import("./pages/AdminArtesReview"));
const AdminManagePremium = React.lazy(() => import("./pages/AdminManagePremium"));
const AdminPremiumDashboard = React.lazy(() => import("./pages/AdminPremiumDashboard"));
const AdminPartners = React.lazy(() => import("./pages/AdminPartners"));
const AdminPartnersArtes = React.lazy(() => import("./pages/AdminPartnersArtes"));
const AdminManageAdmins = React.lazy(() => import("./pages/AdminManageAdmins"));
const AdminWebhookLogs = React.lazy(() => import("./pages/AdminWebhookLogs"));
const AdminPushNotifications = React.lazy(() => import("./pages/AdminPushNotifications"));
const AdminManageBanners = React.lazy(() => import("./pages/AdminManageBanners"));
const AdminManagePacks = React.lazy(() => import("./pages/AdminManagePacks"));
const AdminManagePromotions = React.lazy(() => import("./pages/AdminManagePromotions"));
const AdminManageBlacklist = React.lazy(() => import("./pages/AdminManageBlacklist"));
const AdminInstallStats = React.lazy(() => import("./pages/AdminInstallStats"));
const AdminUploadArtes = React.lazy(() => import("./pages/AdminUploadArtes"));
const AdminCategoriesArtes = React.lazy(() => import("./pages/AdminCategoriesArtes"));
const AdminPackPurchases = React.lazy(() => import("./pages/AdminPackPurchases"));
const AdminAbandonedCheckouts = React.lazy(() => import("./pages/AdminAbandonedCheckouts"));
const AdminLeads = React.lazy(() => import("./pages/AdminLeads"));
const AdminUpscalerVitalicio = React.lazy(() => import("./pages/AdminUpscalerVitalicio"));

// Platform-specific admin pages
const ArtesEventosDashboard = React.lazy(() => import("./pages/admin/ArtesEventosDashboard"));
const ArtesEventosFerramentas = React.lazy(() => import("./pages/admin/ArtesEventosFerramentas"));
const ArtesEventosMarketing = React.lazy(() => import("./pages/admin/ArtesEventosMarketing"));
const PromptsDashboard = React.lazy(() => import("./pages/admin/PromptsDashboard"));
const PromptsFerramentas = React.lazy(() => import("./pages/admin/PromptsFerramentas"));
const PromptsMarketing = React.lazy(() => import("./pages/admin/PromptsMarketing"));
const PromptsCustosIA = React.lazy(() => import("./pages/admin/PromptsCustosIA"));
const PromptsMotoresIA = React.lazy(() => import("./pages/admin/PromptsMotoresIA"));
const PromptsRentabilidade = React.lazy(() => import("./pages/admin/PromptsRentabilidade"));
const PromptsTopIndicadores = React.lazy(() => import("./pages/admin/PromptsTopIndicadores"));

// Upscaler pages
const UpscalerArcanoVersionSelect = React.lazy(() => import("./pages/UpscalerArcanoVersionSelect"));
const ToolVersionLessons = React.lazy(() => import("./pages/ToolVersionLessons"));
const UpgradeUpscalerV3 = React.lazy(() => import("./pages/UpgradeUpscalerV3"));
const UpscalerArcanoTool = React.lazy(() => import("./pages/UpscalerArcanoTool"));
const PlanesCreditos = React.lazy(() => import("./pages/PlanesCreditos"));
const CreditosUpscaler = React.lazy(() => import("./pages/CreditosUpscaler"));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-[hsl(270,60%,4%)] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-500"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/olvide-contrasena" element={<ForgotPassword />} />
          <Route path="/restablecer-contrasena" element={<ResetPassword />} />
          <Route path="/configuracion" element={<ProfileSettings />} />

          {/* Admin routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-hub" element={<AdminHub />} />
          <Route path="/admin-dashboard" element={<Navigate to="/admin-hub" replace />} />
          <Route path="/admin-upload" element={<AdminUpload />} />
          <Route path="/admin-manage-images" element={<AdminManageImages />} />
          <Route path="/admin-manage-artes" element={<AdminManageArtes />} />
          <Route path="/admin-community-review" element={<AdminCommunityReview />} />
          <Route path="/admin-artes-review" element={<AdminArtesReview />} />
          <Route path="/admin-manage-premium" element={<AdminManagePremium />} />
          <Route path="/admin-premium-dashboard" element={<AdminPremiumDashboard />} />
          <Route path="/admin-partners" element={<AdminPartners />} />
          <Route path="/admin-parceiros-artes" element={<AdminPartnersArtes />} />
          <Route path="/admin-manage-admins" element={<AdminManageAdmins />} />
          <Route path="/admin-webhook-logs" element={<AdminWebhookLogs />} />
          <Route path="/admin-push-notifications" element={<AdminPushNotifications />} />
          <Route path="/admin-manage-banners" element={<AdminManageBanners />} />
          <Route path="/admin-manage-packs" element={<AdminManagePacks />} />
          <Route path="/admin-manage-promotions" element={<AdminManagePromotions />} />
          <Route path="/admin-blacklist" element={<AdminManageBlacklist />} />
          <Route path="/admin-install-stats" element={<AdminInstallStats />} />
          <Route path="/admin-upload-artes" element={<AdminUploadArtes />} />
          <Route path="/admin-categories-artes" element={<AdminCategoriesArtes />} />
          <Route path="/admin-pack-purchases" element={<AdminPackPurchases />} />
          <Route path="/admin-abandoned-checkouts" element={<AdminAbandonedCheckouts />} />
          <Route path="/admin-leads" element={<AdminLeads />} />
          <Route path="/admin-upscaler-vitalicio" element={<AdminUpscalerVitalicio />} />
          <Route path="/admin-artes-eventos" element={<ArtesEventosFerramentas />} />
          <Route path="/admin-artes-eventos/ferramentas" element={<Navigate to="/admin-artes-eventos" replace />} />
          <Route path="/admin-artes-eventos/dashboard" element={<ArtesEventosDashboard />} />
          <Route path="/admin-artes-eventos/marketing" element={<ArtesEventosMarketing />} />


          <Route path="/admin-prompts" element={<PromptsFerramentas />} />
          <Route path="/admin-prompts/ferramentas" element={<Navigate to="/admin-prompts" replace />} />
          <Route path="/admin-prompts/dashboard" element={<PromptsDashboard />} />
          <Route path="/admin-prompts/marketing" element={<PromptsMarketing />} />
          <Route path="/admin-prompts/custos-ia" element={<PromptsCustosIA />} />
          <Route path="/admin-prompts/motores-ia" element={<PromptsMotoresIA />} />
          <Route path="/admin-prompts/rentabilidade" element={<PromptsRentabilidade />} />
          <Route path="/admin-prompts/top-indicadores" element={<PromptsTopIndicadores />} />

          {/* Upscaler routes */}
          <Route path="/upscaler-arcano" element={<UpscalerArcanoVersionSelect />} />
          <Route path="/ferramenta-ia-artes/upscaller-arcano" element={<Navigate to="/upscaler-arcano" replace />} />
          <Route path="/ferramenta-ia-artes/:toolSlug/:versionSlug" element={<ToolVersionLessons />} />
          <Route path="/upgrade-upscaler-v3" element={<UpgradeUpscalerV3 />} />
          <Route path="/upscaler-arcano-tool" element={<UpscalerArcanoTool />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
};

const CreditsWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return <CreditsProvider userId={user?.id}>{children}</CreditsProvider>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CreditsWrapper>
        <AIJobProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AIJobProvider>
      </CreditsWrapper>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
