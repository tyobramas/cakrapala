import type { Metadata } from "next";
import SpaceExplorerLayout from "@/components/space/SpaceExplorerLayout";

export const metadata: Metadata = {
  title: "Cakrapala — 3D Solar System Orrery",
  description:
    "Interactive 3D simulation of our Solar System with real-time planetary orbits, physical metrics, and spatial navigation.",
};

export default function SolarSystemPage() {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#020617]">
      <SpaceExplorerLayout />
    </div>
  );
}
