/**
 * Core Branch-and-Bound algorithm for route optimization.
 * Pure algorithm logic with no UI or tracing dependencies.
 */

export type DistanceMatrix = Array<Array<number | null>>;

export type CoreBranchAndBoundInput = {
  startIndex: number;
  endIndex: number;
  labels: string[];
  distances: DistanceMatrix;
};

export type CoreBranchAndBoundResult = {
  bestPath: number[];
  bestCost: number | null;
  visitedNodes: number;
  prunedNodes: number;
};

type QueueNode = {
  path: number[];
  cost: number;
  bound: number;
};

const INF = Number.POSITIVE_INFINITY;

/**
 * Get the distance between two nodes, checking both directions.
 * Returns the minimum valid distance or INF if no path exists.
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
 * Find the minimum outgoing edge from a node to any target node.
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
 * Compute a relaxed lower bound for a partial path.
 * Uses one outgoing edge from the current node + one per unvisited node.
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

  // If all intermediate nodes are already visited, only one hop to destination is left.
  if (unvisited.length === 0) {
    const tail = getEdgeDistance(distances, last, endIndex);
    return tail === INF ? INF : currentCost + tail;
  }

  // Relaxed optimistic bound:
  // 1) One outgoing edge from current last node.
  // 2) One outgoing edge from every unvisited node.
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
 * Solve the route optimization problem using Branch-and-Bound algorithm.
 * Returns the best path found and statistics.
 */
export function solveRouteWithBranchAndBoundCore({
  startIndex,
  endIndex,
  labels,
  distances,
}: CoreBranchAndBoundInput): CoreBranchAndBoundResult {
  const totalNodes = labels.length;

  // Input validation
  if (totalNodes < 2) {
    return {
      bestPath: [],
      bestCost: null,
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
      bestCost: null,
      visitedNodes: 0,
      prunedNodes: 0,
    };
  }

  let bestCost = INF;
  let bestPath: number[] = [];
  let visitedNodes = 0;
  let prunedNodes = 0;

  // Initialize root node
  const rootPath = [startIndex];
  const rootBound = computeLowerBound(
    distances,
    rootPath,
    endIndex,
    0,
    totalNodes,
  );

  const queue: QueueNode[] = [
    {
      path: rootPath,
      cost: 0,
      bound: rootBound,
    },
  ];

  // Branch-and-Bound main loop
  while (queue.length > 0) {
    // Always explore the node with the best bound first (best-first search)
    queue.sort((a, b) => a.bound - b.bound);
    const node = queue.shift();
    if (!node) break;

    visitedNodes += 1;

    // Prune if bound is worse than current best
    if (node.bound >= bestCost) {
      prunedNodes += 1;
      continue;
    }

    const visited = new Set(node.path);
    const remainingIntermediate = Array.from(
      { length: totalNodes },
      (_, idx) => idx,
    ).filter((idx) => !visited.has(idx) && idx !== endIndex);

    const last = node.path[node.path.length - 1];

    // All intermediate nodes visited - check if we can reach destination
    if (remainingIntermediate.length === 0) {
      const tail = getEdgeDistance(distances, last, endIndex);
      if (tail !== INF) {
        const candidateCost = node.cost + tail;
        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestPath = [...node.path, endIndex];
        } else {
          prunedNodes += 1;
        }
      } else {
        prunedNodes += 1;
      }
      continue;
    }

    // Generate children in order of increasing edge cost
    const orderedChildren = remainingIntermediate
      .map((nextIndex) => ({
        nextIndex,
        edgeCost: getEdgeDistance(distances, last, nextIndex),
      }))
      .sort((a, b) => a.edgeCost - b.edgeCost);

    for (const child of orderedChildren) {
      const childPath = [...node.path, child.nextIndex];
      const childCost = node.cost + child.edgeCost;

      // Skip if edge cost is invalid
      if (!Number.isFinite(childCost)) {
        prunedNodes += 1;
        continue;
      }

      const childBound = computeLowerBound(
        distances,
        childPath,
        endIndex,
        childCost,
        totalNodes,
      );

      // Prune if bound is invalid or worse than current best
      if (!Number.isFinite(childBound) || childBound >= bestCost) {
        prunedNodes += 1;
        continue;
      }

      // Add to queue for further exploration
      queue.push({
        path: childPath,
        cost: childCost,
        bound: childBound,
      });
    }
  }

  return {
    bestPath,
    bestCost: Number.isFinite(bestCost) ? bestCost : null,
    visitedNodes,
    prunedNodes,
  };
}
