"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Home,
  Car,
  Paintbrush,
  Wrench,
  Bubbles,
  MapPin,
  Bed,
  Users,
  Route,
} from "lucide-react";

type ServiceItem = { label: string; icon: string };

const ICONS: Record<string, any> = {
  Home,
  Car,
  Paintbrush,
  Wrench,
  Bubbles,
  MapPin,
  Bed,
  Users,
  Route,
};

export default function HeroPills({ services }: { services: ServiceItem[] }) {
  const [cols, setCols] = useState<number>(2);

  useEffect(() => {
    function updateCols() {
      setCols(window.innerWidth >= 768 ? 3 : 2);
    }

    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-6 pt-4 max-w-5xl mx-auto justify-start">
      {services.map((service, index) => {
        const Icon = ICONS[service.icon] ?? Car;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const isGreen = (row + col) % 2 === 0;

        return (
          <Link
            key={`${service.label}-${index}`}
            href={`/search?q=${encodeURIComponent(service.label)}`}
            className={`group relative z-0 overflow-hidden flex items-center gap-4 justify-start w-full rounded-full px-4 py-3 md:px-6 md:py-3 text-sm md:text-base font-semibold shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all min-h-14`}
          >
            <span
              className={`${isGreen ? "bg-[#00803E]" : "bg-white"} absolute inset-0 rounded-full ${isGreen ? "" : "border border-[#00803E]"}`}
              aria-hidden
            />

            <span
              className={`relative z-10 flex items-center justify-center rounded-full h-10 w-10 md:h-11 md:w-11 shrink-0 ${isGreen ? "bg-white" : "bg-[#00803E]"}`}
            >
              <Icon
                className={`${isGreen ? "h-5 w-5 text-[#00803E]" : "h-5 w-5 text-white"}`}
              />
            </span>

            <span
              className={`relative z-10 truncate text-left ${isGreen ? "text-white" : "text-[#00803E]"}`}
            >
              {service.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
