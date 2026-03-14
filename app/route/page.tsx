"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelectedPlaces } from "@/app/context/SelectedPlacesContext";
import { getPlacesByIds, PlaceDetail } from "@/actions/getPlacesByIds";
import RouteSelectors from "@/app/route/components/RouteSelectors";
import RouteGraph from "@/app/route/components/RouteGraph";
import PlacesTable from "@/app/route/components/PlacesTable";
import BranchAndBoundTree from "@/app/route/components/BranchAndBoundTree";
import type { GraphPoint, RouteOption } from "@/app/route/components/types";
import {
  solveRouteWithBranchAndBound,
  type BranchAndBoundResult,
} from "@/lib/branch-and-bound";

export default function RoutePage() {
  const { selectedPlaces, removePlace } = useSelectedPlaces();
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

  const AIRPORT_OPTION = useMemo<RouteOption>(
    () => ({
      label: "Tribhuvan International Airport",
      value: -1,
      tag: "Recommended for international tourists",
      icon: "airport" as const,
      coords: { lat: 27.693912, lon: 85.35822 },
    }),
    [],
  );

  const CURRENT_LOCATION_OPTION = useMemo<RouteOption>(
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

  const [roadDistances, setRoadDistances] = useState<
    Array<Array<number | null>>
  >([]);
  const [roadDistanceLoading, setRoadDistanceLoading] = useState(false);
  const [roadDistanceError, setRoadDistanceError] = useState("");

  const [bnbResult, setBnbResult] = useState<BranchAndBoundResult | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [delaySecondsInput, setDelaySecondsInput] = useState("1");
  const [playbackDelayMs, setPlaybackDelayMs] = useState(1000);
  const playbackRunIdRef = useRef(0);

  const graphPoints = useMemo<GraphPoint[]>(() => {
    const points: GraphPoint[] = [];

    for (const place of places) {
      if (place.latitude == null || place.longitude == null) continue;
      points.push({
        id: `place-${place.id}`,
        label: place.name,
        lat: place.latitude,
        lon: place.longitude,
        kind: "place",
      });
    }

    if ((startId === -1 || endId === -1) && AIRPORT_OPTION.coords) {
      points.push({
        id: "airport",
        label: AIRPORT_OPTION.label,
        lat: AIRPORT_OPTION.coords.lat,
        lon: AIRPORT_OPTION.coords.lon,
        kind: "airport",
      });
    }

    if ((startId === -2 || endId === -2) && currentLocation) {
      points.push({
        id: "current",
        label: CURRENT_LOCATION_OPTION.label,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        kind: "current",
      });
    }

    const unique = new Map<string, GraphPoint>();
    points.forEach((point) => unique.set(point.id, point));
    return [...unique.values()];
  }, [
    AIRPORT_OPTION.coords,
    AIRPORT_OPTION.label,
    CURRENT_LOCATION_OPTION.label,
    currentLocation,
    endId,
    places,
    startId,
  ]);

  const startNodeId = useMemo(() => {
    if (startId == null) return null;
    if (startId === -1) return "airport";
    if (startId === -2) return currentLocation ? "current" : null;
    return `place-${startId}`;
  }, [currentLocation, startId]);

  const endNodeId = useMemo(() => {
    if (endId == null) return null;
    if (endId === -1) return "airport";
    if (endId === -2) return currentLocation ? "current" : null;
    return `place-${endId}`;
  }, [currentLocation, endId]);

  const startIndex = useMemo(
    () =>
      startNodeId ? graphPoints.findIndex((p) => p.id === startNodeId) : -1,
    [graphPoints, startNodeId],
  );
  const endIndex = useMemo(
    () => (endNodeId ? graphPoints.findIndex((p) => p.id === endNodeId) : -1),
    [endNodeId, graphPoints],
  );

  const canGenerateRoute =
    startIndex >= 0 &&
    endIndex >= 0 &&
    startIndex !== endIndex &&
    graphPoints.length >= 2 &&
    !roadDistanceLoading;

  const hasMatchingMatrix =
    roadDistances.length === graphPoints.length &&
    roadDistances.every((row) => row.length === graphPoints.length);

  const parsedDelaySeconds = Number(delaySecondsInput);
  const isDelayValid =
    delaySecondsInput.trim().length > 0 &&
    Number.isFinite(parsedDelaySeconds) &&
    parsedDelaySeconds >= 0 &&
    parsedDelaySeconds < 10;

  const fetchRoadDistanceMatrix = async (
    points: GraphPoint[],
  ): Promise<Array<Array<number | null>>> => {
    const response = await fetch("/api/route/osrm-table", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        points: points.map((point) => ({
          lat: point.lat,
          lon: point.lon,
        })),
      }),
    });

    const data = (await response.json()) as {
      distances?: Array<Array<number | null>>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch road distances.");
    }

    if (!Array.isArray(data.distances)) {
      throw new Error("Invalid OSRM distance matrix response.");
    }

    return data.distances;
  };

  const handleGenerateRoute = async () => {
    if (!canGenerateRoute || !isDelayValid) return;

    setRoadDistanceLoading(true);
    setRoadDistanceError("");
    setBnbResult(null);
    setVisibleStepCount(0);

    try {
      const delayMs = Math.round(parsedDelaySeconds * 1000);
      setPlaybackDelayMs(delayMs);

      const distances = hasMatchingMatrix
        ? roadDistances
        : await fetchRoadDistanceMatrix(graphPoints);
      setRoadDistances(distances);

      const result = solveRouteWithBranchAndBound({
        startIndex,
        endIndex,
        labels: graphPoints.map((p) => p.label),
        distances,
      });

      setBnbResult(result);
    } catch (error: unknown) {
      setRoadDistances([]);
      setRoadDistanceError(
        error instanceof Error
          ? error.message
          : "Failed to run route generation.",
      );
    } finally {
      setRoadDistanceLoading(false);
    }
  };

  useEffect(() => {
    if (graphPoints.length < 2) {
      setRoadDistances([]);
      setRoadDistanceError("");
      return;
    }

    let cancelled = false;

    // Step 0: fetch all node-to-node distances asynchronously as soon as nodes are ready.
    const prefetch = async () => {
      setRoadDistanceLoading(true);
      setRoadDistanceError("");
      try {
        const distances = await fetchRoadDistanceMatrix(graphPoints);
        if (!cancelled) {
          setRoadDistances(distances);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setRoadDistances([]);
          setRoadDistanceError(
            error instanceof Error
              ? error.message
              : "Failed to prefetch road distances.",
          );
        }
      } finally {
        if (!cancelled) {
          setRoadDistanceLoading(false);
        }
      }
    };

    prefetch();

    return () => {
      cancelled = true;
    };
  }, [graphPoints]);

  useEffect(() => {
    if (!bnbResult || bnbResult.steps.length === 0) {
      setVisibleStepCount(0);
      return;
    }

    playbackRunIdRef.current += 1;
    const localRunId = playbackRunIdRef.current;

    const play = async () => {
      for (let index = 1; index <= bnbResult.steps.length; index += 1) {
        if (playbackRunIdRef.current !== localRunId) return;
        setVisibleStepCount(index);

        if (index < bnbResult.steps.length && playbackDelayMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, playbackDelayMs);
          });
        }
      }
    };

    void play();

    return () => {
      playbackRunIdRef.current += 1;
    };
  }, [bnbResult, playbackDelayMs]);

  useEffect(() => {
    setBnbResult(null);
    setVisibleStepCount(0);
  }, [startIndex, endIndex]);

  const startCoords =
    startOption?.value === -2 ? currentLocation : (startOption?.coords ?? null);
  const endCoords =
    endOption?.value === -2 ? currentLocation : (endOption?.coords ?? null);

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
        // Keep fallback behavior when user blocks location permission.
      },
    );
  }, [currentLocation, endId, geoRequested, startId]);

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

          <RouteSelectors
            placesLength={places.length}
            startId={startId}
            endId={endId}
            startOptions={startOptions}
            endOptions={endOptions}
            startOption={startOption}
            endOption={endOption}
            startCoords={startCoords}
            endCoords={endCoords}
            onStartChange={(value) => {
              if (value !== null && value === endId) {
                setEndId(null);
              }
              setStartId(value);
            }}
            onEndChange={(value) => {
              if (value !== null && value === startId) {
                setStartId(null);
              }
              setEndId(value);
            }}
          />

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">
                Time Delay (seconds)
              </span>
              <input
                type="number"
                min={0}
                max={9.99}
                step={0.1}
                value={delaySecondsInput}
                onChange={(event) => setDelaySecondsInput(event.target.value)}
                className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                placeholder="1"
              />
            </label>
            <button
              type="button"
              onClick={handleGenerateRoute}
              disabled={!canGenerateRoute || !isDelayValid}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {roadDistanceLoading ? "Generating..." : "Generate Route"}
            </button>
            <div className="text-xs text-slate-600">
              <p>
                Flow: prefetch matrix, run branch and bound, then show best
                path.
              </p>
              <p>Delay accepts 0 to 9.99. Set 0 for no visualization delay.</p>
            </div>
          </div>
          {!isDelayValid ? (
            <p className="mt-2 text-xs text-red-600">
              Delay must be a number between 0 and 10 (10 excluded).
            </p>
          ) : null}
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
            <RouteGraph
              places={places}
              startId={startId}
              endId={endId}
              currentLocation={currentLocation}
              airportOption={AIRPORT_OPTION}
              currentLocationOption={CURRENT_LOCATION_OPTION}
              roadDistances={roadDistances}
              roadDistanceLoading={roadDistanceLoading}
              roadDistanceError={roadDistanceError}
              onDeletePlace={(placeId) => {
                removePlace(placeId);
                setStartId((prev) => (prev === placeId ? null : prev));
                setEndId((prev) => (prev === placeId ? null : prev));
              }}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Branch and Bound (Live Tree)
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                The tree shows accepted and pruned branches while searching for
                the minimum-cost route from start to destination.
              </p>

              {roadDistanceError ? (
                <p className="mt-3 text-sm text-red-600">{roadDistanceError}</p>
              ) : null}

              {bnbResult ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Best Route
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-900">
                      {bnbResult.bestPathLabels.length > 0
                        ? bnbResult.bestPathLabels.join(" -> ")
                        : "No feasible route found"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Total Distance
                    </p>
                    <p className="mt-2 text-sm font-semibold text-sky-900">
                      {typeof bnbResult.bestCost === "number"
                        ? `${(bnbResult.bestCost / 1000).toFixed(1)} km`
                        : "n/a"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Search Stats
                    </p>
                    <p className="mt-2 text-sm font-semibold text-amber-900">
                      Visited: {bnbResult.visitedNodes} | Pruned:{" "}
                      {bnbResult.prunedNodes}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Choose start/destination and click Generate Route to run the
                  algorithm.
                </p>
              )}

              <div className="mt-5">
                <BranchAndBoundTree
                  steps={bnbResult?.steps ?? []}
                  visibleCount={visibleStepCount}
                />
              </div>
            </div>
            <PlacesTable places={places} />
          </>
        )}
      </div>
    </main>
  );
}
