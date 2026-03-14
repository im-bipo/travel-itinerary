// lib/astra.ts - DataStax Astra Vector Database Client

import { DataAPIClient } from "@datastax/astra-db-ts";

const client = new DataAPIClient(
  process.env.ASTRA_DB_APPLICATION_TOKEN as string,
);

export const db = client.db(process.env.ASTRA_API_ENDPOINT as string, {
  keyspace: process.env.ASTRA_DB_KEYSPACE ?? "default_keyspace",
});

// Returns the places collection handle (collection must exist in Astra console)
// Create it manually: name = "places_vectors", vector dimension = 3072, metric = cosine
export function getPlacesCollection() {
  return db.collection("places_vectors");
}

// Get the recommendations collection handle
export function getRecommendationsCollection() {
  return db.collection("recommendations");
}

// Insert place with vector embedding
export async function insertPlaceVector(
  placeId: number,
  name: string,
  description: string,
  vector: number[],
  data?: {
    district?: string;
    state?: string;
    type?: string;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
  },
) {
  try {
    const collection = getPlacesCollection();
    const result = await collection.insertOne({
      $vector: vector,
      place_id: placeId,
      name,
      description,
      district: data?.district,
      state: data?.state,
      type: data?.type,
      latitude: data?.latitude,
      longitude: data?.longitude,
      imageUrl: data?.imageUrl,
    });
    console.log("Added place to Astra:", result.insertedId);
    return result;
  } catch (error) {
    console.error("Error inserting place vector:", error);
    throw error;
  }
}

// Search similar places by vector (ANN search — returns top `limit` results)
export async function searchSimilarPlaces(vector: number[], limit: number = 5) {
  try {
    const collection = getPlacesCollection();
    const results = await collection
      .find(
        {},
        {
          sort: { $vector: vector } as any,
          limit,
          includeSimilarity: true,
        },
      )
      .toArray();
    return results;
  } catch (error) {
    console.error("Error searching similar places:", error);
    throw error;
  }
}

// Store recommendation data
export async function storeRecommendation(
  userId: string,
  startCity: string,
  recommendedPlaceIds: number[],
  metadata: Record<string, unknown>,
) {
  try {
    const collection = getRecommendationsCollection();
    const result = await collection.insertOne({
      user_id: userId,
      start_city: startCity,
      recommended_place_ids: recommendedPlaceIds,
      metadata,
      created_at: new Date(),
    });
    return result;
  } catch (error) {
    console.error("Error storing recommendation:", error);
    throw error;
  }
}

// Retrieve user recommendations
export async function getUserRecommendations(userId: string) {
  try {
    const collection = getRecommendationsCollection();
    const results = await collection
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();
    return results;
  } catch (error) {
    console.error("Error retrieving recommendations:", error);
    throw error;
  }
}

export default db;
