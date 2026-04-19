import { HeroCarousel } from "@/components/marketing/HeroCarousel";
import { StatsBar } from "@/components/marketing/StatsBar";
import { SourceMarquee } from "@/components/marketing/SourceMarquee";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { OpportunityShowcase } from "@/components/marketing/OpportunityShowcase";
import { PlatformPreview } from "@/components/marketing/PlatformPreview";
import { PartnersStrip } from "@/components/marketing/PartnersStrip";
import { PrincipalsBlock } from "@/components/marketing/PrincipalsBlock";
import { CtaBand } from "@/components/marketing/CtaBand";

export default function HomePage() {
  return (
    <>
      <HeroCarousel />
      <StatsBar />
      <HowItWorks />
      <SourceMarquee />
      <OpportunityShowcase />
      <PlatformPreview />
      <PartnersStrip />
      <PrincipalsBlock />
      <CtaBand />
    </>
  );
}
