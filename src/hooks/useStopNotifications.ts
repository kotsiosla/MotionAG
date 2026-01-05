import { useState, useEffect, useCallback } from 'react';

export interface StopNotificationSettings {
  stopId: string;
  stopName: string;
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  push: boolean;
  beforeMinutes: number;
}

const STORAGE_KEY = 'stop_notifications';

export function useStopNotifications() {
  const [notifications, setNotifications] = useState<StopNotificationSettings[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading stop notifications:', error);
    }
  }, []);

  // Save to localStorage
  const saveNotifications = useCallback((notifs: StopNotificationSettings[]) => {
    setNotifications(notifs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  }, []);

  // Add or update notification for a stop
  const setNotification = useCallback((settings: StopNotificationSettings) => {
    setNotifications(prev => {
      const existing = prev.findIndex(n => n.stopId === settings.stopId);
      let updated: StopNotificationSettings[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = settings;
      } else {
        updated = [...prev, settings];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove notification for a stop
  const removeNotification = useCallback((stopId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.stopId !== stopId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Get notification settings for a stop
  const getNotification = useCallback((stopId: string) => {
    return notifications.find(n => n.stopId === stopId);
  }, [notifications]);

  // Check if a stop has notifications enabled
  const hasNotification = useCallback((stopId: string) => {
    const notif = notifications.find(n => n.stopId === stopId);
    return notif?.enabled ?? false;
  }, [notifications]);

  return {
    notifications,
    setNotification,
    removeNotification,
    getNotification,
    hasNotification,
  };
}
