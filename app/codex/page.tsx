import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import SpaceCodexContainer from "@/components/codex/SpaceCodexContainer";

export const metadata: Metadata = {
  title: "Cakrapala Space Codex — Universal Astronomy & Astrophysics Lexicon",
  description:
    "Comprehensive English-only astronomical encyclopedia and space almanac. Explore certified definitions, mathematical formulations, orbital mechanics, planetary defense scales, and astrophysical constants.",
};

export default function CodexPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#020617] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />
      <main className="flex-1 w-full">
        <SpaceCodexContainer />
      </main>
      <Footer />
    </div>
  );
}
