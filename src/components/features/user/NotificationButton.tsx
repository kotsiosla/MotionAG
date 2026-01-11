
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePushSubscription } from '@/hooks/usePushSubscription';

export function NotificationButton() {
  const { isSubscribed, isSupported, isLoading, subscribe, unsubscribe, iosStatus } = usePushSubscription();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe([]);
    }
  };

  // Render iOS-specific warning message
  const getIOSWarning = () => {
    if (iosStatus === 'needs-update') {
      return (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive font-medium">
            ⚠️ Απαιτείται iOS 16.4+
          </p>
          <p className="text-[10px] text-destructive/80 mt-1">
            Παρακαλώ ενημερώστε το iPhone σας για να υποστηρίζει ειδοποιήσεις push.
          </p>
        </div>
      );
    }
    if (iosStatus === 'needs-install') {
      return (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 animate-pulse-subtle">
          <p className="text-xs text-primary font-semibold flex items-center gap-2">
            📱 Εγκατάσταση Εφαρμογής
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Για να λαμβάνετε ειδοποιήσεις στο iPhone:
          </p>
          <ol className="text-[10px] text-muted-foreground mt-1 space-y-1 list-decimal list-inside">
            <li>Πατήστε το κουμπί <strong>"Κοινοποίηση"</strong> (Share) στο Safari</li>
            <li>Επιλέξτε <strong>"Προσθήκη στην Αρχική Οθόνη"</strong></li>
            <li>Ανοίξτε την εφαρμογή από την αρχική σας οθόνη</li>
          </ol>
        </div>
      );
    }
    return null;
  };


  if (!isSupported) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 relative"
          title="Ειδοποιήσεις"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          {isSubscribed && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">Ειδοποιήσεις Push</div>

          {getIOSWarning()}

          <p className="text-xs text-muted-foreground">
            {isSubscribed
              ? (iosStatus === 'needs-install'
                ? 'Λαμβάνετε ειδοποιήσεις όταν το app είναι ανοιχτό (Safari - client-side only).'
                : 'Λαμβάνετε ειδοποιήσεις για καθυστερήσεις λεωφορείων.')
              : (iosStatus === 'needs-install'
                ? 'Ενεργοποιήστε για να λαμβάνετε ειδοποιήσεις όταν το app είναι ανοιχτό (Safari - client-side only).'
                : 'Ενεργοποιήστε για να λαμβάνετε ειδοποιήσεις καθυστερήσεων.')}
          </p>

          {iosStatus !== 'needs-update' && (
            <Button
              onClick={handleToggle}
              disabled={isLoading}
              variant={isSubscribed ? 'outline' : 'default'}
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isSubscribed ? (
                <BellOff className="h-4 w-4 mr-1" />
              ) : (
                <Bell className="h-4 w-4 mr-1" />
              )}
              {isSubscribed ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
            </Button>
          )}

          {isSubscribed && iosStatus === 'supported' && (
            <p className="text-xs text-success">
              ✓ iOS PWA - Ειδοποιήσεις ενεργές
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
