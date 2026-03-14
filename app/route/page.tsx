"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSelectedPlaces } from "@/app/context/SelectedPlacesContext";
import { getPlacesByIds, PlaceDetail } from "@/actions/getPlacesByIds";
import RouteSelectors from "@/app/route/components/RouteSelectors";
import RouteGraph from "@/app/route/components/RouteGraph";
import BranchAndBoundSection from "@/app/route/components/BranchAndBoundSection";
import type { RouteFlowMapPoint } from "@/app/route/components/RouteFlowMap";
import type { GraphPoint, RouteOption } from "@/app/route/components/types";
import {
  solveRouteWithBranchAndBound,
  type BranchAndBoundResult,
} from "@/lib/branch-and-bound";

const RouteFlowMap = dynamic(
  () => import("@/app/route/components/RouteFlowMap"),
  {
    ssr: false,
  },
);

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
  const [roadDistanceMatrixKey, setRoadDistanceMatrixKey] = useState("");
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [problematicSegments, setProblematicSegments] = useState<
    Array<{ fromIndex: number; toIndex: number }>
  >([]);

  const [bnbResult, setBnbResult] = useState<BranchAndBoundResult | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [delaySecondsInput, setDelaySecondsInput] = useState(".2");
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

  const graphPointsKey = useMemo(
    () =>
      graphPoints
        .map(
          (point) =>
            `${point.id}:${point.lat.toFixed(6)},${point.lon.toFixed(6)}`,
        )
        .join("|"),
    [graphPoints],
  );

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
    !isGeneratingRoute;

  const hasMatchingMatrix =
    roadDistanceMatrixKey === graphPointsKey &&
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
  ): Promise<{
    distances: Array<Array<number | null>>;
    problematicSegments?: Array<{ fromIndex: number; toIndex: number }>;
  }> => {
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
      problematicSegments?: Array<{ fromIndex: number; toIndex: number }>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch road distances.");
    }

    if (!Array.isArray(data.distances)) {
      throw new Error("Invalid OSRM distance matrix response.");
    }

    return {
      distances: data.distances,
      problematicSegments: data.problematicSegments,
    };
  };

  const handleGenerateRoute = async () => {
    if (!canGenerateRoute || !isDelayValid) return;

    setIsGeneratingRoute(true);
    setRoadDistanceError("");
    setProblematicSegments([]);
    setBnbResult(null);
    setVisibleStepCount(0);

    try {
      const delayMs = Math.round(parsedDelaySeconds * 1000);
      setPlaybackDelayMs(delayMs);

      let distanceResult: {
        distances: Array<Array<number | null>>;
        problematicSegments?: Array<{ fromIndex: number; toIndex: number }>;
      };

      if (hasMatchingMatrix) {
        distanceResult = {
          distances: roadDistances,
        };
      } else {
        distanceResult = await fetchRoadDistanceMatrix(graphPoints);
      }

      setRoadDistances(distanceResult.distances);
      setRoadDistanceMatrixKey(graphPointsKey);
      setProblematicSegments(distanceResult.problematicSegments ?? []);

      const result = solveRouteWithBranchAndBound({
        startIndex,
        endIndex,
        labels: graphPoints.map((p) => p.label),
        distances: distanceResult.distances,
      });

      setBnbResult(result);
    } catch (error: unknown) {
      setRoadDistances([]);
      setRoadDistanceMatrixKey("");
      setProblematicSegments([]);
      setRoadDistanceError(
        error instanceof Error
          ? error.message
          : "Failed to run route generation.",
      );
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  useEffect(() => {
    if (graphPoints.length < 2) {
      setRoadDistances([]);
      setRoadDistanceMatrixKey("");
      setRoadDistanceError("");
      return;
    }

    if (hasMatchingMatrix) {
      return;
    }

    let cancelled = false;

    // Step 0: fetch all node-to-node distances asynchronously as soon as nodes are ready.
    const prefetch = async () => {
      setRoadDistanceLoading(true);
      setRoadDistanceError("");
      try {
        const result = await fetchRoadDistanceMatrix(graphPoints);
        if (!cancelled) {
          setRoadDistances(result.distances);
          setRoadDistanceMatrixKey(graphPointsKey);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setRoadDistances([]);
          setRoadDistanceMatrixKey("");
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
  }, [graphPoints, graphPointsKey, hasMatchingMatrix]);

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

  const isBnbPlaybackComplete =
    !!bnbResult && visibleStepCount >= bnbResult.steps.length;

  const completedRoutePoints = useMemo<RouteFlowMapPoint[]>(() => {
    if (!isBnbPlaybackComplete || !bnbResult || bnbResult.bestPath.length < 2) {
      return [];
    }

    return bnbResult.bestPath
      .map((nodeIndex) => {
        const node = graphPoints[nodeIndex];
        if (!node) return null;
        return {
          id: node.id,
          label: node.label,
          lat: node.lat,
          lon: node.lon,
        };
      })
      .filter((point): point is RouteFlowMapPoint => point !== null);
  }, [bnbResult, graphPoints, isBnbPlaybackComplete]);

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
                max={10}
                step={0.5}
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
              {isGeneratingRoute ? "Generating..." : "Generate Route"}
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
            {bnbResult && (
              <BranchAndBoundSection
                bnbResult={bnbResult}
                visibleStepCount={visibleStepCount}
                roadDistanceError={roadDistanceError}
              />
            )}

            {problematicSegments.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-amber-900">
                  ⚠️ Road Data Missing
                </h3>
                <p className="mt-2 text-xs text-amber-800">
                  No proper road data found on these route segments. Direct
                  distances have been used instead:
                </p>
                <ul className="mt-3 space-y-1">
                  {problematicSegments.map((segment, idx) => {
                    const fromPoint = graphPoints[segment.fromIndex];
                    const toPoint = graphPoints[segment.toIndex];
                    const fromName =
                      fromPoint?.label ?? `Point ${segment.fromIndex}`;
                    const toName = toPoint?.label ?? `Point ${segment.toIndex}`;
                    return (
                      <li key={idx} className="text-xs text-amber-800">
                        • {fromName} → {toName}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {completedRoutePoints.length >= 2 ? (
              <RouteFlowMap points={completedRoutePoints} />
            ) : null}

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
          </>
        )}
      </div>
    </main>
  );
}
