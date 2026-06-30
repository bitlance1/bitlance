import Header from "@/components/organisms/Header";
import Hero from "@/components/organisms/Hero";
import StatsSection from "@/components/organisms/StatsSection";
import WhyBitlance from "@/components/organisms/WhyBitlance";
import BrowseCategory from "@/components/organisms/BrowseCategory";
import HowItWorks from "@/components/organisms/HowItWorks";
import TopOpportunities from "@/components/organisms/TopOpportunities";
import Testimonials from "@/components/organisms/Testimonials";
import Footer from "@/components/organisms/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#FAF8F5] overflow-x-hidden">
      <Header />
      
      <main>
        <Hero />
        
        <StatsSection />
        <BrowseCategory />
        <HowItWorks />
        <TopOpportunities />
        <WhyBitlance />
        <Testimonials />
      </main>

      <Footer />
    </div>
  );
}
