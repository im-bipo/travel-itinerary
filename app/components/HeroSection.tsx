import Image from "next/image";
import { SearchBar } from "@/components/custom/SearchBar";
import HeroPills from "@/components/custom/HeroPills";

const heroServices = [
  { label: "Chat Recommendations", icon: "Bubbles" },
  { label: "Optimized Routes", icon: "Route" },
  { label: "Hotels & Eats", icon: "Bed" },
  { label: "Local Guides", icon: "Users" },
  { label: "Map Planner", icon: "MapPin" },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#f4f8ff]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-24 top-10 w-md h-112 bg-primary/14 rounded-full blur-3xl" />
        <div className="absolute -right-32 bottom-0 w-120 h-120 bg-[#079AE1]/16 rounded-full blur-3xl" />
        <div className="absolute left-1/2 top-10 -translate-x-1/2 w-72 h-72 bg-white/30 backdrop-blur-xl rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 md:py-20 lg:py-24">
        <div className="flex flex-col items-center text-center gap-6">
          <Image
            src="/travel-itinerary-full-logo.png"
            alt="Travel Itinerary Logo"
            width={120}
            height={120}
            className="w-24 h-24 md:w-32 md:h-32 "
          />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight max-w-4xl">
            Plan Your Domestic Adventure with Chat‑Guided Precision
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-3xl">
            Start from Butwal, chat with our guide bot to add temples, parks and
            hidden gems – then pick hotels, transport partners and view a mapped
            route that covers all your stops efficiently.
          </p>

          <HeroPills services={heroServices} />

          <div className="flex items-center gap-3 w-full max-w-4xl pt-6">
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-sm font-semibold text-slate-500">Or</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="w-full max-w-4xl">
            <SearchBar placeholder="Enter starting city (e.g. Butwal)" />
            <p className="mt-3 text-sm text-slate-500">
              Popular:{" "}
              <span className="text-slate-700">
                Resunga, Muktinath, Shiva Temple – Palpa, Ghalegaun, Chitwan
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
