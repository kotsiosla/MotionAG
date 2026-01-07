import { useState, useEffect, useCallback, useRef } from "react";
import { 
  MapPin, 
  Navigation, 
  Bus, 
  Clock, 
  Bell, 
  BellOff, 
  ChevronRight,
  Loader2,
  Volume2,
  LocateFixed,
  X,
  AlertCircle,
  Settings,
  Minimize2,
  GripHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { StaticStop, Trip, Vehicle, RouteInfo } from "@/types/gtfs";
import { useNearbyArrivals, useStopArrivals, type StopArrival, type NearbyStop } from "@/hooks/useNearbyArrivals";

// VAPID public key for push subscriptions
const VAPID_PUBLIC_KEY = 'BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc';

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running as installed PWA
const isStandalonePWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

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

interface NearbyStopsPanelProps {
  stops: StaticStop[];
  trips: Trip[];
  vehicles: Vehicle[];
  routeNamesMap: Map<string, RouteInfo>;
  onSelectVehicle?: (vehicleId: string, tripId: string, routeId?: string) => void;
  onStopSelect?: (stop: StaticStop) => void;
  onHighlightStop?: (stop: StaticStop | null) => void;
}

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} μ.`;
  return `${(meters / 1000).toFixed(1)} χλμ`;
};

const formatArrivalTime = (minutes?: number) => {
  if (minutes === undefined) return "—";
  if (minutes === 0) return "Τώρα";
  if (minutes === 1) return "1 λεπτό";
  if (minutes < 60) return `${minutes} λεπτά`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}ω ${mins}λ`;
};

