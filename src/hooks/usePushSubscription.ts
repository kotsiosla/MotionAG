import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// VAPID public key from environment
const VAPID_PUBLIC_KEY = 'BOY7TtDjqW97iKphI_H198l6XVX5_JV2msRrSPs8yz7JsVyJmyTTQh1sX8D43CyUpEzEktYTfsiC238Vi2QGjJ0';

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

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribedRoutes, setSubscribedRoutes] = useState<string[]>([]);

  // Check if push is supported and current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
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
        if (subscription) {
          setIsSubscribed(true);
          
          // Fetch subscribed routes from database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('route_ids')
            .eq('endpoint', subscription.endpoint)
            .single();
          
          if (data?.route_ids) {
            setSubscribedRoutes(data.route_ids);
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
      
      // Subscribe to push
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
      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        route_ids: routeIds,
      }, {
        onConflict: 'endpoint',
      });

      if (error) throw error;

      setIsSubscribed(true);
      setSubscribedRoutes(routeIds);
      
      toast({
        title: 'Επιτυχής εγγραφή',
        description: 'Θα λαμβάνετε ειδοποιήσεις για καθυστερήσεις',
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία εγγραφής για ειδοποιήσεις',
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
    subscribe,
    unsubscribe,
    updateRoutes,
  };
}
