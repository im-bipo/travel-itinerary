"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { PlaceDetail } from "@/actions/getPlacesByIds";
import type {
  Coordinates,
  GraphPoint,
  RouteOption,
} from "@/app/route/components/types";
import { GitBranchPlusIcon, Table, Trash2 } from "lucide-react";

type RouteGraphProps = {
  places: PlaceDetail[];
  startId: number | null;
  endId: number | null;
  currentLocation: Coordinates | null;
  airportOption: RouteOption;
  currentLocationOption: RouteOption;
  roadDistances: Array<Array<number | null>>;
  roadDistanceError: string;
  roadDistanceLoading: boolean;
  onDeletePlace: (placeId: number) => void;
};

export default function RouteGraph({
  places,
  startId,
  endId,
  currentLocation,
  airportOption,
  currentLocationOption,
  roadDistances,
  roadDistanceError,
  roadDistanceLoading,
  onDeletePlace,
}: RouteGraphProps) {
  const [activeTab, setActiveTab] = useState<"graph" | "table">("graph");

  const getPlaceIdFromPointId = (pointId: string): number | null => {
    if (!pointId.startsWith("place-")) return null;
    const id = Number(pointId.replace("place-", ""));
    return Number.isFinite(id) ? id : null;
  };

  const handleDeletePlace = (placeId: number, label: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${label}" from this route?`,
    );
    if (!confirmed) return;
    onDeletePlace(placeId);
  };

  const optionToNodeId = (value: number | null): string | null => {
    if (value == null) return null;
    if (value === -1) return "airport";
    if (value === -2) return currentLocation ? "current" : null;
    return `place-${value}`;
  };

  const graphPoints = useMemo(() => {
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

    if (startId === -1 || endId === -1) {
      if (airportOption.coords) {
        points.push({
          id: "airport",
          label: airportOption.label,
          lat: airportOption.coords.lat,
          lon: airportOption.coords.lon,
          kind: "airport",
        });
      }
    }

    if ((startId === -2 || endId === -2) && currentLocation) {
      points.push({
        id: "current",
        label: currentLocationOption.label,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        kind: "current",
      });
    }

    const unique = new Map<string, GraphPoint>();
    points.forEach((point) => unique.set(point.id, point));
    return [...unique.values()];
  }, [
    airportOption.coords,
    airportOption.label,
    currentLocation,
    currentLocationOption.label,
    endId,
    places,
    startId,
  ]);

  const highlightedEdgeKey = useMemo(() => {
    const a = optionToNodeId(startId);
    const b = optionToNodeId(endId);
    if (!a || !b) return null;
    return [a, b].sort().join("--");
  }, [endId, startId, currentLocation]);

  const graphNodes = useMemo<RFNode[]>(() => {
    if (graphPoints.length === 0) return [];

    const lats = graphPoints.map((p) => p.lat);
    const lons = graphPoints.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLon = Math.max(maxLon - minLon, 0.01);
    const width = 900;
    const height = 420;
    const padding = 50;

    return graphPoints.map((point) => {
      const x =
        padding + ((point.lon - minLon) / spanLon) * (width - padding * 2);
      const y =
        padding + (1 - (point.lat - minLat) / spanLat) * (height - padding * 2);
      const placeId = getPlaceIdFromPointId(point.id);

      return {
        id: point.id,
        position: { x, y },
        draggable: false,
        className: "group",
        data: {
          label: (
            <div className="flex w-full items-center justify-between">
              <span className="mr-2 flex-1 text-left">{point.label}</span>
              {point.kind === "place" && placeId != null ? (
                <button
                  type="button"
                  aria-label={`Delete ${point.label}`}
                  title="Delete place"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDeletePlace(placeId, point.label);
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100 rounded-md border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ),
        },
        style: {
          background:
            point.kind === "airport"
              ? "#e0f2fe"
              : point.kind === "current"
                ? "#f1f5f9"
                : "#ffffff",
          borderColor:
            point.kind === "airport"
              ? "#0284c7"
              : point.kind === "current"
                ? "#475569"
                : "#94a3b8",
          borderWidth: 1.5,
          borderStyle: "solid",
          borderRadius: 16,
          padding: 10,
          fontSize: 12,
          fontWeight: 600,
          color: "#0f172a",
          boxShadow: "0 8px 20px rgba(2, 6, 23, 0.08)",
        },
      } satisfies RFNode;
    });
  }, [graphPoints]);

  const graphEdges = useMemo<RFEdge[]>(() => {
    const edges: RFEdge[] = [];

    for (let i = 0; i < graphPoints.length; i += 1) {
      for (let j = i + 1; j < graphPoints.length; j += 1) {
        const sourcePoint = graphPoints[i];
        const targetPoint = graphPoints[j];
        const edgeKey = [sourcePoint.id, targetPoint.id].sort().join("--");
        const forwardMeters = roadDistances[i]?.[j] ?? null;
        const backwardMeters = roadDistances[j]?.[i] ?? null;

        const distanceKm = [forwardMeters, backwardMeters]
          .filter((d): d is number => typeof d === "number" && Number.isFinite(d))
          .map((m) => m / 1000)
          .reduce((min, v) => Math.min(min, v), Number.POSITIVE_INFINITY);

        const label = Number.isFinite(distanceKm)
          ? `${distanceKm.toFixed(1)} km`
          : roadDistances.length > 0
            ? "No road path"
            : "Pending";

        const isHighlighted = edgeKey === highlightedEdgeKey;

        edges.push({
          id: edgeKey,
          source: sourcePoint.id,
          target: targetPoint.id,
          label,
          type: "straight",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? "#16a34a" : "#94a3b8",
            width: 18,
            height: 18,
          },
          style: {
            stroke: isHighlighted ? "#16a34a" : "#94a3b8",
            strokeWidth: isHighlighted ? 3 : 1.2,
            strokeDasharray: distanceKm == null ? "6 4" : undefined,
          },
          labelStyle: {
            fontSize: 11,
            fontWeight: 600,
            fill: isHighlighted ? "#166534" : "#64748b",
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.9,
          },
          labelBgBorderRadius: 6,
          labelBgPadding: [5, 4],
        });
      }
    }

    return edges;
  }, [graphPoints, highlightedEdgeKey, roadDistances]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            OSRM road distances
            {activeTab === "graph" ? " - Network Graph" : " - Distance Table"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {activeTab === "graph"
              ? "All places are connected to each other with weighted edges from OSRM road-network distance. The selected route is highlighted in green."
              : "Distance matrix showing road distances (in km) between all places."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("graph")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors flex gap-2 cursor-pointer ${
              activeTab === "graph"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <GitBranchPlusIcon className="h-4 w-4" />
            Graph
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors flex gap-2 cursor-pointer ${
              activeTab === "table"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Table className="h-4 w-4" />
            Table
          </button>
        </div>
      </div>
      {roadDistanceLoading ? (
        <p className="mt-2 text-xs text-slate-500">
          Fetching OSRM road distances...
        </p>
      ) : null}
      {roadDistanceError ? (
        <p className="mt-2 text-xs text-red-600">{roadDistanceError}</p>
      ) : null}

      {activeTab === "graph" ? (
        <div className="mt-4 h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {graphNodes.length >= 2 ? (
            <ReactFlow
              nodes={graphNodes}
              edges={graphEdges}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              defaultEdgeOptions={{ animated: false }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#cbd5e1" gap={18} />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              At least two places with coordinates are needed to render the
              graph.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 overflow-x-auto">
          {graphPoints.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              No places to display.
            </div>
          ) : roadDistances.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              Waiting for distance data...
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">
                    From / To
                  </th>
                  {graphPoints.map((point) => (
                    <th
                      key={point.id}
                      className="border border-slate-300 bg-slate-100 px-3 py-2 text-center font-semibold text-slate-700 whitespace-nowrap"
                    >
                      <div className="group flex w-full items-center justify-between gap-3">
                        <span className="flex-1 text-left">{point.label}</span>
                        {point.kind === "place" ? (
                          <button
                            type="button"
                            aria-label={`Delete ${point.label}`}
                            title="Delete place"
                            onClick={() => {
                              const placeId = getPlaceIdFromPointId(point.id);
                              if (placeId == null) return;
                              handleDeletePlace(placeId, point.label);
                            }}
                            className="opacity-0 transition-opacity group-hover:opacity-100 rounded-md border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {graphPoints.map((fromPoint, fromIdx) => (
                  <tr key={fromPoint.id}>
                    <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                      <div className="group flex w-full items-center justify-between gap-3">
                        <span className="flex-1 text-left">
                          {fromPoint.label}
                        </span>
                        {fromPoint.kind === "place" ? (
                          <button
                            type="button"
                            aria-label={`Delete ${fromPoint.label}`}
                            title="Delete place"
                            onClick={() => {
                              const placeId = getPlaceIdFromPointId(
                                fromPoint.id,
                              );
                              if (placeId == null) return;
                              handleDeletePlace(placeId, fromPoint.label);
                            }}
                            className="opacity-0 transition-opacity group-hover:opacity-100 rounded-md border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    {graphPoints.map((toPoint, toIdx) => {
                      const distanceKm = [
                        roadDistances[fromIdx]?.[toIdx],
                        roadDistances[toIdx]?.[fromIdx],
                      ]
                        .filter((d): d is number => typeof d === "number" && Number.isFinite(d))
                        .map((m) => m / 1000)
                        .reduce((min, v) => Math.min(min, v), Number.POSITIVE_INFINITY);
                      const isZero = fromIdx === toIdx;

                      return (
                        <td
                          key={`${fromPoint.id}--${toPoint.id}`}
                          className={`border border-slate-300 px-3 py-2 text-center ${
                            isZero
                              ? "bg-slate-100 text-slate-500"
                              : !Number.isFinite(distanceKm)
                                ? "bg-red-50 text-red-600"
                                : "bg-white text-slate-700"
                          }`}
                        >
                          {isZero
                            ? "—"
                            : Number.isFinite(distanceKm)
                              ? `${distanceKm.toFixed(1)}`
                              : "No path"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
