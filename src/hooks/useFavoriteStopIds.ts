import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "favorite-stop-ids";
const MAX_FAVORITES = 4;

export function useFavoriteStopIds() {
  const [favoriteStopIds, setFavoriteStopIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load favorite stop IDs:", e);
    }
    return [];
  });

  // Save to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteStopIds));
    } catch (e) {
      console.error("Failed to save favorite stop IDs:", e);
    }
  }, [favoriteStopIds]);

  const addFavorite = useCallback((stopId: string) => {
    if (favoriteStopIds.includes(stopId)) return false;
    if (favoriteStopIds.length >= MAX_FAVORITES) {
      // Remove oldest to make room
      setFavoriteStopIds(prev => [...prev.slice(1), stopId]);
    } else {
      setFavoriteStopIds(prev => [...prev, stopId]);
    }
    return true;
  }, [favoriteStopIds]);

  const removeFavorite = useCallback((stopId: string) => {
    setFavoriteStopIds(prev => prev.filter(id => id !== stopId));
  }, []);

  const isFavorite = useCallback((stopId: string) => {
    return favoriteStopIds.includes(stopId);
  }, [favoriteStopIds]);

  const toggleFavorite = useCallback((stopId: string) => {
    if (isFavorite(stopId)) {
      removeFavorite(stopId);
    } else {
      addFavorite(stopId);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  return {
    favoriteStopIds,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    maxFavorites: MAX_FAVORITES,
  };
}

