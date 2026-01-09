import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Get base path for GitHub Pages
const getBasePath = () => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/MotionBus_AI')) {
      return '/MotionBus_AI';
    }
  }
  return import.meta.env.BASE_URL || '/';
};

import { useStopNotifications } from "@/hooks/useStopNotifications";
import { useEffect } from "react";

const Cleanup = () => {
  const { clearAllNotifications } = useStopNotifications();
  useEffect(() => {
    console.log("Running one-time cleanup...");
    clearAllNotifications();
  }, [clearAllNotifications]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Cleanup />
      <BrowserRouter basename={getBasePath()}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/install" element={<Install />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
