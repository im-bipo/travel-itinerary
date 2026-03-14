// lib/gemini.ts - Google Gemini Embedding Client

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const embeddingModel = genAI.getGenerativeModel(
  { model: "gemini-embedding-001" },
  { apiVersion: "v1beta" },
);

/**
 * Generate an embedding vector for the given text using Gemini.
 * Model: text-embedding-004 (768 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts in one call.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(texts.map((t) => generateEmbedding(t)));
  return results;
}
