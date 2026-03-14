import TestimonialsCarousel from "./TestimonialsCarousel";

const testimonials = [
  {
    quote:
      "Started from Butwal and chatted with the bot—added Resunga and Muktinath instantly. The map route saved us so much time.",
    author: "Ram Thapa",
    role: "Pilgrim",
  },
  {
    quote:
      "A local guide contributor recommended a waterfall near Palpa. It was a hidden gem and easy to fit into our plan.",
    author: "Sita Gurung",
    role: "Backpacker",
  },
  {
    quote:
      "Hotel and restaurant suggestions popped up right after I listed places. Booking was a breeze and transport partner was reliable.",
    author: "Dipesh Lama",
    role: "Family Traveler",
  },
  {
    quote:
      "Loved the chatbot interface. It felt like planning with a friend and the final itinerary map was perfect for road trips.",
    author: "Anita Koirala",
    role: "Solo Explorer",
  },
  {
    quote:
      "Everything stayed within budget and the suggested partners made travel stress-free. Highly recommend for trips within Nepal.",
    author: "Santosh Rai",
    role: "Adventure Seeker",
  },
];

export default function TestimonialsSection() {
  const headerVariant = 15;
  return (
    <section className="bg-white py-25">
      <div className="mx-auto max-w-300 px-4 md:px-6">
        <header className="mb-10 md:mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            <span className="text-primary">Trusted</span> by Travelers
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-gray-600">
            Real experiences from travelers who discovered smarter trip
            planning.
          </p>
        </header>
        <TestimonialsCarousel testimonials={testimonials} />
      </div>
    </section>
  );
}
