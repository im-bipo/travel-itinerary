"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelectedPlaces } from "@/app/context/SelectedPlacesContext";
import { getPlacesByIds, PlaceDetail } from "@/actions/getPlacesByIds";

export default function RoutePage() {
  const { selectedPlaces } = useSelectedPlaces();
  const selectedIds = useMemo(
    () => selectedPlaces.map((p) => p.place_id),
    [selectedPlaces],
  );

  const [placeDetails, setPlaceDetails] = useState<PlaceDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedIds.length === 0) {
      setPlaceDetails([]);
      return;
    }

    setLoading(true);
    setError("");

    (async () => {
      try {
        const details = await getPlacesByIds(selectedIds);
        setPlaceDetails(details);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load place details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds]);

  const places = placeDetails;
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Route Plan</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page shows the places selected from the planner. Use this as a
            starting point for routing and itinerary generation.
          </p>
        </div>

        {selectedPlaces.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No places selected. Please select places in the planner and click
            "Generate Route Plan".
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading selected places...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : places.length === 0 ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 text-sm text-warning-800">
            No place details were found for the selected IDs.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {places.map((place) => (
              <div
                key={place.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  {place.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {place.type} • {place.district}, {place.state}
                </p>
                {place.description && (
                  <p className="mt-3 text-sm text-slate-700">
                    {place.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  {place.latitude != null && place.longitude != null ? (
                    <span>
                      Lat: {place.latitude.toFixed(6)}, Lon: {place.longitude.toFixed(6)}
                    </span>
                  ) : (
                    <span>No coordinates</span>
                  )}
                  {place.imageUrl && (
                    <a
                      href={place.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View image
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
