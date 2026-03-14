"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { PlaceResult } from "@/actions/search";

type SelectedPlacesContextValue = {
  selectedPlaces: PlaceResult[];
  addPlace: (place: PlaceResult) => void;
  removePlace: (placeId: number) => void;
  clearPlaces: () => void;
};

const SelectedPlacesContext = createContext<SelectedPlacesContextValue | null>(
  null,
);

export function SelectedPlacesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedPlaces, setSelectedPlaces] = useState<PlaceResult[]>([]);

  const value = useMemo<SelectedPlacesContextValue>(
    () => ({
      selectedPlaces,
      addPlace: (place: PlaceResult) => {
        setSelectedPlaces((prev) =>
          prev.some((p) => p.place_id === place.place_id)
            ? prev
            : [...prev, place],
        );
      },
      removePlace: (placeId: number) => {
        setSelectedPlaces((prev) => prev.filter((p) => p.place_id !== placeId));
      },
      clearPlaces: () => setSelectedPlaces([]),
    }),
    [selectedPlaces],
  );

  return (
    <SelectedPlacesContext.Provider value={value}>
      {children}
    </SelectedPlacesContext.Provider>
  );
}

export function useSelectedPlaces() {
  const ctx = useContext(SelectedPlacesContext);
  if (!ctx) {
    throw new Error(
      "useSelectedPlaces must be used within a SelectedPlacesProvider",
    );
  }
  return ctx;
}
