import { useState, useEffect, useCallback } from "react";
import type { StaticStop } from "@/types/gtfs";

export type FavoriteStopType = "home" | "work";

export interface FavoriteStop {
  type: FavoriteStopType;
  stop: StaticStop;
  createdAt: number;
}

const STORAGE_KEY = "transit-favorite-stops";

export function useFavoriteStops() {
  const [favorites, setFavorites] = useState<Record<FavoriteStopType, FavoriteStop | null>>({
    home: null,
    work: null,
  });

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load favorite stops:", e);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback((newFavorites: Record<FavoriteStopType, FavoriteStop | null>) => {
    setFavorites(newFavorites);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
  }, []);

  const setFavorite = useCallback((type: FavoriteStopType, stop: StaticStop) => {
    const newFavorite: FavoriteStop = {
      type,
      stop,
      createdAt: Date.now(),
    };
    saveFavorites({
      ...favorites,
      [type]: newFavorite,
    });
  }, [favorites, saveFavorites]);

  const removeFavorite = useCallback((type: FavoriteStopType) => {
    saveFavorites({
      ...favorites,
      [type]: null,
    });
  }, [favorites, saveFavorites]);

  const isFavorite = useCallback((stopId: string): FavoriteStopType | null => {
    if (favorites.home?.stop.stop_id === stopId) return "home";
    if (favorites.work?.stop.stop_id === stopId) return "work";
    return null;
  }, [favorites]);

  return {
    favorites,
    setFavorite,
    removeFavorite,
    isFavorite,
    homeStop: favorites.home?.stop || null,
    workStop: favorites.work?.stop || null,
  };
}
