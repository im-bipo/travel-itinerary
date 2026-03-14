"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchPlaces, PlaceResult } from "./search";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const chatModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite-preview-09-2025",
});

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatReplyResult = {
  reply: string;
  sources: PlaceResult[];
  usedRAG: boolean;
};

// Keywords that indicate a place/travel-related query
const PLACE_KEYWORDS = [
  "place",
  "visit",
  "go",
  "travel",
  "trip",
  "tour",
  "explore",
  "hotel",
  "hotel",
  "stay",
  "restaurant",
  "food",
  "eat",
  "temple",
  "park",
  "mountain",
  "lake",
  "river",
  "forest",
  "district",
  "city",
  "village",
  "town",
  "state",
  "nepal",
  "butwal",
  "pokhara",
  "kathmandu",
  "chitwan",
  "lumbini",
  "recommend",
  "suggest",
  "near",
  "around",
  "best",
  "itinerary",
  "route",
  "destination",
];

function isPlaceRelatedQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PLACE_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildRAGPrompt(query: string, places: PlaceResult[]): string {
  const contextLines = places
    .map(
      (p, i) =>
        `${i + 1}. **${p.name}** (${p.type ?? "Place"})
   - District: ${p.district ?? "N/A"}, State: ${p.state ?? "N/A"}
   - Coordinates: ${p.latitude ?? "N/A"}, ${p.longitude ?? "N/A"}
   - Description: ${p.description ?? "No description"}`,
    )
    .join("\n\n");

  return `You are a helpful Nepal domestic travel assistant. Use the following relevant places from our database to answer the user's query. Be friendly, informative, and suggest specific details from the context.

## Relevant Places from Database:
${contextLines}

## User Query:
${query}

Respond naturally using the context above. If the user asks for recommendations or an itinerary, reference the places by name and give practical travel advice.

**IMPORTANT: Format your entire response using markdown. Use headings (##), bullet points (-), bold text (**text**), and links where appropriate.**`;
}

function buildGeneralPrompt(query: string): string {
  return `You are a helpful Nepal domestic travel assistant. Answer the user's question in a friendly and concise way. If relevant, gently guide them to explore places in Nepal.

User: ${query}

**IMPORTANT: Format your entire response using markdown. Use headings (##), bullet points (-), bold text (**text**), and code blocks (\`\`\`) where appropriate.**`;
}

/**
 * Main chat action — uses RAG for place-related queries, otherwise responds as a general travel AI.
 */
export async function chatReply(
  message: string,
  history: ChatMessage[] = [],
): Promise<ChatReplyResult> {
  const usedRAG = isPlaceRelatedQuery(message);
  let sources: PlaceResult[] = [];
  let prompt: string;

  if (usedRAG) {
    try {
      sources = await searchPlaces(message, 5);
    } catch (err) {
      console.warn("[RAG] Vector search failed, falling back to general:", err);
    }

    if (sources.length > 0) {
      prompt = buildRAGPrompt(message, sources);
    } else {
      // Vector search returned nothing — fall back to general
      prompt = buildGeneralPrompt(message);
    }
  } else {
    prompt = buildGeneralPrompt(message);
  }

  // Build chat history for multi-turn context (last 6 messages)
  const chatHistory = history.slice(-6).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const chat = chatModel.startChat({ history: chatHistory });
  const result = await chat.sendMessage(prompt);
  const reply = result.response.text();

  return { reply, sources, usedRAG: usedRAG && sources.length > 0 };
}
