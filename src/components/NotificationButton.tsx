import { useState } from 'react';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function NotificationButton() {
  const { isSubscribed, isSupported, isLoading, subscribe, unsubscribe, iosStatus } = usePushSubscription();
  const [isSendingTest, setIsSendingTest] = useState(false);

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
        <p className="text-xs text-destructive">
          ⚠️ Απαιτείται iOS 16.4 ή νεότερο για push notifications.
        </p>
      );
    }
    if (iosStatus === 'needs-install') {
      return (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          📱 Για να λαμβάνετε ειδοποιήσεις, εγκαταστήστε την εφαρμογή: 
          Πατήστε το κουμπί "Κοινοποίηση" → "Προσθήκη στην Αρχική Οθόνη"
        </p>
      );
    }
    return null;
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      toast({
        title: 'Πρέπει να εγγραφείτε πρώτα',
        description: 'Ενεργοποιήστε τις ειδοποιήσεις πριν στείλετε δοκιμή',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '🚌 Δοκιμή Ειδοποίησης',
          body: 'Οι ειδοποιήσεις λειτουργούν κανονικά!',
        },
      });

      if (error) throw error;

      console.log('Test notification result:', data);
      toast({
        title: 'Επιτυχία',
        description: `Στάλθηκαν ${data?.sent || 0} ειδοποιήσεις`,
      });
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία αποστολής δοκιμαστικής ειδοποίησης',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
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
            <div className="flex gap-2">
              <Button
                onClick={handleToggle}
                disabled={isLoading}
                variant={isSubscribed ? 'outline' : 'default'}
                size="sm"
                className="flex-1"
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

              {isSubscribed && (
                <Button
                  onClick={handleTestNotification}
                  disabled={isSendingTest}
                  variant="outline"
                  size="sm"
                  title="Αποστολή δοκιμαστικής ειδοποίησης"
                >
                  {isSendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
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