export function NearbyStopsPanel({
  stops,
  trips,
  vehicles,
  routeNamesMap,
  onSelectVehicle,
  onStopSelect,
  onHighlightStop,
}: NearbyStopsPanelProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<StaticStop | null>(null);
  const [watchedArrivals, setWatchedArrivals] = useState<Set<string>>(new Set());
  const [notifiedArrivals, setNotifiedArrivals] = useState<Set<string>>(new Set());
  const [notificationDistance, setNotificationDistance] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationDistance');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationSettings');
    return saved ? JSON.parse(saved) : {
      sound: true,
      vibration: true,
      voice: true,
      push: true,
    };
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Fixed stop mode vs auto-track
  const [trackingMode, setTrackingMode] = useState<'auto' | 'fixed'>(() => {
    return localStorage.getItem('stopTrackingMode') as 'auto' | 'fixed' || 'auto';
  });
  const [fixedStop, setFixedStop] = useState<{ stopId: string; stopName: string } | null>(() => {
    const saved = localStorage.getItem('fixedStop');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(70); // percentage of viewport height
  const [mobilePosition, setMobilePosition] = useState({ x: 0, y: 0 }); // for free dragging
  const [isDraggingMobile, setIsDraggingMobile] = useState(false);
  const [mobileDragMode, setMobileDragMode] = useState<'resize' | 'move'>('resize');
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartHeightRef = useRef<number>(70);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const watchIdRef = useRef<number | null>(null);

  // Get nearby stops with arrivals
  const nearbyStops = useNearbyArrivals(
    userLocation,
    stops,
    trips,
    vehicles,
    routeNamesMap,
    1000, // 1km radius
    10 // max 10 stops
  );

  // Get arrivals for selected stop
  const selectedStopArrivals = useStopArrivals(
    selectedStop?.stop_id || null,
    stops,
    trips,
    vehicles,
    routeNamesMap
  );

  // Get nearest stop for highlighting
  const nearestStop = nearbyStops.length > 0 ? nearbyStops[0].stop : null;

  // Highlight nearest stop when panel opens
  useEffect(() => {
    if (isPanelOpen && nearestStop && onHighlightStop) {
      onHighlightStop(nearestStop);
    }
    return () => {
      if (onHighlightStop) {
        onHighlightStop(null);
      }
    };
  }, [isPanelOpen, nearestStop, onHighlightStop]);

  // Save notification distance
  useEffect(() => {
    localStorage.setItem('nearbyNotificationDistance', notificationDistance.toString());
  }, [notificationDistance]);

  // Save notification settings
  useEffect(() => {
    localStorage.setItem('nearbyNotificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Save tracking mode and fixed stop
  useEffect(() => {
    localStorage.setItem('stopTrackingMode', trackingMode);
  }, [trackingMode]);

  useEffect(() => {
    if (fixedStop) {
      localStorage.setItem('fixedStop', JSON.stringify(fixedStop));
    } else {
      localStorage.removeItem('fixedStop');
    }
  }, [fixedStop]);

  // Get the active stop for notifications (either nearest or fixed)
  const activeTrackedStop = trackingMode === 'fixed' && fixedStop
    ? { stop_id: fixedStop.stopId, stop_name: fixedStop.stopName }
    : nearestStop;

  // Function to set a stop as fixed
  const setAsFixedStop = useCallback((stop: { stop_id: string; stop_name: string }) => {
    setFixedStop({ stopId: stop.stop_id, stopName: stop.stop_name });
    setTrackingMode('fixed');
    toast({
      title: "📍 Σταθερή στάση ορίστηκε",
      description: stop.stop_name,
    });
  }, []);

  // Update push subscription when nearest stop changes - ADD to existing stops, don't replace
  useEffect(() => {
    const addStopToNotifications = async () => {
      console.log('[NearbyStopsPanel] Update check - nearestStop:', nearestStop?.stop_id, 'push:', notificationSettings.push);
      
      if (!nearestStop || !notificationSettings.push) {
        console.log('[NearbyStopsPanel] Skipping update - no nearest stop or push disabled');
        return;
      }
      
      try {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          console.log('[NearbyStopsPanel] Service worker not supported');
          return;
        }
        
        // Get current subscription
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) {
          console.log('[NearbyStopsPanel] No service worker registration');
          return;
        }
        
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log('[NearbyStopsPanel] No push subscription');
          return;
        }

        // First, get existing stop notifications from database
        const { data: existing } = await supabase
          .from('stop_notification_subscriptions')
          .select('stop_notifications')
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();

        // Get existing stops or empty array
        let existingStops: any[] = Array.isArray(existing?.stop_notifications) 
          ? existing.stop_notifications 
          : [];
        
        // Check if this stop already exists
        const stopExists = existingStops.some((s: any) => s.stopId === nearestStop.stop_id);
        
        if (stopExists) {
          console.log('[NearbyStopsPanel] Stop already in notifications:', nearestStop.stop_id);
          return;
        }

        // Create new stop settings
        const newStop = {
          stopId: nearestStop.stop_id,
          stopName: nearestStop.stop_name,
          enabled: true,
          sound: notificationSettings.sound,
          vibration: notificationSettings.vibration,
          voice: notificationSettings.voice,
          push: true,
          beforeMinutes: Math.round(notificationDistance / 100),
        };

        // Add new stop to existing stops
        const updatedStops = [...existingStops, newStop];

        console.log('[NearbyStopsPanel] Adding stop to notifications:', nearestStop.stop_id, 'Total:', updatedStops.length);
        console.log('[NearbyStopsPanel] Upsert attempt - endpoint:', subscription.endpoint.substring(0, 50) + '...');

        // Get keys for upsert
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        if (!p256dhKey || !authKey) {
          console.error('[NearbyStopsPanel] ❌ Missing push keys for upsert');
          return;
        }
        
        const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
        const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

        // Ensure stop_notifications is properly formatted as JSONB
        const updatedStopsJson = JSON.parse(JSON.stringify(updatedStops));

        const { error, data } = await supabase
          .from('stop_notification_subscriptions')
          .upsert({
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            stop_notifications: updatedStopsJson,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'endpoint' })
          .select();

        if (error) {
          console.error('[NearbyStopsPanel] ❌ Failed to add stop:', error);
          console.error('[NearbyStopsPanel] Error code:', error.code);
          console.error('[NearbyStopsPanel] Error message:', error.message);
        } else {
          console.log('[NearbyStopsPanel] ✅ Added stop:', nearestStop.stop_id, 'Total stops:', updatedStops.length);
          console.log('[NearbyStopsPanel] Update result:', data);
          if (!data || data.length === 0) {
            console.warn('[NearbyStopsPanel] ⚠️ Update returned no data - row may not exist');
          }
          toast({
            title: "🔔 Στάση προστέθηκε",
            description: `${nearestStop.stop_name} - ${updatedStops.length} στάσεις συνολικά`,
          });
        }
      } catch (e) {
        console.error('[NearbyStopsPanel] Error adding stop:', e);
      }
    };

    addStopToNotifications();
  }, [nearestStop?.stop_id, notificationSettings.push, notificationSettings.sound, notificationSettings.vibration, notificationSettings.voice, notificationDistance]);

  // Ensure push subscription exists and is synced to database
  const ensurePushSubscription = useCallback(async (silent: boolean = false) => {
    try {
      // Check support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[NearbyStopsPanel] Push not supported');
        return false;
      }

      // First, check if we already have a valid subscription in browser
      const existingRegistration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (existingRegistration) {
        const existingSub = await existingRegistration.pushManager.getSubscription();
        if (existingSub) {
          // Check if this subscription exists in database
          const { data: dbSub } = await supabase
            .from('stop_notification_subscriptions')
            .select('id, endpoint')
            .eq('endpoint', existingSub.endpoint)
            .maybeSingle();
          
          if (dbSub) {
            console.log('[NearbyStopsPanel] Already have valid subscription in DB');
            return true; // Already subscribed, no need to do anything
          }
        }
      }

      // Request permission - handle iOS PWA differently
      let permission = Notification.permission;
      
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      
      console.log('[NearbyStopsPanel] Push permission:', permission, 'iOS:', isIOS(), 'PWA:', isStandalonePWA());
      
      // On iOS PWA, permission might still show as default even when granted via iOS settings
      // We'll try to proceed anyway if we're in a standalone PWA on iOS
      if (permission !== 'granted') {
        if (isIOS() && isStandalonePWA()) {
          console.log('[NearbyStopsPanel] iOS PWA - trying to proceed despite permission state');
          // On iOS PWA, try to proceed - if it fails, it will throw an error
        } else {
          if (!silent) {
            toast({
              title: "⚠️ Απαιτείται άδεια",
              description: isIOS() 
                ? "Ανοίξτε Ρυθμίσεις → Ειδοποιήσεις → [Εφαρμογή] και ενεργοποιήστε τις ειδοποιήσεις"
                : "Παρακαλώ επιτρέψτε τις ειδοποιήσεις",
              variant: "destructive",
            });
          }
          return false;
        }
      }

      // Register service worker and get subscription
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      console.log('[NearbyStopsPanel] Push subscription:', subscription.endpoint.substring(0, 50));

      // Extract keys
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }
      
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      // Save to database - use the actual nearest stop ID if available
      // This allows the edge function to match arrivals correctly
      const actualStopId = nearestStop?.stop_id || 'nearby_mode';
      const actualStopName = nearestStop?.stop_name || 'Κοντινότερη Στάση (Auto)';
      
      // Ensure minimum 5 minutes for progressive notifications (5, 3, 2, 1)
      const calculatedBeforeMinutes = Math.round(notificationDistance / 100);
      const beforeMinutes = Math.max(calculatedBeforeMinutes, 5); // Minimum 5 for progressive notifications
      
      const stopSettings = [{
        stopId: actualStopId,
        stopName: actualStopName,
        enabled: true,
        sound: notificationSettings.sound,
        vibration: notificationSettings.vibration,
        voice: notificationSettings.voice,
        push: true,
        beforeMinutes: beforeMinutes,
      }];

      // Upsert to database (use upsert instead of update/insert)
      // Ensure stop_notifications is properly formatted as JSONB
      const stopSettingsJson = JSON.parse(JSON.stringify(stopSettings));
      
      console.log('[NearbyStopsPanel] Upserting subscription to database...');
      const { data: upsertData, error: upsertError } = await supabase
        .from('stop_notification_subscriptions')
        .upsert({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          stop_notifications: stopSettingsJson,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })
        .select();

      if (upsertError) {
        console.error('[NearbyStopsPanel] ❌ Upsert error:', upsertError);
        console.error('[NearbyStopsPanel] Upsert error details:', JSON.stringify(upsertError, null, 2));
        throw upsertError;
      }
      
      console.log('[NearbyStopsPanel] ✅ Upserted subscription in database:', upsertData);

      return true;
    } catch (error) {
      console.error('[NearbyStopsPanel] Push subscription error:', error);
      return false;
    }
  }, [notificationSettings, notificationDistance, nearestStop]);

  // Toggle notification setting - with push subscription handling
  const toggleNotificationSetting = useCallback(async (key: keyof typeof notificationSettings) => {
    // If toggling push ON, create push subscription
    if (key === 'push' && !notificationSettings.push) {
      const success = await ensurePushSubscription();
      if (success) {
        toast({
          title: "✅ Push ειδοποιήσεις ενεργοποιήθηκαν",
          description: "Θα λαμβάνετε ειδοποιήσεις ακόμα και με κλειστή εφαρμογή",
        });
        setNotificationSettings((prev: typeof notificationSettings) => ({
          ...prev,
          push: true,
        }));
      }
    } else if (key === 'push' && notificationSettings.push) {
      // Turning push OFF
      setNotificationSettings((prev: typeof notificationSettings) => ({
        ...prev,
        push: false,
      }));
      toast({
        title: "Push ειδοποιήσεις απενεργοποιήθηκαν",
      });
    } else {
      // For other settings, just toggle
      setNotificationSettings((prev: typeof notificationSettings) => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  }, [notificationSettings, ensurePushSubscription]);

  // Automatically update tracked stop in database when it changes
  const lastSyncedStopRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only sync if push is enabled and we have an active stop
    if (!notificationSettings.push || !activeTrackedStop) return;
    
    // In fixed mode, always use fixed stop; in auto mode, use nearest
    const stopToSync = trackingMode === 'fixed' && fixedStop 
      ? fixedStop 
      : nearestStop ? { stopId: nearestStop.stop_id, stopName: nearestStop.stop_name } : null;
    
    if (!stopToSync) return;
    
    // Skip if we already synced this stop
    if (lastSyncedStopRef.current === stopToSync.stopId) return;
    
    const syncTrackedStop = async () => {
      try {
        console.log('[NearbyStopsPanel] 🔄 Starting syncTrackedStop...');
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) {
          console.log('[NearbyStopsPanel] ❌ No service worker registration');
          return;
        }
        
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log('[NearbyStopsPanel] ❌ No push subscription');
          return;
        }
        
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        if (!p256dhKey || !authKey) {
          console.log('[NearbyStopsPanel] ❌ Missing push keys');
          return;
        }
        
        const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
        const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
        
        // Only ONE stop - the tracked one, always replaced
        // Ensure minimum 5 minutes for progressive notifications (5, 3, 2, 1)
        const calculatedBeforeMinutes = Math.round(notificationDistance / 100);
        const beforeMinutes = Math.max(calculatedBeforeMinutes, 5); // Minimum 5 for progressive notifications
        
        const stopSettings = [{
          stopId: stopToSync.stopId,
          stopName: stopToSync.stopName,
          enabled: true,
          sound: notificationSettings.sound,
          vibration: notificationSettings.vibration,
          voice: notificationSettings.voice,
          push: true,
          beforeMinutes: beforeMinutes,
        }];
        
        // Log Supabase URL for debugging
        const supabaseUrl = (supabase as any).supabaseUrl || 'unknown';
        console.log('[NearbyStopsPanel] Supabase URL:', supabaseUrl);
        console.log('[NearbyStopsPanel] Attempting upsert with:', {
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          p256dh: p256dh ? p256dh.substring(0, 20) + '...' : 'MISSING',
          auth: auth ? auth.substring(0, 20) + '...' : 'MISSING',
          stopSettings: stopSettings.length,
          supabaseUrl
        });
        
        console.log('[NearbyStopsPanel] 📤 Calling supabase.upsert...');
        console.log('[NearbyStopsPanel] Upsert payload:', {
          endpoint: subscription.endpoint,
          p256dh_length: p256dh.length,
          auth_length: auth.length,
          stop_notifications: stopSettings
        });
        
        // Check if Supabase key is configured
        const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || localStorage.getItem('supabase_anon_key');
        if (!supabaseKey || supabaseKey.length === 0) {
          console.error('[NearbyStopsPanel] ❌ Supabase key is missing!');
          console.error('[NearbyStopsPanel] Please set VITE_SUPABASE_PUBLISHABLE_KEY in .env or run:');
          console.error('[NearbyStopsPanel] localStorage.setItem("supabase_anon_key", "YOUR_KEY")');
          console.error('[NearbyStopsPanel] Get key from: https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/settings/api');
          toast({
            title: "❌ Supabase Key Missing",
            description: "Please set VITE_SUPABASE_PUBLISHABLE_KEY. Check console for details.",
            variant: "destructive",
          });
          return;
        }
        
        // Add timeout to detect if upsert hangs
        console.log('[NearbyStopsPanel] ⏱️ Starting upsert with 10s timeout...');
        const startTime = Date.now();
        
        // Ensure stop_notifications is properly formatted as JSONB
        const stopNotificationsJson = JSON.parse(JSON.stringify(stopSettings));
        
        const upsertPromise = supabase
          .from('stop_notification_subscriptions')
          .upsert({
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            stop_notifications: stopNotificationsJson,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'endpoint' })
          .select();
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            const elapsed = Date.now() - startTime;
            reject(new Error(`Upsert timeout after ${elapsed}ms`));
          }, 10000);
        });
        
        let error, data;
        try {
          console.log('[NearbyStopsPanel] ⏳ Waiting for upsert response...');
          const result = await Promise.race([upsertPromise, timeoutPromise]);
          const elapsed = Date.now() - startTime;
          console.log(`[NearbyStopsPanel] 📥 Upsert response received after ${elapsed}ms`);
          error = result.error;
          data = result.data;
          console.log('[NearbyStopsPanel] Error:', error);
          console.log('[NearbyStopsPanel] Data:', data);
        } catch (raceError) {
          const elapsed = Date.now() - startTime;
          console.error(`[NearbyStopsPanel] ❌ Upsert promise error after ${elapsed}ms:`, raceError);
          if (raceError instanceof Error && raceError.message.includes('timeout')) {
            console.error('[NearbyStopsPanel] ⏱️ Upsert timed out - request may be stuck');
            console.error('[NearbyStopsPanel] Check Network tab for pending requests');
          }
          error = raceError;
          data = null;
        }
        
        if (error) {
          console.error('[NearbyStopsPanel] ❌ Upsert error:', error);
          console.error('[NearbyStopsPanel] Error details:', JSON.stringify(error, null, 2));
          console.error('[NearbyStopsPanel] Error code:', error.code);
          console.error('[NearbyStopsPanel] Error message:', error.message);
          console.error('[NearbyStopsPanel] Error hint:', error.hint);
        } else {
          lastSyncedStopRef.current = stopToSync.stopId;
          console.log('[NearbyStopsPanel] ✅ Synced tracked stop:', stopToSync.stopName, '(mode:', trackingMode, ')');
          console.log('[NearbyStopsPanel] Upsert result:', data);
          console.log('[NearbyStopsPanel] Upsert result length:', data?.length || 0);
          
          if (!data || data.length === 0) {
            console.warn('[NearbyStopsPanel] ⚠️ Upsert returned no data - checking if row exists...');
            // Check if row was actually created
            const { data: checkData, error: checkError } = await supabase
              .from('stop_notification_subscriptions')
              .select('id, endpoint, stop_notifications')
              .eq('endpoint', subscription.endpoint)
              .maybeSingle();
            console.log('[NearbyStopsPanel] Row exists check:', checkData);
            console.log('[NearbyStopsPanel] Row exists check error:', checkError);
            
            // Also try to count all rows
            const { count, error: countError } = await supabase
              .from('stop_notification_subscriptions')
              .select('*', { count: 'exact', head: true });
            console.log('[NearbyStopsPanel] Total rows in table:', count);
            console.log('[NearbyStopsPanel] Count error:', countError);
          } else {
            // Verify the data was actually saved
            console.log('[NearbyStopsPanel] ✅ Upsert returned data, verifying save...');
            const { data: verifyData, error: verifyError } = await supabase
              .from('stop_notification_subscriptions')
              .select('id, endpoint, stop_notifications')
              .eq('endpoint', subscription.endpoint)
              .maybeSingle();
            console.log('[NearbyStopsPanel] Verification result:', verifyData);
            console.log('[NearbyStopsPanel] Verification error:', verifyError);
          }
        }
      } catch (e) {
        console.error('[NearbyStopsPanel] ❌ Exception in syncTrackedStop:', e);
        console.error('[NearbyStopsPanel] Exception details:', JSON.stringify(e, null, 2));
        if (e instanceof Error) {
          console.error('[NearbyStopsPanel] Exception message:', e.message);
          console.error('[NearbyStopsPanel] Exception stack:', e.stack);
        }
      }
    };
    
    syncTrackedStop();
  }, [activeTrackedStop?.stop_id, trackingMode, fixedStop, nearestStop, notificationSettings.push, notificationSettings.sound, notificationSettings.vibration, notificationSettings.voice, notificationDistance]);

  // Note: Removed auto-sync that was showing permission toast repeatedly

  // Get user location with retry logic
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Η τοποθεσία δεν υποστηρίζεται");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    // Try high accuracy first, then fallback to low accuracy
    const tryGetPosition = (highAccuracy: boolean, retryCount: number = 0) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
          setLocationError(null);
        },
        (error) => {
          // If high accuracy failed and we haven't tried low accuracy yet
          if (highAccuracy && retryCount === 0) {
            console.log('High accuracy failed, trying low accuracy...');
            tryGetPosition(false, 1);
            return;
          }
          
          // If low accuracy also failed, retry once more with longer timeout
          if (!highAccuracy && retryCount === 1) {
            console.log('Low accuracy failed, final retry...');
            tryGetPosition(false, 2);
            return;
          }

          setIsLocating(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError("Δεν επιτρέπεται η πρόσβαση στην τοποθεσία");
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError("Η τοποθεσία δεν είναι διαθέσιμη");
              break;
            case error.TIMEOUT:
              setLocationError("Η αναζήτηση τοποθεσίας έληξε. Πατήστε για επανάληψη.");
              break;
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: highAccuracy ? 15000 : 30000, 
          maximumAge: 60000 
        }
      );
    };

    tryGetPosition(true, 0);
  }, []);

  // Watch location continuously
  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      () => {}, // Ignore errors in watch mode
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  // Trigger vibration
  const triggerVibration = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, []);

  // Speak announcement
  const speakAnnouncement = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'el-GR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Full notification trigger - respects settings
  const triggerFullNotification = useCallback((arrival: StopArrival, stopName: string) => {
    const routeName = arrival.routeShortName 
      ? `${arrival.routeShortName}${arrival.routeLongName ? `, ${arrival.routeLongName}` : ''}`
      : arrival.routeId;

    // Sound
    if (notificationSettings.sound) {
      playNotificationSound();
    }
    
    // Vibration
    if (notificationSettings.vibration) {
      triggerVibration();
    }
    
    // Voice announcement
    if (notificationSettings.voice) {
      const message = `Προσοχή! Γραμμή ${routeName} πλησιάζει στη στάση ${stopName}. Ετοιμαστείτε για επιβίβαση.`;
      speakAnnouncement(message);
    }
    
    // Push notification
    if (notificationSettings.push && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚌 ${routeName} πλησιάζει!`, {
        body: `Η γραμμή πλησιάζει στη στάση: ${stopName}`,
        icon: '/pwa-192x192.png',
        tag: `arrival-${arrival.tripId}`,
        requireInteraction: true,
      });
    }
  }, [playNotificationSound, triggerVibration, speakAnnouncement, notificationSettings]);

  // Monitor watched arrivals
  useEffect(() => {
    if (!selectedStop || watchedArrivals.size === 0) return;

    selectedStopArrivals.forEach(arrival => {
      const arrivalKey = `${arrival.tripId}-${selectedStop.stop_id}`;
      
      // Check if this arrival is being watched and is approaching
      if (watchedArrivals.has(arrival.tripId) &&
          arrival.estimatedMinutes !== undefined && 
          arrival.estimatedMinutes <= 2 && 
          !notifiedArrivals.has(arrivalKey)) {
        triggerFullNotification(arrival, selectedStop.stop_name || selectedStop.stop_id);
        setNotifiedArrivals(prev => new Set([...prev, arrivalKey]));
      }
    });
  }, [selectedStopArrivals, selectedStop, watchedArrivals, notifiedArrivals, triggerFullNotification]);

  // Toggle watch for an arrival
  const toggleWatchArrival = useCallback((arrival: StopArrival) => {
    requestNotificationPermission();
    
    setWatchedArrivals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(arrival.tripId)) {
        newSet.delete(arrival.tripId);
      } else {
        newSet.add(arrival.tripId);
      }
      return newSet;
    });
  }, [requestNotificationPermission]);

  // Select stop and view arrivals
  const handleStopSelect = useCallback((stop: StaticStop) => {
    setSelectedStop(stop);
    onStopSelect?.(stop);
    watchLocation();
  }, [onStopSelect, watchLocation]);

  // Track vehicle - close panel and follow vehicle
  const handleTrackVehicle = useCallback((arrival: StopArrival) => {
    if (arrival.vehicleId && onSelectVehicle) {
      // Close the panel first for unobstructed view
      setIsPanelOpen(false);
      setIsMinimized(false);
      setSelectedStop(null);
      if (onHighlightStop) {
        onHighlightStop(null);
      }
      // Then trigger vehicle tracking
      onSelectVehicle(arrival.vehicleId, arrival.tripId, arrival.routeId);
    }
  }, [onSelectVehicle, onHighlightStop]);

  // Handle panel open
  const handleOpenPanel = useCallback(() => {
    setIsPanelOpen(true);
    setIsMinimized(false);
    getLocation();
  }, [getLocation]);

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedStop(null);
    setMobileHeight(70);
    if (onHighlightStop) {
      onHighlightStop(null);
    }
  }, [onHighlightStop]);

  // Mobile resize drag handlers (for bottom sheet height)
  const handleMobileResizeStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMobile(true);
    setMobileDragMode('resize');
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: 0, y: clientY };
    dragStartHeightRef.current = mobileHeight;
  }, [mobileHeight]);

  // Mobile move drag handlers (for free positioning)
  const handleMobileMoveStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Don't start drag if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-no-drag]')) {
      return;
    }
    
    e.preventDefault();
    setIsDraggingMobile(true);
    setMobileDragMode('move');
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    dragStartPosRef.current = { x: mobilePosition.x, y: mobilePosition.y };
  }, [mobilePosition]);

  const handleMobileDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDraggingMobile) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (mobileDragMode === 'resize') {
      const deltaY = dragStartRef.current.y - clientY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(30, Math.min(90, dragStartHeightRef.current + deltaPercent));
      setMobileHeight(newHeight);
    } else {
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 200;
      const newX = Math.max(-20, Math.min(maxX, dragStartPosRef.current.x + deltaX));
      const newY = Math.max(60, Math.min(maxY, dragStartPosRef.current.y + deltaY));
      setMobilePosition({ x: newX, y: newY });
    }
  }, [isDraggingMobile, mobileDragMode]);

  const handleMobileDragEnd = useCallback((e?: TouchEvent | MouseEvent) => {
    setIsDraggingMobile(false);
    
    if (mobileDragMode === 'resize') {
      // Check for swipe down to close
      const endY = e && 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent)?.clientY || 0;
      const swipeDistance = endY - dragStartRef.current.y;
      const swipeVelocity = swipeDistance / 200; // rough velocity estimate
      
      // Close if swiped down fast or dragged below 20% height
      if (swipeDistance > 150 || mobileHeight < 20 || swipeVelocity > 1.5) {
        handleClosePanel();
        return;
      }
      
      // Snap to positions
      if (mobileHeight < 40) {
        setMobileHeight(30);
      } else if (mobileHeight > 75) {
        setMobileHeight(85);
      } else {
        setMobileHeight(60);
      }
    } else {
      // For floating mode, check if dragged to bottom to close
      if (mobilePosition.y > window.innerHeight - 100) {
        handleClosePanel();
      }
    }
  }, [mobileHeight, mobileDragMode, mobilePosition.y, handleClosePanel]);

  // Add/remove drag listeners for mobile
  useEffect(() => {
    if (isDraggingMobile) {
      document.addEventListener('mousemove', handleMobileDragMove);
      document.addEventListener('mouseup', handleMobileDragEnd);
      document.addEventListener('touchmove', handleMobileDragMove, { passive: false });
      document.addEventListener('touchend', handleMobileDragEnd);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMobileDragMove);
      document.removeEventListener('mouseup', handleMobileDragEnd);
      document.removeEventListener('touchmove', handleMobileDragMove);
      document.removeEventListener('touchend', handleMobileDragEnd);
      document.body.style.userSelect = '';
    };
  }, [isDraggingMobile, handleMobileDragMove, handleMobileDragEnd]);

  // Floating button (shown when panel is closed)
  if (!isPanelOpen) {
    return (
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-24 sm:bottom-20 right-4 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
        onClick={handleOpenPanel}
        title="Κοντινότερη Στάση"
      >
        <LocateFixed className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 sm:bottom-20 right-4 z-40 md:hidden">
        <Button
          variant="default"
          size="lg"
          className="h-12 sm:h-14 px-3 sm:px-4 rounded-full shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
          onClick={() => setIsMinimized(false)}
        >
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
          {nearestStop && (
            <span className="text-xs sm:text-sm max-w-[100px] sm:max-w-[120px] truncate">
              {nearestStop.stop_name}
            </span>
          )}
        </Button>
      </div>
    );
  }

  // Panel content
  const panelContent = (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Κοντινότερη Στάση</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 w-7"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={getLocation}
            disabled={isLocating}
            className="h-7 w-7"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
          {/* Toggle floating mode - mobile only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (mobilePosition.x === 0 && mobilePosition.y === 0) {
                setMobilePosition({ x: 16, y: 100 });
              } else {
                setMobilePosition({ x: 0, y: 0 });
              }
            }}
            className="h-7 w-7 md:hidden"
            title={mobilePosition.x === 0 ? "Floating mode" : "Docked mode"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobilePosition.x === 0 && mobilePosition.y === 0 ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M3 9h6" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15h18" />
                </>
              )}
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(true)}
            className="h-7 w-7"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClosePanel}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Simplified Settings */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent className="p-3 border-b border-border bg-muted/50">
          <div className="space-y-3">
            {/* Push notification toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className={`h-4 w-4 ${notificationSettings.push ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Push Ειδοποιήσεις</span>
              </div>
              <button
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notificationSettings.push ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
                onClick={() => toggleNotificationSetting('push')}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  notificationSettings.push ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Extra notification types - shown when push is on */}
            {notificationSettings.push && (
              <div className="flex gap-2">
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${
                    notificationSettings.sound 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('sound')}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Ήχος
                </button>
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${
                    notificationSettings.vibration 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('vibration')}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <path d="M2 8v8M22 8v8" strokeLinecap="round" />
                  </svg>
                  Δόνηση
                </button>
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${
                    notificationSettings.voice 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('voice')}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                  Φωνή
                </button>
              </div>
            )}

            {/* Distance settings */}
            {notificationSettings.push && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Ειδοποίηση όταν το λεωφορείο είναι σε:</span>
                  <span className="text-sm font-bold text-primary">
                    {notificationDistance < 1000 ? `${notificationDistance}μ` : `${notificationDistance/1000}χλμ`}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[200, 500, 1000, 2000].map(dist => (
                    <Button
                      key={dist}
                      variant={notificationDistance === dist ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setNotificationDistance(dist)}
                    >
                      {dist < 1000 ? `${dist}μ` : `${dist/1000}χλμ`}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking mode toggle */}
            {notificationSettings.push && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Λειτουργία παρακολούθησης:</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={trackingMode === 'auto' ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setTrackingMode('auto');
                      lastSyncedStopRef.current = null; // Force re-sync
                    }}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Αυτόματα (πλησιέστερη)
                  </Button>
                  <Button
                    variant={trackingMode === 'fixed' ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      if (nearestStop) {
                        setAsFixedStop(nearestStop);
                      }
                    }}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Σταθερή
                  </Button>
                </div>
                
                {/* Show current tracked stop */}
                {activeTrackedStop && (
                  <div className={`text-xs flex items-center justify-between p-2 rounded-md ${
                    trackingMode === 'fixed' ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-500'
                  }`}>
                    <span className="flex items-center gap-1">
                      {trackingMode === 'fixed' ? <MapPin className="h-3 w-3" /> : <Navigation className="h-3 w-3" />}
                      {activeTrackedStop.stop_name.substring(0, 25)}
                    </span>
                    {trackingMode === 'fixed' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 px-1 text-[10px]"
                        onClick={() => {
                          setTrackingMode('auto');
                          setFixedStop(null);
                          lastSyncedStopRef.current = null;
                          toast({ title: "Αλλαγή σε αυτόματη λειτουργία" });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {locationError && (
        <div className="flex items-center gap-2 text-destructive text-xs p-2 bg-destructive/10">
          <AlertCircle className="h-3 w-3" />
          {locationError}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Show selected stop arrivals */}
          {selectedStop ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedStop.stop_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedStop.stop_id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStop(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedStopArrivals.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Bus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Δεν υπάρχουν επερχόμενες αφίξεις</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStopArrivals.map((arrival) => (
                    <Card 
                      key={arrival.tripId}
                      className={`${watchedArrivals.has(arrival.tripId) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    >
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge 
                              variant="secondary"
                              className="shrink-0 text-xs"
                              style={{
                                backgroundColor: arrival.routeColor ? `#${arrival.routeColor}` : undefined,
                                color: arrival.routeColor ? '#fff' : undefined,
                              }}
                            >
                              {arrival.routeShortName || arrival.routeId}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">
                                {arrival.routeLongName || arrival.routeId}
                              </p>
                              {arrival.vehicleLabel && (
                                <p className="text-[10px] text-muted-foreground">
                                  Όχημα: {arrival.vehicleLabel}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className={`text-sm font-bold ${
                              arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 2 
                                ? 'text-green-500' 
                                : arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 5
                                ? 'text-yellow-500'
                                : ''
                            }`}>
                              {formatArrivalTime(arrival.estimatedMinutes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant={watchedArrivals.has(arrival.tripId) ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => toggleWatchArrival(arrival)}
                          >
                            {watchedArrivals.has(arrival.tripId) ? (
                              <>
                                <BellOff className="h-3 w-3 mr-1" />
                                Ακύρωση
                              </>
                            ) : (
                              <>
                                <Bell className="h-3 w-3 mr-1" />
                                Ειδοποίηση
                              </>
                            )}
                          </Button>
                          {arrival.vehicleId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleTrackVehicle(arrival)}
                            >
                              <Bus className="h-3 w-3 mr-1" />
                              Παρακολ.
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Show nearby stops list */
            <>
              {!userLocation && !isLocating && !locationError && (
                <div className="text-center py-8">
                  <Navigation className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Πάτα για τοποθεσία
                  </p>
                  <Button size="sm" onClick={getLocation}>
                    <LocateFixed className="h-4 w-4 mr-1" />
                    Εύρεση
                  </Button>
                </div>
              )}

              {isLocating && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Αναζήτηση...</p>
                </div>
              )}

              {userLocation && nearbyStops.length === 0 && (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Δεν βρέθηκαν στάσεις
                  </p>
                </div>
              )}

              {nearbyStops.map((nearbyStop, index) => {
                const isFixed = trackingMode === 'fixed' && fixedStop?.stopId === nearbyStop.stop.stop_id;
                return (
                <Card 
                  key={nearbyStop.stop.stop_id}
                  className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                    isFixed ? 'ring-2 ring-primary bg-primary/10' : 
                    index === 0 && trackingMode === 'auto' ? 'ring-2 ring-green-500 bg-green-500/10' : ''
                  }`}
                  onClick={() => handleStopSelect(nearbyStop.stop)}
                >
                  <CardContent className="p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${
                            isFixed ? 'text-primary' : 
                            index === 0 && trackingMode === 'auto' ? 'text-green-500' : 'text-muted-foreground'
                          }`} />
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight">{nearbyStop.stop.stop_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {formatDistance(nearbyStop.distance)}
                              </p>
                              {isFixed && (
                                <span className="text-[10px] text-primary font-medium">📍 Σταθερή</span>
                              )}
                              {index === 0 && trackingMode === 'auto' && (
                                <span className="text-[10px] text-green-500 font-medium">✓ Πλησιέστερη</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Set as fixed button */}
                        {notificationSettings.push && !isFixed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAsFixedStop(nearbyStop.stop);
                            }}
                          >
                            <MapPin className="h-3 w-3" />
                          </Button>
                        )}
                        {nearbyStop.arrivals.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {nearbyStop.arrivals.length}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {nearbyStop.arrivals.length > 0 && (
                      <div className="mt-1 ml-6 flex flex-wrap gap-1">
                        {nearbyStop.arrivals.slice(0, 3).map((arrival) => (
                          <Badge 
                            key={arrival.tripId}
                            variant="outline"
                            className="text-[10px] py-0"
                            style={{
                              borderColor: arrival.routeColor ? `#${arrival.routeColor}` : undefined,
                            }}
                          >
                            {arrival.routeShortName || arrival.routeId}
                            {arrival.estimatedMinutes !== undefined && (
                              <span className="ml-1 opacity-70">
                                {arrival.estimatedMinutes}′
                              </span>
                            )}
                          </Badge>
                        ))}
                        {nearbyStop.arrivals.length > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            +{nearbyStop.arrivals.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )})}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Desktop: Draggable/Resizable panel
  // Mobile: Draggable bottom sheet
  return (
    <>
      {/* Mobile: Draggable floating panel */}
      <div 
        className="fixed z-50 md:hidden transition-all duration-150 ease-out shadow-2xl"
        style={{ 
          left: mobilePosition.x === 0 ? 0 : mobilePosition.x,
          right: mobilePosition.x === 0 ? 0 : 'auto',
          bottom: mobilePosition.y === 0 ? 0 : 'auto',
          top: mobilePosition.y !== 0 ? mobilePosition.y : 'auto',
          height: mobilePosition.y === 0 ? `${mobileHeight}vh` : '60vh',
          width: mobilePosition.x === 0 ? 'auto' : 'min(90vw, 360px)',
        }}
      >
        {/* Drag handle for resize (when docked at bottom) */}
        {mobilePosition.x === 0 && mobilePosition.y === 0 && (
          <div 
            className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing bg-card rounded-t-xl border-t border-x border-border touch-none"
            onMouseDown={handleMobileResizeStart}
            onTouchStart={handleMobileResizeStart}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
          </div>
        )}
        {/* Drag handle for move (when floating) */}
        {(mobilePosition.x !== 0 || mobilePosition.y !== 0) && (
          <div 
            className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center gap-2 cursor-grab active:cursor-grabbing bg-card rounded-t-xl border border-border touch-none"
            onMouseDown={handleMobileMoveStart}
            onTouchStart={handleMobileMoveStart}
          >
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Σύρε για μετακίνηση</span>
          </div>
        )}
        <div 
          className={`h-full ${mobilePosition.x === 0 && mobilePosition.y === 0 ? 'pt-6' : 'pt-8 rounded-xl border border-border overflow-hidden'}`}
          onMouseDown={mobilePosition.x !== 0 || mobilePosition.y !== 0 ? handleMobileMoveStart : undefined}
          onTouchStart={mobilePosition.x !== 0 || mobilePosition.y !== 0 ? handleMobileMoveStart : undefined}
        >
          {panelContent}
        </div>
      </div>

      {/* Desktop: Draggable/Resizable panel */}
      <div className="hidden md:block fixed inset-0 pointer-events-none z-50">
        <div className="relative w-full h-full pointer-events-none">
          <ResizableDraggablePanel
            initialPosition={{ x: window.innerWidth - 360, y: 100 }}
            initialSize={{ width: 340, height: 450 }}
            minSize={{ width: 280, height: 300 }}
            maxSize={{ width: 500, height: 700 }}
            className="pointer-events-auto"
            title="Κοντινότερη Στάση"
            zIndex={1100}
          >
            {panelContent}
          </ResizableDraggablePanel>
        </div>
      </div>
    </>
  );
}
