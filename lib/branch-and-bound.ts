/**
 * Branch-and-Bound with step tracing for UI visualization.
 * Wraps the core algorithm to capture detailed trace information.
 */

import {
  solveRouteWithBranchAndBoundCore,
  type CoreBranchAndBoundInput,
  type DistanceMatrix,
} from "./branch-and-bound-core";

const INF = Number.POSITIVE_INFINITY;

export type BranchStatus = "expanded" | "pruned" | "solution";

export type BranchTraceNode = {
  id: number;
  parentId: number | null;
  depth: number;
  status: BranchStatus;
  path: number[];
  pathLabels: string[];
  cost: number;
  bound: number;
  message: string;
};

export type BranchAndBoundInput = {
  startIndex: number;
  endIndex: number;
  labels: string[];
  distances: DistanceMatrix;
};

export type BranchAndBoundResult = {
  bestPath: number[];
  bestPathLabels: string[];
  bestCost: number | null;
  steps: BranchTraceNode[];
  visitedNodes: number;
  prunedNodes: number;
};

/**
 * Helper to get distance between two nodes.
 */
function getEdgeDistance(
  distances: DistanceMatrix,
  a: number,
  b: number,
): number {
  const forward = distances[a]?.[b];
  const backward = distances[b]?.[a];
  const candidates = [forward, backward].filter(
    (d): d is number => typeof d === "number" && Number.isFinite(d),
  );

  return candidates.length > 0 ? Math.min(...candidates) : INF;
}

/**
 * Helper to find minimum outgoing edge.
 */
function minOutgoingToSet(
  distances: DistanceMatrix,
  from: number,
  targets: number[],
): number {
  let best = INF;

  for (const to of targets) {
    if (from === to) continue;
    const d = getEdgeDistance(distances, from, to);
    if (d < best) best = d;
  }

  return best;
}

/**
 * Helper to compute lower bound.
 */
function computeLowerBound(
  distances: DistanceMatrix,
  path: number[],
  endIndex: number,
  currentCost: number,
  totalNodes: number,
): number {
  const visited = new Set(path);
  const last = path[path.length - 1];

  const unvisited = Array.from({ length: totalNodes }, (_, i) => i).filter(
    (i) => !visited.has(i) && i !== endIndex,
  );

  if (unvisited.length === 0) {
    const tail = getEdgeDistance(distances, last, endIndex);
    return tail === INF ? INF : currentCost + tail;
  }

  let bound = currentCost;

  const firstLegTargets = [...unvisited, endIndex];
  const firstLeg = minOutgoingToSet(distances, last, firstLegTargets);
  if (firstLeg === INF) return INF;
  bound += firstLeg;

  for (const node of unvisited) {
    const nextTargets = [...unvisited.filter((u) => u !== node), endIndex];
    const nodeBest = minOutgoingToSet(distances, node, nextTargets);
    if (nodeBest === INF) return INF;
    bound += nodeBest;
  }

  return bound;
}

/**
 * Create a trace node for UI visualization.
 */
function makeTraceNode(args: {
  id: number;
  parentId: number | null;
  path: number[];
  labels: string[];
  cost: number;
  bound: number;
  status: BranchStatus;
  message: string;
}): BranchTraceNode {
  const { id, parentId, path, labels, cost, bound, status, message } = args;
  return {
    id,
    parentId,
    depth: Math.max(path.length - 1, 0),
    status,
    path,
    pathLabels: path.map((idx) => labels[idx] ?? `Node ${idx}`),
    cost,
    bound,
    message,
  };
}

/**
 * Solve route with Branch-and-Bound and capture detailed trace for visualization.
 * This wraps the core algorithm and adds tracing at each step.
 */
