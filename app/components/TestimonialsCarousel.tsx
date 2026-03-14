"use client";

import * as React from "react";
import AutoScroll from "embla-carousel-auto-scroll";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

type Testimonial = {
  quote: string;
  author: string;
  role: string;
};

type TestimonialsCarouselProps = {
  testimonials: Testimonial[];
};

export default function TestimonialsCarousel({
  testimonials,
}: TestimonialsCarouselProps) {
  // keep plugin instance so we can control play/stop
  const autoScrollRef = React.useRef<any>(
    AutoScroll({
      speed: 1,
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    }),
  );

  const handleMouseLeave = () => {
    if (
      autoScrollRef.current &&
      typeof autoScrollRef.current.play === "function"
    ) {
      autoScrollRef.current.play();
    }
  };

  return (
    <div className="relative" onMouseLeave={handleMouseLeave}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-linear-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-linear-to-l from-white to-transparent" />

      <Carousel
        opts={{
          align: "start",
          loop: true,
          dragFree: false,
          duration: 60,
          skipSnaps: false,
        }}
        plugins={[autoScrollRef.current]}
      >
        <CarouselContent>
          {testimonials.map((item) => (
            <CarouselItem
              key={`${item.author}-${item.role}`}
              className="basis-[85%] sm:basis-1/2 lg:basis-1/3"
            >
              <article className="h-full rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                <p className="text-gray-700">“{item.quote}”</p>
                <p className="mt-4 font-semibold text-gray-900">
                  {item.author}
                </p>
                <p className="text-sm text-gray-600">{item.role}</p>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
