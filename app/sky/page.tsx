import type { Metadata } from "next";
import SkyObservatoryContainer from "@/components/sky/SkyObservatoryContainer";

export const metadata: Metadata = {
  title: "Cakrapala — Precision Sky Map & Celestial Observatory",
  description:
    "Interactive 360-degree IAU celestial sphere with J2000 precession, atmospheric refraction, 8K Milky Way, constellations, planets, deep sky objects, and live SGP4 satellites.",
};

export default function SkyPage() {
  return (
    <main className="h-[100dvh] w-screen overflow-hidden bg-[#01030a] text-slate-100">
      <SkyObservatoryContainer />
    </main>
  );
}
