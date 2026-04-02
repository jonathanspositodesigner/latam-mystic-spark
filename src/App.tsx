import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import React, { Suspense } from "react";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CreditsProvider } from "./contexts/CreditsContext";

import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const ProfileSettings = React.lazy(() => import("./pages/ProfileSettings"));

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
          <Route path="/olvide-contrasena" element={<ForgotPassword />} />
          <Route path="/restablecer-contrasena" element={<ResetPassword />} />
          <Route path="/configuracion" element={<ProfileSettings />} />
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
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </CreditsWrapper>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
