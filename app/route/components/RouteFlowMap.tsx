"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

export type RouteFlowMapPoint = {
  id: string;
  label: string;
  lat: number;
  lon: number;
};

type RouteFlowMapProps = {
  points: RouteFlowMapPoint[];
};

type LatLngTuple = [number, number];

/**
 * Calculate straight-line distance between two coordinates in km
 */
function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function FitRouteBounds({ coordinates }: { coordinates: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 12, { animate: true });
      return;
    }

    map.fitBounds(coordinates, {
      padding: [24, 24],
      animate: true,
    });
  }, [coordinates, map]);

  return null;
}

function segmentKey(from: RouteFlowMapPoint, to: RouteFlowMapPoint) {
  return `${from.lat.toFixed(6)},${from.lon.toFixed(6)}->${to.lat.toFixed(6)},${to.lon.toFixed(6)}`;
}

export default function RouteFlowMap({ points }: RouteFlowMapProps) {
  const [pathCoordinates, setPathCoordinates] = useState<LatLngTuple[]>([]);
  const [isPathLoading, setIsPathLoading] = useState(false);
  const [pathError, setPathError] = useState("");
  const [failedSegments, setFailedSegments] = useState<
    Array<{ from: string; to: string }>
  >([]);
  const segmentCacheRef = useRef<Map<string, LatLngTuple[]>>(new Map());

  const markerCoordinates = useMemo<LatLngTuple[]>(
    () => points.map((point) => [point.lat, point.lon]),
    [points],
  );

  useEffect(() => {
    if (points.length < 2) {
      setPathCoordinates([]);
      setPathError("");
      return;
    }

    let cancelled = false;

    const fetchRoutePath = async () => {
      setIsPathLoading(true);
      setPathError("");
      setFailedSegments([]);

      const mergedPath: LatLngTuple[] = [];
      const failedSegs: Array<{ from: string; to: string }> = [];

      for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        const key = segmentKey(from, to);

        let segment = segmentCacheRef.current.get(key);

        if (!segment) {
          const straightLineDistance = calculateStraightLineDistance(
            from.lat,
            from.lon,
            to.lat,
            to.lon,
          );

          try {
            const response = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`,
            );

            const data = (await response.json()) as {
              routes?: Array<{
                distance?: number;
                geometry?: { coordinates?: number[][] };
              }>;
            };

            const rawCoordinates = data.routes?.[0]?.geometry?.coordinates;
            const distance = data.routes?.[0]?.distance;

            // Check if road distance is unreasonably long (> 2.5x straight line)
            const roadDistance = distance ? distance / 1000 : null;
            const isDistanceUnreasonable =
              roadDistance && roadDistance > straightLineDistance * 2.5;

            if (
              response.ok &&
              Array.isArray(rawCoordinates) &&
              rawCoordinates.length > 0 &&
              !isDistanceUnreasonable
            ) {
              segment = rawCoordinates
                .filter((pair) => Array.isArray(pair) && pair.length >= 2)
                .map((pair) => [pair[1], pair[0]] as LatLngTuple);
            } else {
              segment = [
                [from.lat, from.lon],
                [to.lat, to.lon],
              ];
              failedSegs.push({
                from: from.label,
                to: to.label,
              });
            }
          } catch {
            segment = [
              [from.lat, from.lon],
              [to.lat, to.lon],
            ];
            failedSegs.push({
              from: from.label,
              to: to.label,
            });
          }

          segmentCacheRef.current.set(key, segment);
        }

        if (index === 0) {
          mergedPath.push(...segment);
        } else {
          mergedPath.push(...segment.slice(1));
        }
      }

      if (!cancelled) {
        setPathCoordinates(mergedPath);
        setFailedSegments(failedSegs);
        setPathError(
          failedSegs.length > 0
            ? "Some road segments are missing or unreasonably long in the road network data, so direct paths were used for those segments."
            : "",
        );
        setIsPathLoading(false);
      }
    };

    void fetchRoutePath();

    return () => {
      cancelled = true;
    };
  }, [points]);

  if (points.length < 2) {
    return null;
  }

  const initialCenter: LatLngTuple = [points[0].lat, points[0].lon];
  const displayPath =
    pathCoordinates.length >= 2 ? pathCoordinates : markerCoordinates;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Route Flow Map
          </h3>
          <p className="text-xs text-slate-600">
            Ordered travel path from start to destination.
          </p>
        </div>
        {isPathLoading ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Loading route...
          </span>
        ) : null}
      </div>

      {pathError ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">{pathError}</p>
          {failedSegments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {failedSegments.map((segment, idx) => (
                <li key={idx} className="text-xs text-amber-800">
                  • {segment.from} → {segment.to}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={initialCenter}
          zoom={8}
          scrollWheelZoom
          className="h-96 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitRouteBounds coordinates={displayPath} />

          <Polyline
            positions={displayPath}
            pathOptions={{
              color: "#0f4272",
              weight: 5,
              opacity: 0.85,
            }}
          />

          {points.map((point, index) => {
            const isStart = index === 0;
            const isEnd = index === points.length - 1;

            return (
              <CircleMarker
                key={point.id}
                center={[point.lat, point.lon]}
                radius={isStart || isEnd ? 8 : 6}
                pathOptions={{
                  color: isStart ? "#065f46" : isEnd ? "#7c2d12" : "#0f4272",
                  fillColor: isStart
                    ? "#10b981"
                    : isEnd
                      ? "#fb923c"
                      : "#0f4272",
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -2]}>
                  <div className="text-xs">
                    <div className="font-semibold">
                      {index + 1}. {point.label}
                    </div>
                    <div className="text-slate-600">
                      {isStart ? "Start" : isEnd ? "Destination" : "Stop"}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}
