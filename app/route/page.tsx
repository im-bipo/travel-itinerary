"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plane } from "lucide-react";
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
        setError(
          err instanceof Error ? err.message : "Failed to load place details.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds]);

  const places = placeDetails;
  const [startId, setStartId] = useState<number | null>(null);
  const [endId, setEndId] = useState<number | null>(null);

  type RouteOption = {
    label: string;
    value: number;
    imageUrl?: string;
    tag?: string;
    icon?: "airport" | "location";
    coords?: { lat: number; lon: number };
  };

  const AIRPORT_OPTION = useMemo(
    () => ({
      label: "Tribhuvan International Airport",
      value: -1,
      tag: "Recommended for international tourists",
      icon: "airport" as const,
      coords: { lat: 27.693912, lon: 85.35822 },
    }),
    [],
  );

  const CURRENT_LOCATION_OPTION = useMemo(
    () => ({
      label: "Current Location",
      value: -2,
      icon: "location" as const,
    }),
    [],
  );

  const placeOptions = useMemo(
    () =>
      places.map((place) => ({
        label: place.name,
        value: place.id,
        imageUrl: place.imageUrl ?? undefined,
        tag: place.type ?? undefined,
        coords:
          place.latitude != null && place.longitude != null
            ? { lat: place.latitude, lon: place.longitude }
            : undefined,
      })),
    [places],
  );

  const startOptions = useMemo<RouteOption[]>(
    () => [AIRPORT_OPTION, CURRENT_LOCATION_OPTION, ...placeOptions],
    [AIRPORT_OPTION, CURRENT_LOCATION_OPTION, placeOptions],
  );

  const endOptions = useMemo<RouteOption[]>(
    () => [AIRPORT_OPTION, ...placeOptions],
    [AIRPORT_OPTION, placeOptions],
  );

  const startOption = startOptions.find((o) => o.value === startId);
  const endOption = endOptions.find((o) => o.value === endId);

  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [geoRequested, setGeoRequested] = useState(false);

  const startCoords =
    startOption?.value === -2 ? currentLocation : (startOption?.coords ?? null);
  const endCoords =
    endOption?.value === -2 ? currentLocation : (endOption?.coords ?? null);

  function CustomSelect(props: {
    label: string;
    value: number | null;
    options: RouteOption[];
    placeholder?: string;
    onChange: (value: number | null) => void;
  }) {
    const {
      label,
      value,
      options,
      placeholder = "Select...",
      onChange,
    } = props;
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const rootRef = useRef<HTMLDivElement | null>(null);

    const selectedLabel = options.find((opt) => opt.value === value)?.label;
    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = useMemo(() => {
      if (!filter.trim()) return options;
      const query = filter.toLowerCase();
      return options.filter((opt) => opt.label.toLowerCase().includes(query));
    }, [filter, options]);

    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (!rootRef.current) return;
        if (!rootRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (geoRequested) return;
      if (currentLocation) return;
      if (startId !== -2 && endId !== -2) return;
      if (!navigator.geolocation) return;

      setGeoRequested(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {
          // ignore failure; user can still choose other options
        },
      );
    }, [currentLocation, endId, geoRequested, startId]);
    return (
      <div className="relative" ref={rootRef}>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {selectedOption ? (
              <div className="flex min-w-0 items-center gap-3">
                <OptionLeadingVisual option={selectedOption} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {selectedOption.label}
                  </p>
                  {selectedOption.tag ? (
                    <p className="truncate text-xs text-slate-500">
                      {selectedOption.tag}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="truncate text-slate-500">
                {selectedLabel ?? placeholder}
              </span>
            )}
            <span className="text-slate-400">▾</span>
          </button>
        </div>

        {open && (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2">
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search..."
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">
                  No results
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <OptionLeadingVisual option={opt} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {opt.label}
                        </p>
                        {opt.tag ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {opt.tag}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {opt.value === value ? (
                      <span className="text-primary">✓</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                className="w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function OptionLeadingVisual({ option }: { option: RouteOption }) {
    if (option.imageUrl) {
      return (
        <img
          src={option.imageUrl}
          alt={option.label}
          className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
        />
      );
    }

    if (option.icon === "airport") {
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200">
          <Plane className="h-4 w-4" />
        </div>
      );
    }

    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200">
        <MapPin className="h-4 w-4" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Route Planning
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review the selected locations, choose a start and end point, and
            plan your itinerary. Selections persist across the planner
            interface.
          </p>

          {places.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">Start</h2>
                <p className="text-xs text-slate-500">
                  Choose where the itinerary begins.
                </p>
                <div className="mt-3">
                  <CustomSelect
                    label="From"
                    placeholder="Select start"
                    value={startId}
                    options={startOptions}
                    onChange={(value) => {
                      if (value !== null && value === endId) {
                        setEndId(null);
                      }
                      setStartId(value);
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">
                  Destination
                </h2>
                <p className="text-xs text-slate-500">
                  Choose your final stop on the route.
                </p>
                <div className="mt-3">
                  <CustomSelect
                    label="To"
                    placeholder="Select destination"
                    value={endId}
                    options={endOptions}
                    onChange={(value) => {
                      if (value !== null && value === startId) {
                        setStartId(null);
                      }
                      setEndId(value);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {startOption && endOption && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <strong>Route:</strong> {startOption.label} →{" "}
                  {endOption.label}
                </div>
                <div className="text-xs text-primary/80">
                  {startCoords ? (
                    <span>
                      Start: {startCoords.lat.toFixed(6)},{" "}
                      {startCoords.lon.toFixed(6)}
                    </span>
                  ) : (
                    <span>Start coordinates unavailable</span>
                  )}
                  <span className="mx-2">•</span>
                  {endCoords ? (
                    <span>
                      End: {endCoords.lat.toFixed(6)},{" "}
                      {endCoords.lon.toFixed(6)}
                    </span>
                  ) : (
                    <span>End coordinates unavailable</span>
                  )}
                </div>
              </div>
            </div>
          )}
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
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Places</h2>
              <p className="mt-2 text-sm text-slate-600">
                Quick list of selected places (name + coordinates).
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2">Name</th>
                      <th className="py-2">Latitude</th>
                      <th className="py-2">Longitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {places.map((place) => (
                      <tr key={place.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium text-slate-900">
                          {place.name}
                        </td>
                        <td className="py-2 text-slate-600">
                          {place.latitude != null
                            ? place.latitude.toFixed(6)
                            : "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {place.longitude != null
                            ? place.longitude.toFixed(6)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
