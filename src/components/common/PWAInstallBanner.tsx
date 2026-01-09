import { useState, useEffect } from "react";
import { X, Download, Smartphone, Bell, Zap, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem("pwa_banner_dismissed");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return; // Don't show for 24 hours after dismissal
      }
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after a delay
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("pwa_banner_dismissed", Date.now().toString());
  };

  if (isInstalled || !isVisible) return null;

  // iOS-specific banner
  if (isIOS) {
    return (
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-30 p-3 sm:p-4 safe-area-bottom",
        "animate-in slide-in-from-bottom duration-500"
      )}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg">Εγκατάστησε το Motion Bus</h3>
              <p className="text-sm text-muted-foreground">
                Πρόσθεσέ το στην αρχική οθόνη για καλύτερη εμπειρία
              </p>
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0 -mt-1 -mr-1" onClick={handleDismiss}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Benefits */}
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" />
              <span>Ειδοποιήσεις για αφίξεις</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Γρήγορη πρόσβαση</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span>Λειτουργία offline</span>
            </div>
          </div>

          {/* iOS Instructions */}
          {showIOSInstructions ? (
            <div className="p-4 pt-0 space-y-3">
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <p className="font-medium text-sm">1. Πάτα το κουμπί <span className="inline-flex items-center px-2 py-0.5 bg-background rounded text-primary">Share ↗</span></p>
                <p className="font-medium text-sm">2. Επίλεξε <span className="inline-flex items-center px-2 py-0.5 bg-background rounded text-primary">Add to Home Screen</span></p>
              </div>
            </div>
          ) : (
            <div className="p-4 pt-0">
              <Button className="w-full gap-2" onClick={() => setShowIOSInstructions(true)}>
                <Download className="h-4 w-4" />
                Πώς να εγκαταστήσω
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Android/Desktop banner
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-30 p-3 sm:p-4 safe-area-bottom",
      "animate-in slide-in-from-bottom duration-500"
    )}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">Εγκατάστησε το Motion Bus</h3>
            <p className="text-sm text-muted-foreground">
              Γρήγορη πρόσβαση, ειδοποιήσεις & offline λειτουργία
            </p>
          </div>
          <Button variant="ghost" size="icon" className="flex-shrink-0 -mt-1 -mr-1" onClick={handleDismiss}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 pt-2 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            Όχι τώρα
          </Button>
          <Button className="flex-1 gap-2" onClick={handleInstall}>
            <Download className="h-4 w-4" />
            Εγκατάσταση
          </Button>
        </div>
      </div>
    </div>
  );
}
