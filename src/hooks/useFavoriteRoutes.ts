import { useState, useEffect, useCallback } from "react";
import type { StaticStop } from "@/types/gtfs";

export interface FavoriteRoute {
  id: string;
  origin: StaticStop;
  destination: StaticStop;
  createdAt: number;
}

const STORAGE_KEY = "transit-favorite-routes";

export function useFavoriteRoutes() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load favorites:", e);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback((newFavorites: FavoriteRoute[]) => {
    setFavorites(newFavorites);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
  }, []);

  const addFavorite = useCallback((origin: StaticStop, destination: StaticStop) => {
    const id = `${origin.stop_id}-${destination.stop_id}`;
    
    // Check if already exists
    if (favorites.some(f => f.id === id)) {
      return false;
    }

    const newFavorite: FavoriteRoute = {
      id,
      origin,
      destination,
      createdAt: Date.now(),
    };

    saveFavorites([newFavorite, ...favorites]);
    return true;
  }, [favorites, saveFavorites]);

  const removeFavorite = useCallback((id: string) => {
    saveFavorites(favorites.filter(f => f.id !== id));
  }, [favorites, saveFavorites]);

  const isFavorite = useCallback((originId: string, destinationId: string) => {
    return favorites.some(f => f.id === `${originId}-${destinationId}`);
  }, [favorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
  };
}
