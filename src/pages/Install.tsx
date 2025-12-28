import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  Smartphone, 
  Share, 
  MoreVertical, 
  Plus, 
  CheckCircle2, 
  ArrowLeft,
  Apple,
  Chrome
} from "lucide-react";
import motionLogo from "@/assets/motion-logo.svg";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <img src={motionLogo} alt="Motion Logo" className="h-6" />
            <h1 className="text-lg font-bold">Εγκατάσταση</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Hero */}
        <div className="text-center space-y-4 py-6">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Εγκατάσταση Motion Bus</h2>
          <p className="text-muted-foreground">
            Εγκατάστησε την εφαρμογή στο κινητό σου για γρήγορη πρόσβαση και offline λειτουργία.
          </p>
        </div>

        {/* Already installed */}
        {isInstalled && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <div>
                  <p className="font-semibold text-success">Η εφαρμογή είναι εγκατεστημένη!</p>
                  <p className="text-sm text-muted-foreground">
                    Μπορείς να την ανοίξεις από την αρχική οθόνη.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Install button for supported browsers */}
        {deferredPrompt && !isInstalled && (
          <Card className="border-primary/50">
            <CardContent className="pt-6">
              <Button 
                onClick={handleInstallClick} 
                className="w-full h-14 text-lg gap-3"
                size="lg"
              >
                <Download className="h-6 w-6" />
                Εγκατάσταση τώρα
              </Button>
            </CardContent>
          </Card>
        )}

        {/* iOS Instructions */}
        {isIOS && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                Οδηγίες για iPhone/iPad
              </CardTitle>
              <CardDescription>
                Ακολούθησε αυτά τα βήματα στο Safari
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Πάτα το κουμπί Share</p>
                  <p className="text-sm text-muted-foreground">
                    Βρίσκεται στη γραμμή εργαλείων του Safari
                  </p>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg inline-flex items-center gap-2">
                    <Share className="h-5 w-5 text-primary" />
                    <span className="text-sm">Share</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Επίλεξε "Add to Home Screen"</p>
                  <p className="text-sm text-muted-foreground">
                    Κάνε scroll αν χρειάζεται για να το βρεις
                  </p>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg inline-flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    <span className="text-sm">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Πάτα "Add" για επιβεβαίωση</p>
                  <p className="text-sm text-muted-foreground">
                    Η εφαρμογή θα εμφανιστεί στην αρχική οθόνη
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Android Instructions */}
        {isAndroid && !deferredPrompt && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5" />
                Οδηγίες για Android
              </CardTitle>
              <CardDescription>
                Ακολούθησε αυτά τα βήματα στο Chrome
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Πάτα το μενού</p>
                  <p className="text-sm text-muted-foreground">
                    Τρεις τελείες πάνω δεξιά
                  </p>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg inline-flex items-center gap-2">
                    <MoreVertical className="h-5 w-5 text-primary" />
                    <span className="text-sm">Menu</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Επίλεξε "Install app" ή "Add to Home screen"</p>
                  <p className="text-sm text-muted-foreground">
                    Μπορεί να εμφανίζεται με διαφορετικό όνομα
                  </p>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg inline-flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    <span className="text-sm">Install app</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Επιβεβαίωσε την εγκατάσταση</p>
                  <p className="text-sm text-muted-foreground">
                    Η εφαρμογή θα εμφανιστεί στην αρχική οθόνη
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Πλεονεκτήματα</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <span>Γρήγορη πρόσβαση από την αρχική οθόνη</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <span>Λειτουργία χωρίς address bar</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <span>Ειδοποιήσεις για αφίξεις λεωφορείων</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <span>Αποθήκευση αγαπημένων διαδρομών</span>
            </div>
          </CardContent>
        </Card>

        {/* Back to app */}
        <div className="text-center pt-4">
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Πίσω στην εφαρμογή
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
