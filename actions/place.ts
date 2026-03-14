"use server";

import prisma from "@/lib/db";
import { insertPlaceVector } from "@/lib/astra";
import { generateEmbedding } from "@/lib/gemini";

export type AddPlaceInput = {
  name: string;
  district: string;
  state: string;
  type: string;
  latitude: number;
  longitude: number;
  description: string;
  imageUrl: string;
};

export type AddPlaceResult =
  | { success: true; placeId: number }
  | { success: false; error: string };

/**
 * Server action: add a place to PostgreSQL and Astra vector DB.
 * 1. Saves structured data to PostgreSQL via Prisma.
 * 2. Generates a Gemini embedding from the place description.
 * 3. Stores the vector in Astra for similarity search.
 */
export async function addPlace(input: AddPlaceInput): Promise<AddPlaceResult> {
  try {
    // ── 1. Validate ──────────────────────────────────────────────
    if (!input.name || !input.district || !input.state || !input.type) {
      return {
        success: false,
        error: "Name, district, state, and type are required.",
      };
    }

    // ── 2. Save to PostgreSQL ────────────────────────────────────
    const place = await prisma.place.create({
      data: {
        name: input.name,
        district: input.district,
        state: input.state,
        type: input.type,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
      },
    });

    // ── 3. Generate embedding via Gemini ─────────────────────────
    const embeddingText = [
      input.name,
      input.type,
      input.district,
      input.state,
      input.description,
    ]
      .filter(Boolean)
      .join(" – ");

    const vector = await generateEmbedding(embeddingText);
    console.log("Generated embedding vector:", vector);

    // ── 4. Store in Astra vector DB ──────────────────────────────
    await insertPlaceVector(place.id, place.name, embeddingText, vector, {
      district: place.district,
      state: place.state,
      type: place.type,
      latitude: place.latitude,
      longitude: place.longitude,
      imageUrl: place.imageUrl,
    });

    return { success: true, placeId: place.id };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Handle unique constraint violation
    if (message.includes("Unique constraint")) {
      return {
        success: false,
        error: "A place with that name already exists.",
      };
    }

    console.error("addPlace error:", error);
    return { success: false, error: message };
  }
}
