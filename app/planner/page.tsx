"use client";

import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Loader2,
  MapPin,
  Route,
  SendHorizonal,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { chatReply, ChatMessage as AIChatMessage } from "@/actions/chat";
import type { PlaceResult } from "@/actions/search";
import { getPlacesByIds, PlaceDetail } from "@/actions/getPlacesByIds";
import { useSelectedPlaces } from "@/app/context/SelectedPlacesContext";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
};

const quickPrompts = [
  "Start from Butwal and suggest 3 temples",
  "Best places to visit in Lumbini",
  "Suggest hotels near Palpa",
  "Where should I go for trekking in Nepal?",
];

export default function PlannerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<PlaceResult[]>([]);
  const [placeDetails, setPlaceDetails] = useState<Map<number, PlaceDetail>>(
    new Map(),
  );
  const {
    selectedPlaces,
    addPlace,
    removePlace,
  } = useSelectedPlaces();
  const router = useRouter();

  const bottomRef = useRef<HTMLDivElement>(null);

  const hasStarted = messages.length > 0;
  const showRightPanel = sources.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const suggestions = useMemo(
    () =>
      hasStarted
        ? [
            "Find hotels near these places",
            "What restaurants are close by?",
            "Suggest a 3-day itinerary",
            "Show the shortest route between all stops",
          ]
        : quickPrompts,
    [hasStarted],
  );

  async function submitMessage(value: string) {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };
    const loadingMsg: ChatMessage = {
      id: Date.now() + 1,
      role: "assistant",
      text: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build history from current messages (exclude the loading placeholder)
      const history: AIChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const result = await chatReply(trimmed, history);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: result.reply, loading: false }
            : m,
        ),
      );

      if (result.sources.length > 0) {
        setSources(result.sources);
        const ids = result.sources
          .map((s) => s.place_id)
          .filter(Boolean) as number[];
        if (ids.length > 0) {
          const details = await getPlacesByIds(ids);
          const map = new Map(details.map((d) => [d.id, d]));
          setPlaceDetails(map);
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                text: "Sorry, something went wrong. Please try again.",
                loading: false,
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitMessage(input);
  }


  return (
    <main className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[linear-gradient(120deg,rgba(0,128,62,0.06),rgba(255,255,255,1),rgba(0,128,62,0.04))]">
      <div className="mx-auto flex h-full w-full max-w-7xl gap-5 overflow-hidden px-4 py-4 md:px-6 md:py-5">
        <section
          className={`relative flex h-full flex-1 flex-col overflow-hidden rounded-3xl border border-primary/10 bg-white/45 shadow-[0_12px_30px_rgba(2,32,16,0.08)] backdrop-blur-sm ${showRightPanel ? "lg:w-[65%]" : "lg:w-full"}`}
        >
          <div className="border-b border-primary/10 bg-white/70 px-5 py-4 backdrop-blur-sm md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-900 md:text-lg">
                    Planner Assistant
                  </h1>
                  <p className="text-xs text-slate-500 md:text-sm">
                    Plan domestic trips with guided chat and route-ready output
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Online
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {!hasStarted ? (
              <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center text-center md:mt-16">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  Where do you want to travel next?
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
                  Start with your city, chat naturally, and build your itinerary
                  step by step with destination, hotels, restaurants, partners,
                  and map-ready flow.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-2">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                      message.role === "user"
                        ? "ml-auto rounded-br-sm bg-primary text-white shadow-[0_8px_18px_rgba(8,104,63,0.3)]"
                        : "rounded-bl-sm border border-slate-200/80 bg-white/90 text-slate-800 shadow-sm"
                    }`}
                  >
                    {message.loading ? (
                      <span className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking...
                      </span>
                    ) : message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-slate-800 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_a]:text-primary [&_a]:underline">
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {message.text}
                      </span>
                    )}
                  </article>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div
            className={`border-t border-primary/10 bg-white/75 px-4 pb-5 pt-4 backdrop-blur ${hasStarted ? "" : "mt-auto"}`}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 pb-3">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => submitMessage(prompt)}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50 md:text-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-primary/15 bg-white px-2 py-1 shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message planner bot..."
                disabled={isLoading}
                className="h-10 flex-1 rounded-xl border-none bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50 md:text-base"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SendHorizonal className="h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        </section>

        {showRightPanel && (
          <aside className="hidden h-full w-[35%] shrink-0 overflow-hidden rounded-3xl border border-primary/10 bg-white/55 shadow-[0_12px_30px_rgba(2,32,16,0.08)] backdrop-blur-sm lg:flex lg:flex-col">
            <div className="shrink-0 border-b border-primary/10 bg-white/70 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                Matched Places
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Top results from your travel database
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {sources.map((place, i) => {
                  const detail = placeDetails.get(place.place_id);
                  const isSelected = selectedPlaces.some(
                    (selected) => selected.place_id === place.place_id,
                  );

                  return (
                    <article
                      key={`${place.place_id}-${i}`}
                      className="overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm"
                    >
                      {detail?.imageUrl && (
                        <div className="h-36 w-full overflow-hidden">
                          <img
                            src={detail.imageUrl}
                            alt={detail.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {place.name}
                          </h4>
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                            {place.type ?? "Place"}
                          </span>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {place.district ?? "Nepal"}
                          {place.state ? `, ${place.state}` : ""}
                        </p>
                        {(detail?.description ?? place.description) && (
                          <p className="mt-2 line-clamp-2 text-[11px] text-slate-500">
                            {detail?.description ?? place.description}
                          </p>
                        )}
                        {place.$similarity !== undefined && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Match: {(place.$similarity * 100).toFixed(0)}%
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => addPlace(place)}
                          disabled={isSelected}
                          className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSelected ? "Added" : "Add"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 border-t border-primary/10 bg-white/70 px-4 py-4">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                  Selected Places
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedPlaces.length} added
                </span>
              </div>

              {selectedPlaces.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Add places from the matched results to build your route.
                </p>
              ) : (
                <div className="mt-1 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {selectedPlaces.map((place) => (
                    <div
                      key={place.place_id}
                      className="flex items-center justify-between rounded-xl border border-primary/15 bg-white px-3 py-2"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {place.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlace(place.place_id)}
                        className="text-xs font-semibold text-primary transition hover:text-primary/80"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-primary/10 bg-primary/5 px-4 py-4">
              <button
                type="button"
                disabled={selectedPlaces.length === 0}
                onClick={() => {
                  router.push("/route");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Route className="h-4 w-4" />
                Generate Route Plan
              </button>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
