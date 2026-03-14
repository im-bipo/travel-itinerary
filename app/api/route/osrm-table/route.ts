import { NextResponse } from "next/server";

type OsrmTableRequest = {
  points?: Array<{
    lat: number;
    lon: number;
  }>;
};

type OsrmTableResponse = {
  code?: string;
  distances?: Array<Array<number | null>>;
  message?: string;
};

const OSRM_BASE_URL = "https://router.project-osrm.org";
const MAX_POINTS = 25;

/**
 * Calculate straight-line distance between two coordinates in meters
 */
function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OsrmTableRequest;
    const points = Array.isArray(body.points) ? body.points : [];

    if (points.length < 2) {
      return NextResponse.json(
        { error: "At least two points are required." },
        { status: 400 },
      );
    }

    if (points.length > MAX_POINTS) {
      return NextResponse.json(
        {
          error: `Too many points. Maximum supported points per request is ${MAX_POINTS}.`,
        },
        { status: 400 },
      );
    }

    const hasInvalidPoint = points.some(
      (p) =>
        typeof p.lat !== "number" ||
        typeof p.lon !== "number" ||
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lon),
    );

    if (hasInvalidPoint) {
      return NextResponse.json(
        { error: "All points must contain valid numeric lat/lon." },
        { status: 400 },
      );
    }

    const coordinates = points.map((p) => `${p.lon},${p.lat}`).join(";");

    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordinates}?annotations=distance`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "OSRM table request failed." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as OsrmTableResponse;

    if (data.code !== "Ok" || !Array.isArray(data.distances)) {
      return NextResponse.json(
        {
          error: data.message || "OSRM did not return a valid distance matrix.",
        },
        { status: 502 },
      );
    }

    // Validate distances and detect unreasonable routes
    const problematicSegments: Array<{ fromIndex: number; toIndex: number }> =
      [];
    const validatedDistances = data.distances.map((row, fromIndex) =>
      row.map((distance, toIndex) => {
        if (distance === null || typeof distance !== "number") {
          return null;
        }

        const fromPoint = points[fromIndex];
        const toPoint = points[toIndex];

        if (!fromPoint || !toPoint) {
          return distance;
        }

        const straightLineDist = calculateStraightLineDistance(
          fromPoint.lat,
          fromPoint.lon,
          toPoint.lat,
          toPoint.lon,
        );

        // If road distance is > 2.5x straight line, use straight line instead
        if (distance > straightLineDist * 2.5) {
          problematicSegments.push({
            fromIndex,
            toIndex,
          });
          return Math.round(straightLineDist);
        }

        return distance;
      }),
    );

    return NextResponse.json({
      distances: validatedDistances,
      ...(problematicSegments.length > 0 && {
        problematicSegments,
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while requesting OSRM.",
      },
      { status: 500 },
    );
  }
}
