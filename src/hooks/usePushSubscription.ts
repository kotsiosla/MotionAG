import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { setPushEndpoint } from '@/hooks/useSavedTrips';

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BNlIFS3RpWV16zeQx6sa5RxNW9-DxcbupCwL_rmjiqDtyCzzjN7rufJcu1Zpc2c1gQztiKXNXTfe-0OaSzEaQJY';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

// Helper to detect iOS and check version
function getIOSVersion(): number | null {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (window.matchMedia('(display-mode: standalone)').matches) ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true);
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribedRoutes, setSubscribedRoutes] = useState<string[]>([]);
  const [iosStatus, setIosStatus] = useState<'supported' | 'needs-install' | 'needs-update' | null>(null);

  // Check if push is supported and current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      // Check for basic requirements
      if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      // iOS-specific checks
      if (isIOS()) {
        const iosVersion = getIOSVersion();
        console.log('iOS detected, version:', iosVersion, 'standalone:', isStandalone());
        
        if (iosVersion && iosVersion < 16) {
          console.log('iOS version too old for push notifications');
          setIsSupported(false);
          setIosStatus('needs-update');
          setIsLoading(false);
          return;
        }
        
        if (!isStandalone()) {
          console.log('iOS requires PWA to be installed for push notifications');
          // Still allow enabling but warn user
          setIosStatus('needs-install');
        } else {
          setIosStatus('supported');
        }
      }

      if (!('PushManager' in window)) {
        console.log('PushManager not supported');
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);

      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);

        // Check existing subscription
        const subscription = await registration.pushManager.getSubscription();
        console.log('Existing subscription:', subscription);
        
        if (subscription) {
          setIsSubscribed(true);
          
          // Load subscribed routes from localStorage (can't SELECT from DB due to RLS)
          const storedRoutes = localStorage.getItem('push_subscribed_routes');
          if (storedRoutes) {
            try {
              setSubscribedRoutes(JSON.parse(storedRoutes));
            } catch (e) {
              console.error('Error parsing stored routes:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
      
      setIsLoading(false);
    };

    checkSubscription();
  }, []);

  const subscribe = useCallback(async (routeIds: string[] = []) => {
    if (!isSupported) {
      toast({
        title: 'Μη υποστηριζόμενο',
        description: 'Οι ειδοποιήσεις push δεν υποστηρίζονται σε αυτή τη συσκευή',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setIsLoading(true);

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: 'Άδεια απορρίφθηκε',
          description: 'Πρέπει να επιτρέψετε τις ειδοποιήσεις για να λαμβάνετε ενημερώσεις',
          variant: 'destructive',
        });
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // First, unsubscribe from any existing subscription (important when VAPID key changes)
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Removing existing subscription before creating new one');
        try {
          await existingSubscription.unsubscribe();
        } catch (e) {
          console.log('Failed to unsubscribe existing, continuing anyway:', e);
        }
      }
      
      // Subscribe to push with new VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log('Push subscription:', subscription);

      // Extract keys
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }
      
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      // Save to database
      console.log('Saving subscription to database:', subscription.endpoint.substring(0, 50) + '...');
      const { data, error } = await supabase.from('push_subscriptions').upsert({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        route_ids: routeIds,
      }, {
        onConflict: 'endpoint',
      }).select();

      console.log('Database save result:', { data, error });
      if (error) throw error;

      setIsSubscribed(true);
      setSubscribedRoutes(routeIds);
      localStorage.setItem('push_subscribed_routes', JSON.stringify(routeIds));
      
      // Store endpoint for saved trips sync
      setPushEndpoint(subscription.endpoint);
      
      toast({
        title: 'Επιτυχής εγγραφή',
        description: 'Θα λαμβάνετε ειδοποιήσεις για καθυστερήσεις',
      });

      return true;
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      console.error('Error details:', error?.message, error?.code, error?.name);
      
      // Determine specific error message
      let errorMessage = 'Αποτυχία εγγραφής για ειδοποιήσεις';
      if (error?.message?.includes('permission') || error?.name === 'NotAllowedError') {
        errorMessage = 'Πρέπει να επιτρέψετε τις ειδοποιήσεις στις ρυθμίσεις του browser';
      } else if (error?.code === '42501' || error?.message?.includes('RLS')) {
        errorMessage = 'Σφάλμα βάσης δεδομένων - παρακαλώ δοκιμάστε ξανά';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Σφάλμα',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

        // Unsubscribe from push
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setSubscribedRoutes([]);
      localStorage.removeItem('push_subscribed_routes');
      
      toast({
        title: 'Απεγγραφή',
        description: 'Δεν θα λαμβάνετε πλέον ειδοποιήσεις',
      });

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία απεγγραφής',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRoutes = useCallback(async (routeIds: string[]) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // If not subscribed, subscribe with routes
        return subscribe(routeIds);
      }

      // Update routes in database
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ route_ids: routeIds })
        .eq('endpoint', subscription.endpoint);

      if (error) throw error;

      setSubscribedRoutes(routeIds);
      localStorage.setItem('push_subscribed_routes', JSON.stringify(routeIds));
      
      toast({
        title: 'Ενημέρωση',
        description: 'Οι γραμμές ειδοποιήσεων ενημερώθηκαν',
      });

      return true;
    } catch (error) {
      console.error('Error updating routes:', error);
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία ενημέρωσης γραμμών',
        variant: 'destructive',
      });
      return false;
    }
  }, [subscribe]);

  return {
    isSubscribed,
    isSupported,
    isLoading,
    subscribedRoutes,
    iosStatus,
    subscribe,
    unsubscribe,
    updateRoutes,
  };
}
