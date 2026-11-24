import type { Metadata } from "next";
import NavbarArc from "@/components/landing/NavbarArc";
import HeroOrbital from "@/components/landing/HeroOrbital";

export const metadata: Metadata = {
  title: "Cakrapala — Deep Space Observatory & AI Astrophysics Co-Pilot",
  description:
    "Interactive deep space planetary observatory with photorealistic 3D Earth horizon, real-time satellite tracking, Keplerian orrery, and AI astrophysics companion.",
};

export default function LandingPage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#01030a] text-slate-100 selection:bg-sky-400/25 selection:text-white">
      <NavbarArc />

      {/* Full-viewport photorealistic LEO cupola hero */}
      <HeroOrbital />
    </main>
  );
}