export function solveRouteWithBranchAndBound({
  startIndex,
  endIndex,
  labels,
  distances,
}: BranchAndBoundInput): BranchAndBoundResult {
  const totalNodes = labels.length;

  // Input validation
  if (totalNodes < 2) {
    return {
      bestPath: [],
      bestPathLabels: [],
      bestCost: null,
      steps: [],
      visitedNodes: 0,
      prunedNodes: 0,
    };
  }

  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= totalNodes ||
    endIndex >= totalNodes ||
    startIndex === endIndex
  ) {
    return {
      bestPath: [],
      bestPathLabels: [],
      bestCost: null,
      steps: [],
      visitedNodes: 0,
      prunedNodes: 0,
    };
  }

  // For trace tracking
  let sequence = 0;
  const nextId = () => {
    sequence += 1;
    return sequence;
  };

  const steps: BranchTraceNode[] = [];
  let bestCost = INF;
  let bestPath: number[] = [];
  let visitedNodes = 0;
  let prunedNodes = 0;

  // Initialize root and trace it
  const rootPath = [startIndex];
  const rootBound = computeLowerBound(
    distances,
    rootPath,
    endIndex,
    0,
    totalNodes,
  );

  const rootId = nextId();
  steps.push(
    makeTraceNode({
      id: rootId,
      parentId: null,
      path: rootPath,
      labels,
      cost: 0,
      bound: rootBound,
      status: "expanded",
      message: "Start node expanded.",
    }),
  );

  // Queue for branch-and-bound (without trace metadata)
  type QueueNode = {
    traceId: number;
    path: number[];
    cost: number;
    bound: number;
  };

  const queue: QueueNode[] = [
    {
      traceId: rootId,
      path: rootPath,
      cost: 0,
      bound: rootBound,
    },
  ];

  // Main B&B loop with tracing
  while (queue.length > 0) {
    queue.sort((a, b) => a.bound - b.bound);
    const node = queue.shift();
    if (!node) break;

    visitedNodes += 1;

    // Prune by bound
    if (node.bound >= bestCost) {
      prunedNodes += 1;
      steps.push(
        makeTraceNode({
          id: nextId(),
          parentId: node.traceId,
          path: node.path,
          labels,
          cost: node.cost,
          bound: node.bound,
          status: "pruned",
          message: "Pruned: lower bound is not better than current best.",
        }),
      );
      continue;
    }

    const visited = new Set(node.path);
    const remainingIntermediate = Array.from(
      { length: totalNodes },
      (_, idx) => idx,
    ).filter((idx) => !visited.has(idx) && idx !== endIndex);

    const last = node.path[node.path.length - 1];

    // All intermediate nodes visited
    if (remainingIntermediate.length === 0) {
      const tail = getEdgeDistance(distances, last, endIndex);
      if (tail !== INF) {
        const candidateCost = node.cost + tail;
        const candidatePath = [...node.path, endIndex];

        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestPath = candidatePath;
          steps.push(
            makeTraceNode({
              id: nextId(),
              parentId: node.traceId,
              path: candidatePath,
              labels,
              cost: candidateCost,
              bound: candidateCost,
              status: "solution",
              message: "Accepted: new best complete route found.",
            }),
          );
        } else {
          prunedNodes += 1;
          steps.push(
            makeTraceNode({
              id: nextId(),
              parentId: node.traceId,
              path: candidatePath,
              labels,
              cost: candidateCost,
              bound: candidateCost,
              status: "pruned",
              message: "Rejected: complete route is worse than current best.",
            }),
          );
        }
      } else {
        prunedNodes += 1;
        steps.push(
          makeTraceNode({
            id: nextId(),
            parentId: node.traceId,
            path: [...node.path, endIndex],
            labels,
            cost: INF,
            bound: INF,
            status: "pruned",
            message: "Rejected: no valid road path to destination.",
          }),
        );
      }
      continue;
    }

    // Generate children, sorted by edge cost
    const orderedChildren = remainingIntermediate
      .map((nextIndex) => ({
        nextIndex,
        edgeCost: getEdgeDistance(distances, last, nextIndex),
      }))
      .sort((a, b) => a.edgeCost - b.edgeCost);

    for (const child of orderedChildren) {
      const childPath = [...node.path, child.nextIndex];
      const childCost = node.cost + child.edgeCost;

      // Invalid edge
      if (!Number.isFinite(childCost)) {
        prunedNodes += 1;
        steps.push(
          makeTraceNode({
            id: nextId(),
            parentId: node.traceId,
            path: childPath,
            labels,
            cost: INF,
            bound: INF,
            status: "pruned",
            message: "Rejected: no valid road path on this branch.",
          }),
        );
        continue;
      }

      const childBound = computeLowerBound(
        distances,
        childPath,
        endIndex,
        childCost,
        totalNodes,
      );

      // Prune by bound
      if (!Number.isFinite(childBound) || childBound >= bestCost) {
        prunedNodes += 1;
        steps.push(
          makeTraceNode({
            id: nextId(),
            parentId: node.traceId,
            path: childPath,
            labels,
            cost: childCost,
            bound: childBound,
            status: "pruned",
            message: "Pruned: child bound cannot improve best route.",
          }),
        );
        continue;
      }

      // Expand promising child
      const childId = nextId();
      steps.push(
        makeTraceNode({
          id: childId,
          parentId: node.traceId,
          path: childPath,
          labels,
          cost: childCost,
          bound: childBound,
          status: "expanded",
          message: "Expanded: promising branch kept for search.",
        }),
      );

      queue.push({
        traceId: childId,
        path: childPath,
        cost: childCost,
        bound: childBound,
      });
    }
  }

  return {
    bestPath,
    bestPathLabels: bestPath.map((i) => labels[i] ?? `Node ${i}`),
    bestCost: Number.isFinite(bestCost) ? bestCost : null,
    steps,
    visitedNodes,
    prunedNodes,
  };
}
