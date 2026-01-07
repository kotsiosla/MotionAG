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
      // For iOS Safari (not PWA), send browser notification directly (no server-side)
      if (iosStatus === 'needs-install' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🚌 Δοκιμή Ειδοποίησης', {
            body: 'Οι ειδοποιήσεις λειτουργούν κανονικά!',
            icon: '/pwa-192x192.png',
            tag: 'test-notification',
          });
          toast({
            title: 'Επιτυχία',
            description: 'Δοκιμαστική ειδοποίηση στάλθηκε (client-side - Safari)',
          });
          setIsSendingTest(false);
          return;
        } catch (notifError) {
          console.error('Browser notification error:', notifError);
          // Fall through to try server-side
        }
      }

      // For Android/iOS PWA, try server-side push first
      // Use 'test-push' which is deployed (not 'send-push-notification')
      const { data, error } = await supabase.functions.invoke('test-push', {
        body: {
          title: '🚌 Δοκιμή Ειδοποίησης',
          body: 'Οι ειδοποιήσεις λειτουργούν κανονικά!',
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Try to get more details from the error
        let errorDetails = error.message || String(error);
        if (error.context) {
          errorDetails = error.context.message || errorDetails;
        }
        
        // If server-side fails but we have Notification permission, try client-side as fallback
        // This works for both iOS PWA and Android if server-side fails
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🚌 Δοκιμή Ειδοποίησης', {
              body: 'Οι ειδοποιήσεις λειτουργούν κανονικά! (client-side fallback)',
              icon: '/pwa-192x192.png',
              tag: 'test-notification',
            });
            toast({
              title: 'Επιτυχία (client-side fallback)',
              description: `Server-side απέτυχε: ${errorDetails.substring(0, 50)}... (χρησιμοποιήθηκε client-side)`,
            });
            setIsSendingTest(false);
            return;
          } catch (notifError) {
            console.error('Client-side notification also failed:', notifError);
          }
        }
        
        // If no client-side fallback, show the error
        throw error;
      }

      console.log('Test notification result:', data);
      
      // If no notifications were sent, it might mean no subscriptions exist
      if (data?.sent === 0 && data?.total === 0) {
        toast({
          title: '⚠️ Δεν βρέθηκαν subscriptions',
          description: 'Δεν υπάρχουν εγγεγραμμένοι χρήστες. Το test notification δουλεύει, αλλά δεν υπάρχουν subscriptions στο database.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Επιτυχία',
          description: `Στάλθηκαν ${data?.sent || 0} ειδοποιήσεις${data?.failed ? `, ${data.failed} απέτυχαν` : ''}`,
        });
      }
    } catch (error) {
      console.error('Test notification error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Σφάλμα',
        description: `Αποτυχία αποστολής: ${errorMessage.substring(0, 50)}`,
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
