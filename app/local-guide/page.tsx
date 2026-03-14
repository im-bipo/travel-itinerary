"use client";

import { FormEvent, useState } from "react";
import { addPlace, AddPlaceInput } from "@/actions/place";
import { MapPin, Plus, CheckCircle, AlertCircle } from "lucide-react";

const placeTypes = [
  "Temple",
  "Pilgrimage",
  "Park",
  "Waterfall",
  "Lake",
  "Museum",
  "Viewpoint",
  "Heritage Site",
  "Hotel",
  "Restaurant",
  "Other",
];

const defaultForm: AddPlaceInput = {
  name: "",
  district: "",
  state: "Lumbini",
  type: "Temple",
  latitude: 0,
  longitude: 0,
  description: "",
  imageUrl: "",
};

export default function LocalGuidePage() {
  const [form, setForm] = useState<AddPlaceInput>(defaultForm);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  function update<K extends keyof AddPlaceInput>(
    key: K,
    value: AddPlaceInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ type: "loading" });

    const result = await addPlace(form);

    if (result.success) {
      setStatus({
        type: "success",
        message: `Place added successfully! (ID: ${result.placeId})`,
      });
      setForm(defaultForm);
    } else {
      setStatus({ type: "error", message: result.error });
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(120deg,rgba(0,128,62,0.06),rgba(255,255,255,1),rgba(0,128,62,0.04))]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Local Guide Portal
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Contribute new places and help travelers discover hidden gems across
            Nepal.
          </p>
        </div>

        {/* Status banner */}
        {status.type === "success" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
            {status.message}
          </div>
        )}
        {status.type === "error" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            {status.message}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Place Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Tamghas Resunga Temple"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* District + State */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                District <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                placeholder="e.g. Gulmi"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                State / Province <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                placeholder="e.g. Lumbini"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Place Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {placeTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Lat + Long */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={form.latitude || ""}
                onChange={(e) =>
                  update("latitude", parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 28.2096"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={form.longitude || ""}
                onChange={(e) =>
                  update("longitude", parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 83.9856"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="A brief description of the place, its significance, and what visitors can expect..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Image URL
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => update("imageUrl", e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={status.type === "loading"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.type === "loading" ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Adding Place...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Place
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
