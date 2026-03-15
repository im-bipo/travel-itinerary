"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  Compass,
  Loader2,
  MapPin,
  Route,
  ScanFace,
  SendHorizonal,
  ShieldCheck,
  Stars,
  TrendingUpDownIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { PlaceResult } from "@/actions/search";
import { getPlacesByIds, PlaceDetail } from "@/actions/getPlacesByIds";
import { useSelectedPlaces } from "@/app/context/SelectedPlacesContext";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
};

type StreamPayload =
  | { type: "meta"; sources: PlaceResult[]; usedRAG: boolean }
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

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

  const { selectedPlaces, addPlace, removePlace } = useSelectedPlaces();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasStarted = messages.length > 0;
  const showRightPanel = sources.length > 0;
  const selectedPlaceCount = selectedPlaces.length;

  const assistantReplyCount = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role === "assistant" &&
          !message.loading &&
          message.text.trim().length > 0,
      ).length,
    [messages],
  );

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
      const history = messages
        .filter((m) => !m.loading)
        .map((m) => ({ role: m.role, content: m.text }));

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to stream chat response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const payload = JSON.parse(line) as StreamPayload;

          if (payload.type === "meta") {
            setSources(payload.sources);
            const ids = payload.sources
              .map((s) => s.place_id)
              .filter(Boolean) as number[];

            if (ids.length > 0) {
              const details = await getPlacesByIds(ids);
              setPlaceDetails(new Map(details.map((d) => [d.id, d])));
            } else {
              setPlaceDetails(new Map());
            }
          }

          if (payload.type === "chunk") {
            reply += payload.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingMsg.id
                  ? { ...m, text: reply, loading: true }
                  : m,
              ),
            );
          }

          if (payload.type === "error") {
            throw new Error(payload.message || "Streaming failed.");
          }

          if (payload.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingMsg.id
                  ? { ...m, text: reply, loading: false }
                  : m,
              ),
            );
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id ? { ...m, text: reply, loading: false } : m,
        ),
      );
    } catch {
      setSources([]);
      setPlaceDetails(new Map());
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
    <main className="relative h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(15,66,114,0.16),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(14,116,144,0.14),transparent_32%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative mx-auto flex h-full w-full max-w-screen-2xl gap-4 overflow-hidden px-3 py-3 md:gap-6 md:px-6 md:py-5">
        <section
          className={`relative flex h-full flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_60px_-34px_rgba(15,66,114,0.65)] backdrop-blur-sm ${showRightPanel ? "lg:w-[66%]" : "lg:w-full"}`}
        >
          <div className="border-b border-slate-200/80 bg-[linear-gradient(120deg,rgba(15,66,114,0.08),rgba(255,255,255,0.95),rgba(8,145,178,0.08))] px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_28px_-12px_rgba(15,66,114,0.85)]">
                  <TrendingUpDownIcon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-900 md:text-lg">
                    Trip Planning Workspace
                  </h1>
                  <p className="text-xs text-slate-600 md:text-sm">
                    AI travel copilot with route-ready recommendations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Trusted Results
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  <Clock3 className="h-3.5 w-3.5" />
                  Live Session
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-5">
            {!hasStarted ? (
              <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center text-center md:mt-10">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass className="h-8 w-8" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  <Stars className="h-3.5 w-3.5 text-amber-500" />
                  Personalized itinerary engine
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  Build a premium travel plan in minutes
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                  Ask naturally and get structured recommendations for places,
                  hotels, food stops, and route sequencing so your final plan is
                  ready to optimize.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ScanFace className="h-4 w-4" />
                      </div>
                    )}

                    <article
                      className={`w-fit max-w-[88%] rounded-2xl px-4 py-3 text-sm md:text-[15px] ${
                        message.role === "user"
                          ? "rounded-br-sm bg-primary text-white shadow-[0_16px_30px_-16px_rgba(15,66,114,0.95)]"
                          : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.9)]"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none text-slate-800 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_a]:text-primary [&_a]:underline">
                          <ReactMarkdown>
                            {message.text ||
                              (message.loading ? "Thinking..." : "")}
                          </ReactMarkdown>
                          {message.loading && (
                            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Streaming response
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">
                          {message.text}
                        </span>
                      )}
                    </article>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div
            className={`border-t border-slate-200/80 bg-white/95 px-3 pb-4 pt-3 md:px-6 md:pb-5 md:pt-4 ${hasStarted ? "" : "mt-auto"}`}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-2 pb-3">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => submitMessage(prompt)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50 md:text-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-slate-300 bg-white px-2 py-1.5 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.95)]"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask for destinations, hotels, timing, or route order..."
                disabled={isLoading}
                className="h-11 flex-1 rounded-xl border-none bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50 md:text-base"
              />
              <button
                type="submit"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <aside className="hidden h-full w-[34%] shrink-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,66,114,0.65)] lg:flex lg:flex-col">
            <div className="shrink-0 border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                Discovery Results
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Curated places matched from your request
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
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      {detail?.imageUrl && (
                        <div className="h-36 w-full overflow-hidden">
                          <img
                            src={detail.imageUrl}
                            alt={detail.name}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">
                            {place.name}
                          </h4>
                          <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary">
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
                          <p className="mt-1 text-[10px] font-medium text-slate-400">
                            Confidence: {(place.$similarity * 100).toFixed(0)}%
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => addPlace(place)}
                          disabled={isSelected}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSelected ? "Added to trip" : "Add to trip"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                  Selected Places
                </h3>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                  {selectedPlaceCount} added
                </span>
              </div>

              {selectedPlaceCount === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500">
                  Add destinations from Discovery Results to prepare your
                  optimized route.
                </p>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {selectedPlaces.map((place) => (
                    <div
                      key={place.place_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="line-clamp-1 text-sm font-medium text-slate-900">
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

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
              <button
                type="button"
                disabled={selectedPlaceCount === 0}
                onClick={() => {
                  router.push("/route");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Route className="h-4 w-4" />
                Generate Route Plan
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        )}
      </div>

      {showRightPanel && (
        <div className="fixed inset-x-3 bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_20px_35px_-26px_rgba(15,23,42,0.95)] backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <span>Selected places</span>
            <span className="font-semibold text-slate-900">
              {selectedPlaceCount}
            </span>
          </div>
          <button
            type="button"
            disabled={selectedPlaceCount === 0}
            onClick={() => {
              router.push("/route");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Route className="h-4 w-4" />
            Continue to Route Plan
          </button>
        </div>
      )}
    </main>
  );
}
