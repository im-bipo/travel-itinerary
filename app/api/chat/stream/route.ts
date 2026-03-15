import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/gemini";
import { searchSimilarPlaces } from "@/lib/astra";
import { generateNovaChatStream } from "@/lib/nova";

type IncomingChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PlaceResult = {
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

const PLACE_KEYWORDS = [
  "place",
  "visit",
  "go",
  "travel",
  "trip",
  "tour",
  "explore",
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

  return `You are a helpful Nepal domestic travel assistant. Use the following relevant places from our database to answer the user's query. Be warm, practical, and natural like a local expert.

## Relevant Places from Database:
${contextLines}

## User Query:
${query}

Respond naturally using the context above carefully. Categorize the places:

**Matched Places:** Places that directly match the user's location, activity type, or criteria.
**Other Places:** Places that don't match the user's query but might still be interesting alternatives.

If the user asks for recommendations or an itinerary, reference places by name and include practical advice.

**CRITICAL FORMAT RULES (must follow):**

- Write in markdown with headings: #, ##, ###.
- Keep language human, conversational, and easy to understand.
- Create two sections if applicable:
  1. **Top Recommendations** (places that match the user request)
  2. **Other Recommended Places** (places that don't match but are near or related)

- When listing places, each place must follow this structure with visible spacing:

1. ### Place Name

  Short description in 1-2 lines.

  **Highlights:**
  - Point one
  - Point two

  **Tips:**
  - Best time
  - Travel note

---

2. ### Second Place Name

  Same format as above.

- Always leave a blank line between numbered places.
- Use --- as a visual separator between place entries ONLY within the same section.
- Always leave prominent spacing before a new section (e.g., ## Other Recommended Places).
- Prefer short paragraphs and clean bullets over dense text walls.
`;
}

function buildGeneralPrompt(query: string): string {
  return `You are a helpful Nepal domestic travel assistant. Answer the user's question in a friendly, human way. If relevant, guide them to explore places in Nepal.

User: ${query}

**CRITICAL FORMAT RULES (must follow):**

- Use markdown with headings: #, ##, ###.
- Use a clear section flow like:
  - ## Quick Answer
  - ## Recommended Places / Activities
  - ## Travel Tips
- If listing places, use numbered items with spacing and this pattern:

1. ### Place Name

  One short description paragraph.

  **Highlights:**
  - Point one
  - Point two

---

2. ### Next Place

  Same format.

- Keep a blank line between each major block.
- Use natural, warm language; avoid robotic phrasing.
`;
}

async function searchPlaces(query: string, limit = 5): Promise<PlaceResult[]> {
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: IncomingChatMessage[];
    };

    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    const usedRAG = isPlaceRelatedQuery(message);
    let sources: PlaceResult[] = [];
    let prompt = buildGeneralPrompt(message);

    if (usedRAG) {
      try {
        sources = await searchPlaces(message, 5);
      } catch (err) {
        console.warn(
          "[RAG] Vector search failed, falling back to general:",
          err,
        );
      }

      if (sources.length > 0) {
        prompt = buildRAGPrompt(message, sources);
      }
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a helpful Nepal domestic travel assistant. Always respond in markdown with clean structure and spacing. Use headings (#, ##, ###), bullet points, and numbered lists. For recommendations, format each place with a title, short description, highlights, and blank-line spacing between items, using --- between major place entries. Keep tone human, warm, and practical.",
      },
      ...history.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user",
        content: prompt,
      },
    ];

    const completionStream = await generateNovaChatStream(messages);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          let metaSent = false;

          for await (const chunk of completionStream) {
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) {
              // Send chat chunk first
              push({ type: "chunk", text });

              // Send meta (cards) after first chunk arrives
              if (!metaSent) {
                push({
                  type: "meta",
                  sources,
                  usedRAG: usedRAG && sources.length > 0,
                });
                metaSent = true;
              }
            }
          }
          push({ type: "done" });
        } catch (error: unknown) {
          push({
            type: "error",
            message:
              error instanceof Error ? error.message : "Streaming failed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
