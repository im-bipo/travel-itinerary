"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BranchTraceNode } from "@/lib/branch-and-bound";

type BranchAndBoundTreeProps = {
  steps: BranchTraceNode[];
  visibleCount: number;
};

function formatMetersToKm(meters: number): string {
  if (!Number.isFinite(meters)) return "n/a";
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function BranchAndBoundTree({
  steps,
  visibleCount,
}: BranchAndBoundTreeProps) {
  const visibleSteps = useMemo(
    () => steps.slice(0, Math.max(visibleCount, 0)),
    [steps, visibleCount],
  );

  const graph = useMemo(() => {
    const childrenByParent = new Map<number, BranchTraceNode[]>();

    for (const step of visibleSteps) {
      if (step.parentId == null) continue;

      const bucket = childrenByParent.get(step.parentId) ?? [];
      bucket.push(step);
      childrenByParent.set(step.parentId, bucket);
    }

    for (const [parentId, bucket] of childrenByParent.entries()) {
      // Stable ordering keeps the visualization deterministic during playback.
      bucket.sort((a, b) => a.id - b.id);
      childrenByParent.set(parentId, bucket);
    }

    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const xSpacing = 300;
    const nodeHeight = 140;
    const unitHeight = 180;
    const rootGap = 200;
    const positionById = new Map<number, { x: number; y: number }>();

    const roots = visibleSteps
      .filter((step) => step.parentId == null)
      .sort((a, b) => a.id - b.id);

    const subtreeUnitsById = new Map<number, number>();

    const countUnits = (nodeId: number): number => {
      const cached = subtreeUnitsById.get(nodeId);
      if (cached != null) return cached;

      const children = childrenByParent.get(nodeId) ?? [];
      if (children.length === 0) {
        subtreeUnitsById.set(nodeId, 1);
        return 1;
      }

      const total = children.reduce(
        (sum, child) => sum + countUnits(child.id),
        0,
      );
      const value = Math.max(1, total);
      subtreeUnitsById.set(nodeId, value);
      return value;
    };

    for (const root of roots) {
      countUnits(root.id);
    }

    const assignBySpan = (
      node: BranchTraceNode,
      depth: number,
      spanStartY: number,
    ) => {
      const units = subtreeUnitsById.get(node.id) ?? 1;
      const spanHeight = units * unitHeight;
      const centerY = spanStartY + spanHeight / 2;

      // React Flow node position is top-left, so we center by subtracting half height.
      positionById.set(node.id, {
        x: depth * xSpacing + 20,
        y: centerY - nodeHeight / 2,
      });

      const children = childrenByParent.get(node.id) ?? [];
      let cursorY = spanStartY;
      for (const child of children) {
        const childUnits = subtreeUnitsById.get(child.id) ?? 1;
        assignBySpan(child, depth + 1, cursorY);
        cursorY += childUnits * unitHeight;
      }
    };

    let rootCursorY = 0;
    for (const root of roots) {
      assignBySpan(root, 0, rootCursorY);
      const rootUnits = subtreeUnitsById.get(root.id) ?? 1;
      rootCursorY += rootUnits * unitHeight + rootGap;
    }

    for (const step of visibleSteps) {
      const isSolution = step.status === "solution";
      const isPruned = step.status === "pruned";
      const position = positionById.get(step.id) ?? { x: 20, y: 0 };

      nodes.push({
        id: String(step.id),
        position,
        draggable: true,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div className="max-w-56 text-left">
              <div className="text-[11px] font-semibold text-slate-700">
                Node #{step.id} ({step.status})
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-800">
                {step.pathLabels.join(" -> ")}
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                Cost: {formatMetersToKm(step.cost)}
              </div>
              <div className="text-[10px] text-slate-600">
                Bound:{" "}
                {Number.isFinite(step.bound)
                  ? formatMetersToKm(step.bound)
                  : "infinity"}
              </div>
            </div>
          ),
        },
        style: {
          border: isSolution
            ? "1.5px solid #059669"
            : isPruned
              ? "1.5px solid #f43f5e"
              : "1.5px solid #0ea5e9",
          background: isSolution ? "#ecfdf5" : isPruned ? "#fff1f2" : "#f0f9ff",
          borderRadius: 12,
          boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
          padding: 8,
          width: 240,
          fontSize: 12,
        },
      });
    }

    for (const step of visibleSteps) {
      if (step.parentId == null) continue;

      const parentVisible = visibleSteps.some((s) => s.id === step.parentId);
      if (!parentVisible) continue;

      const edgeColor =
        step.status === "solution"
          ? "#059669"
          : step.status === "pruned"
            ? "#f43f5e"
            : "#0ea5e9";

      edges.push({
        id: `${step.parentId}-${step.id}`,
        source: String(step.parentId),
        target: String(step.id),
        type: "default",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 16,
          height: 16,
        },
        style: {
          stroke: edgeColor,
          strokeWidth: step.status === "solution" ? 3 : 1.8,
          strokeDasharray: step.status === "pruned" ? "6 4" : undefined,
        },
        animated: step.status === "expanded",
      });
    }

    return { nodes, edges };
  }, [visibleSteps]);

  if (visibleSteps.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Run Generate Route to start live branch-and-bound tree visualization.
      </div>
    );
  }

  return (
    <div className="h-[80vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        defaultEdgeOptions={{ animated: false }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        panOnScroll
        minZoom={0.05}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls showInteractive />
      </ReactFlow>
      <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        Expanded nodes are blue, pruned nodes are red dashed, and best solution
        path is highlighted in green.
      </div>
    </div>
  );
}
