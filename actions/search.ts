"use server";

import { generateEmbedding } from "@/lib/gemini";
import { searchSimilarPlaces } from "@/lib/astra";

export type PlaceResult = {
  place_id: number;
  name: string;
  description: string;
  district?: string;
  state?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  $similarity?: number;
};

/**
 * Search for places similar to the query using vector similarity.
 * Generates an embedding from the query, then finds top `limit` matches in Astra.
 */
export async function searchPlaces(
  query: string,
  limit: number = 5,
): Promise<PlaceResult[]> {
  const vector = await generateEmbedding(query);
  const raw = await searchSimilarPlaces(vector, limit);

  return raw.map((doc: any) => ({
    place_id: doc.place_id,
    name: doc.name,
    description: doc.description,
    district: doc.district,
    state: doc.state,
    type: doc.type,
    latitude: doc.latitude,
    longitude: doc.longitude,
    $similarity: doc.$similarity,
  }));
}
