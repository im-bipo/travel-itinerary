import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCtaSection() {
  return (
    <section className="bg-white pb-16">
      <div className="mx-auto max-w-300 px-4 md:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary py-16 px-6 text-white">
          <div
            className="pointer-events-none absolute -right-8 top-0 h-48 w-48 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-10 bottom-8 h-52 w-52 rounded-full border border-white/30"
            aria-hidden="true"
          />
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              <span className="h-3 w-3 rounded-full bg-white/80" />
              Ready to Explore Nepal?
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-white/80">
              Chat with our guide bot, add your favorite temples and spots, and
              we’ll build a complete route with hotels and partners in minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/planner"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold text-primary shadow-lg shadow-primary/30 transition hover:translate-y-0.5"
              >
                Start Chat
                <ArrowRight className="h-4 w-4 text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
