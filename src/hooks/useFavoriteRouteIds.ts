import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "favorite-route-ids";
const MAX_FAVORITES = 4;

export function useFavoriteRouteIds() {
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load favorite route IDs:", e);
    }
    return [];
  });

  // Save to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteRouteIds));
    } catch (e) {
      console.error("Failed to save favorite route IDs:", e);
    }
  }, [favoriteRouteIds]);

  const addFavorite = useCallback((routeId: string) => {
    if (favoriteRouteIds.includes(routeId)) return false;
    if (favoriteRouteIds.length >= MAX_FAVORITES) {
      // Remove oldest to make room
      setFavoriteRouteIds(prev => [...prev.slice(1), routeId]);
    } else {
      setFavoriteRouteIds(prev => [...prev, routeId]);
    }
    return true;
  }, [favoriteRouteIds]);

  const removeFavorite = useCallback((routeId: string) => {
    setFavoriteRouteIds(prev => prev.filter(id => id !== routeId));
  }, []);

  const isFavorite = useCallback((routeId: string) => {
    return favoriteRouteIds.includes(routeId);
  }, [favoriteRouteIds]);

  const toggleFavorite = useCallback((routeId: string) => {
    if (isFavorite(routeId)) {
      removeFavorite(routeId);
    } else {
      addFavorite(routeId);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  return {
    favoriteRouteIds,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    maxFavorites: MAX_FAVORITES,
  };
}

