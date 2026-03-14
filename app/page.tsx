import FinalCtaSection from "./components/FinalCtaSection";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import TestimonialsSection from "./components/TestimonialsSection";
import WaveDivider from "./components/WaveDivider";
import WhyChooseSection from "./components/WhyChooseSection";

export default function Page() {
  return (
    <main>
      <HeroSection />
      <WhyChooseSection />
      <WaveDivider />
      <HowItWorksSection />
      <TestimonialsSection />
      <FinalCtaSection />
    </main>
  );
}
