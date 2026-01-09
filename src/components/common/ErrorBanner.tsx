import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mx-4 mt-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">Σφάλμα σύνδεσης</p>
          <p className="text-xs text-muted-foreground mt-1">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="flex-shrink-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            Επανάληψη
          </Button>
        )}
      </div>
    </div>
  );
}