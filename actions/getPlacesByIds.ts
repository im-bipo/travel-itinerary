"use server";

import prisma from "@/lib/db";

export type PlaceDetail = {
  id: number;
  name: string;
  district: string;
  state: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  imageUrl: string | null;
};

/**
 * Fetches full Place rows from PostgreSQL by their IDs.
 * Used by the planner aside panel to enrich Astra vector results with PG data.
 */
export async function getPlacesByIds(ids: number[]): Promise<PlaceDetail[]> {
  if (!ids.length) return [];

  const places = await prisma.place.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      district: true,
      state: true,
      type: true,
      latitude: true,
      longitude: true,
      description: true,
      imageUrl: true,
    },
  });

  // Return in the same order as the input IDs (Astra similarity rank order)
  const map = new Map(places.map((p) => [p.id, p]));
  return ids.map((id) => map.get(id)).filter(Boolean) as PlaceDetail[];
}
