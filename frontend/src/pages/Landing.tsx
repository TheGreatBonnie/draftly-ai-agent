import { OrganizationList, Show } from "@clerk/react";
import { LandingFAQ } from "../components/landing/LandingFAQ";
import { LandingFeatures } from "../components/landing/LandingFeatures";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingHowItWorks } from "../components/landing/LandingHowItWorks";
import { LandingNav } from "../components/landing/LandingNav";

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />

      <Show when="signed-in">
        <main className="flex flex-1 items-center justify-center bg-[#FAF8F5] px-6 py-20">
          <OrganizationList
            afterSelectOrganizationUrl="/dashboard"
            afterCreateOrganizationUrl="/dashboard"
          />
        </main>
      </Show>

      <Show when="signed-out">
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingFAQ />
      </Show>

      <LandingFooter />
    </div>
  );
}
