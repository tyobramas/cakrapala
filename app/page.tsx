import type { Metadata } from "next";
import NavbarArc from "@/components/landing/NavbarArc";
import Navbar from "@/components/landing/Navbar";
import CosmicCanvas from "@/components/landing/CosmicCanvas";
import HeroOrbital from "@/components/landing/HeroOrbital";

export const metadata: Metadata = {
  title: "Cakrapala — Deep Space Observatory & IBM Granite AI Co-Pilot",
  description:
    "Interactive deep space planetary observatory with real-time satellite tracking, 3D Keplerian orrery, and IBM Granite AI astrophysics companion.",
};

export default function LandingPage() {
  return (
    <main className="relative h-screen w-screen bg-[#020617] text-slate-100 overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      <CosmicCanvas />
      <Navbar />
      <NavbarArc />

      {/* Full-viewport LEO cupola hero — Single view landing experience */}
      <HeroOrbital />
    </main>
  );
}
