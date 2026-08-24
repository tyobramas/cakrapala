import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import CosmicCanvas from "@/components/landing/CosmicCanvas";
import HeroSection from "@/components/landing/HeroSection";
import CelestialTicker from "@/components/landing/CelestialTicker";
import ExplorationModules from "@/components/landing/ExplorationModules";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Cakrapala — Deep Space Observatory & IBM Granite AI Co-Pilot",
  description:
    "Interactive deep space planetary observatory with real-time satellite tracking, 3D Keplerian orrery, and IBM Granite AI astrophysics companion.",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Deep Space Realistic Starfield */}
      <CosmicCanvas />

      {/* Top Aerospace Navbar */}
      <Navbar />

      {/* 1. Master Aerospace Flight Deck & 3D Milky Way */}
      <HeroSection />

      {/* 2. Live Celestial Astrodynamic Event Ticker */}
      <CelestialTicker />

      {/* 3. Primary Observatory Exploration Modules */}
      <ExplorationModules />

      {/* 4. Futuristic NASA-grade Footer */}
      <Footer />
    </div>
  );
}
